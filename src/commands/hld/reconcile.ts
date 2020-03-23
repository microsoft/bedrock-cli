/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/camelcase */
import child_process from "child_process";
import commander from "commander";
import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import process from "process";
import shelljs, { TestOptions } from "shelljs";
import { Bedrock } from "../../config";
import { assertIsStringWithContent } from "../../lib/assertions";
import * as bedrock from "../../lib/bedrockYaml";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { generateAccessYaml } from "../../lib/fileutils";
import { tryGetGitOrigin } from "../../lib/gitutils";
import * as dns from "../../lib/net/dns";
import * as ingressRoute from "../../lib/traefik/ingress-route";
import * as middleware from "../../lib/traefik/middleware";
import { logger } from "../../logger";
import { BedrockFile, BedrockServiceConfig } from "../../types";
import decorator from "./reconcile.decorator.json";

/**
 * IExecResult represents the possible return value of a Promise based wrapper
 * for child_process.exec(). `error` would specify an optional ExecException
 * which can be passed via a resolve() value instead of throwing an untyped
 * reject()
 */
interface ExecResult {
  error?: child_process.ExecException;
  value?: { stdout: string; stderr: string };
}

/**
 * Promise wrapper for child_process.exec(). This returned Promise will never
 * reject -- instead if an Error occurs, it will be returned via the resolved
 * value.
 *
 * @param cmd The command to shell out and exec
 * @param pipeIO if true, will pipe all stdio the executing parent process
 */
const exec = async (cmd: string, pipeIO = false): Promise<ExecResult> => {
  return new Promise<ExecResult>((resolve) => {
    const child = child_process.exec(cmd, (error, stdout, stderr) => {
      return resolve({
        error: error ?? undefined,
        value: { stdout, stderr },
      });
    });
    if (pipeIO) {
      child.stdin?.pipe(process.stdin);
      child.stdout?.pipe(process.stdout);
      child.stderr?.pipe(process.stderr);
    }
    return child;
  });
};

export interface ReconcileDependencies {
  exec: typeof execAndLog;
  writeFile: typeof fs.writeFileSync;
  getGitOrigin: typeof tryGetGitOrigin;
  generateAccessYaml: typeof generateAccessYaml;
  createAccessYaml: typeof createAccessYaml;
  createRepositoryComponent: typeof createRepositoryComponent;
  configureChartForRing: typeof configureChartForRing;
  createServiceComponent: typeof createServiceComponent;
  createRingComponent: typeof createRingComponent;
  addChartToRing: typeof addChartToRing;
  createStaticComponent: typeof createStaticComponent;
  createIngressRouteForRing: typeof createIngressRouteForRing;
  createMiddlewareForRing: typeof createMiddlewareForRing;
}

/**
 * Normalizes the provided service name to a DNS-1123 and Fabrikate command safe
 * name.
 * All non-alphanumerics and non-dashes are converted to dashes
 */
export const normalizedName = (name: string): string => {
  return dns.replaceIllegalCharacters(name).replace(/\./g, "-");
};

export const execute = async (
  repositoryName: string,
  hldPath: string,
  bedrockApplicationRepoPath: string,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  try {
    validateInputs(repositoryName, hldPath, bedrockApplicationRepoPath);
    checkForFabrikate(shelljs.which);

    const absHldPath = testAndGetAbsPath(
      shelljs.test,
      logger.info,
      hldPath,
      "HLD"
    );

    const absBedrockPath = testAndGetAbsPath(
      shelljs.test,
      logger.info,
      bedrockApplicationRepoPath,
      "Bedrock Application"
    );

    const bedrockConfig = Bedrock(absBedrockPath);
    bedrock.validateRings(bedrockConfig);

    logger.info(
      `Attempting to reconcile HLD with services tracked in bedrock.yaml`
    );

    const reconcileDependencies: ReconcileDependencies = {
      addChartToRing,
      configureChartForRing,
      createAccessYaml,
      createIngressRouteForRing,
      createMiddlewareForRing,
      createRepositoryComponent,
      createRingComponent,
      createServiceComponent,
      createStaticComponent,
      exec: execAndLog,
      generateAccessYaml,
      getGitOrigin: tryGetGitOrigin,
      writeFile: fs.writeFileSync,
    };

    await reconcileHld(
      reconcileDependencies,
      bedrockConfig,
      repositoryName,
      absHldPath,
      absBedrockPath
    );
    await exitFn(0);
  } catch (err) {
    logger.error(`An error occurred while reconciling HLD`);
    logger.error(err);
    await exitFn(1);
  }
};

export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(
    async (
      repositoryName: string,
      hldPath: string,
      bedrockApplicationRepoPath: string
    ) => {
      // command will ensure that repositoryName,
      // hldPath and bedrockApplicationRepoPath are string type.
      await execute(
        repositoryName,
        hldPath,
        bedrockApplicationRepoPath,
        async (status: number) => {
          await exitCmd(logger, process.exit, status);
        }
      );
    }
  );
};

export const reconcileHld = async (
  dependencies: ReconcileDependencies,
  bedrockYaml: BedrockFile,
  repositoryName: string,
  absHldPath: string,
  absBedrockPath: string
): Promise<void> => {
  const { services: managedServices, rings: managedRings } = bedrockYaml;

  // Create Repository Component if it doesn't exist.
  // In a pipeline, the repository component is the name of the application repository.
  await dependencies.createRepositoryComponent(
    dependencies.exec,
    absHldPath,
    normalizedName(repositoryName)
  );

  // Repository in HLD ie /path/to/hld/repositoryName/
  const normalizedAbsRepositoryInHldPath = path.join(
    absHldPath,
    normalizedName(repositoryName)
  );

  // Create access.yaml containing the bedrock application repo's URL
  await dependencies.createAccessYaml(
    dependencies.getGitOrigin,
    dependencies.generateAccessYaml,
    absBedrockPath,
    normalizedAbsRepositoryInHldPath
  );

  for (const [serviceRelPath, serviceConfig] of Object.entries(
    managedServices
  )) {
    const serviceName =
      serviceConfig.displayName || path.basename(serviceRelPath);

    // No name, cannot generate proper routes and middlewares
    if (serviceName === "." || !serviceName) {
      logger.warn(
        "Service displayName not provided or service path is `.` - not reconciling service"
      );
      continue;
    }

    const normalizedSvcName = normalizedName(serviceName);
    logger.info(`Reconciling service: ${normalizedSvcName}`);

    // If the service utilizes `git` for its helm-chart, add to access.yaml
    const helmChartConfig = serviceConfig.helm.chart;
    if ("git" in helmChartConfig && helmChartConfig.git !== "") {
      // Ensure accessToken is a non-zero length string or undefined
      const accessToken = helmChartConfig.accessTokenVariable || undefined;
      logger.info(
        `Git repository found in helm configuration of ${serviceName} -- adding to access.yaml`
      );
      dependencies.generateAccessYaml(
        normalizedAbsRepositoryInHldPath,
        helmChartConfig.git,
        accessToken
      );
    }

    // Utilizes fab add, which is idempotent.
    await dependencies.createServiceComponent(
      dependencies.exec,
      normalizedAbsRepositoryInHldPath,
      normalizedSvcName
    );

    // Create ring components.
    const normalizedSvcPathInHld = path.join(
      normalizedAbsRepositoryInHldPath,
      normalizedSvcName
    );

    const ringsToCreate = Object.entries(managedRings).map(
      ([ring, { isDefault }]) => {
        const normalizedRingName = normalizedName(ring);
        return {
          isDefault: !!isDefault,
          normalizedRingName,
          normalizedRingPathInHld: path.join(
            normalizedSvcPathInHld,
            normalizedRingName
          ),
        };
      }
    );

    // Will only loop over _existing_ rings in bedrock.yaml - does not cover the deletion case, ie: i remove a ring from bedrock.yaml
    for (const ring of ringsToCreate) {
      const { normalizedRingName, normalizedRingPathInHld, isDefault } = ring;
      // Create the ring in the service.
      await dependencies.createRingComponent(
        dependencies.exec,
        normalizedSvcPathInHld,
        normalizedRingName
      );

      // Add the helm chart to the ring.
      await dependencies.addChartToRing(
        dependencies.exec,
        normalizedRingPathInHld,
        serviceConfig
      );

      // Add configuration for the service and ring name.
      await dependencies.configureChartForRing(
        dependencies.exec,
        normalizedRingPathInHld,
        normalizedRingName,
        serviceConfig
      );

      // Service explicitly requests no ingress-routes to be generated.
      if (serviceConfig.disableRouteScaffold) {
        logger.info(
          `Skipping ingress route generation for service ${serviceName}`
        );
        continue;
      }

      // Create config directory, create static manifest directory.
      await dependencies.createStaticComponent(
        dependencies.exec,
        normalizedRingPathInHld
      );

      // Calculate shared path for both IngressRoute and Middleware
      const ingressVersionAndPath = getFullPathPrefix(
        serviceConfig.pathPrefixMajorVersion || "",
        serviceConfig.pathPrefix || "",
        normalizedSvcName
      );

      // Create Strip Prefix Middleware.
      const middlewares = dependencies.createMiddlewareForRing(
        normalizedRingPathInHld,
        normalizedSvcName,
        normalizedRingName,
        ingressVersionAndPath,
        isDefault
      );

      // Create Ingress Route.
      dependencies.createIngressRouteForRing(
        normalizedRingPathInHld,
        normalizedSvcName,
        serviceConfig,
        middlewares,
        normalizedRingName,
        ingressVersionAndPath,
        isDefault
      );
    }
  }
};

/**
 * Build and return the full path prefix used for IngressRoutes and Middlewares
 * @param majorVersion
 * @param pathPrefix
 * @param serviceName
 */
export const getFullPathPrefix = (
  majorVersion: string,
  pathPrefix: string,
  serviceName: string
): string => {
  const versionPath = majorVersion ? `/${majorVersion}` : "";
  const servicePath = pathPrefix || serviceName;

  return `${versionPath}/${servicePath}`;
};

/**
 * Runs a command via `exec` and captures the results.
 * stdio is piped directly to parent, so outputs is streamed live as the child
 * process runs.
 *
 * @param commandToRun String version of the command that must be run
 * @throws {child_process.ExecException}
 */
export const execAndLog = async (commandToRun: string): Promise<ExecResult> => {
  logger.info(`Running: ${commandToRun}`);
  const pipeOutputToCurrentShell = true;
  const result = await exec(commandToRun, pipeOutputToCurrentShell);
  if (result.error) {
    logger.error(`an error occurred executing command: \`${commandToRun}\``);
    throw result.error;
  }
  return result;
};

export const createAccessYaml = async (
  getGitOrigin: typeof tryGetGitOrigin,
  writeAccessYaml: typeof generateAccessYaml,
  absBedrockApplicationPath: string,
  absRepositoryPathInHldPath: string
): Promise<void> => {
  const originUrl = await getGitOrigin(absBedrockApplicationPath);

  logger.info(
    `Writing access.yaml for ${originUrl} to ${absRepositoryPathInHldPath}`
  );

  writeAccessYaml(absRepositoryPathInHldPath, originUrl);
};

type MiddlewareMap<T = Partial<ReturnType<typeof middleware.create>>> = {
  ringed: T;
  default?: T;
};

export const createIngressRouteForRing = (
  ringPathInHld: string,
  serviceName: string,
  serviceConfig: BedrockServiceConfig,
  middlewares: MiddlewareMap,
  ring: string,
  ingressVersionAndPath: string,
  ringIsDefault = false
): ReturnType<typeof ingressRoute.create>[] => {
  const staticComponentPathInRing = path.join(ringPathInHld, "static");
  const ingressRoutePathInStaticComponent = path.join(
    staticComponentPathInRing,
    "ingress-route.yaml"
  );

  // Push the default ingress route with ring header
  const ingressRoutes = [];
  const ringedRoute = ingressRoute.create(
    serviceName,
    ring,
    serviceConfig.k8sBackendPort,
    ingressVersionAndPath,
    {
      isDefault: false,
      k8sBackend: serviceConfig.k8sBackend,
      middlewares: [
        middlewares.ringed.metadata?.name,
        ...(serviceConfig.middlewares ?? []),
      ].filter((e): e is NonNullable<typeof e> => !!e),
    }
  );
  ingressRoutes.push(ringedRoute);

  // If ring isDefault, scaffold an additional ingress route without the ring
  // header -- i.e with an empty string ring name
  if (ringIsDefault) {
    const defaultRingRoute = ingressRoute.create(
      serviceName,
      ring,
      serviceConfig.k8sBackendPort,
      ingressVersionAndPath,
      {
        isDefault: ringIsDefault,
        k8sBackend: serviceConfig.k8sBackend,
        middlewares: [
          middlewares.default?.metadata?.name,
          ...(serviceConfig.middlewares ?? []),
        ].filter((e): e is NonNullable<typeof e> => !!e),
      }
    );
    ingressRoutes.push(defaultRingRoute);
  }

  // serialize to routes to yaml separately and join them with `---` to specify
  // multiple yaml documents in a single string
  const routeYaml = ingressRoutes
    .map((str) => {
      return yaml.safeDump(str, {
        lineWidth: Number.MAX_SAFE_INTEGER,
      });
    })
    .join("\n---\n");

  logger.info(
    `Writing IngressRoute YAML to '${ingressRoutePathInStaticComponent}'`
  );

  fs.writeFileSync(ingressRoutePathInStaticComponent, routeYaml);
  return ingressRoutes;
};

export const createMiddlewareForRing = (
  ringPathInHld: string,
  serviceName: string,
  ring: string,
  ingressVersionAndPath: string,
  ringIsDefault = false
): MiddlewareMap => {
  // Create Middlewares
  const staticComponentPathInRing = path.join(ringPathInHld, "static");
  const middlewaresPathInStaticComponent = path.join(
    staticComponentPathInRing,
    "middlewares.yaml"
  );

  // Create the standard ringed middleware as well as one without the ring in
  // the name if the ring isDefault
  const middlewares = {
    ringed: middleware.create(serviceName, ring, [ingressVersionAndPath]),
    default: ringIsDefault
      ? middleware.create(serviceName, "", [ingressVersionAndPath])
      : undefined,
  };

  // Serialize all the middlewares to yaml separately and join the strings with
  // '---' to specify multiple yaml docs in a single string
  const middlewareYaml = Object.values(middlewares)
    .filter((e): e is NonNullable<typeof e> => !!e)
    .map((str) =>
      yaml.safeDump(str, {
        lineWidth: Number.MAX_SAFE_INTEGER,
      })
    )
    .join("\n---\n");

  logger.info(
    `Writing Middlewares YAML to '${middlewaresPathInStaticComponent}'`
  );
  fs.writeFileSync(middlewaresPathInStaticComponent, middlewareYaml);

  return middlewares;
};

export const createRepositoryComponent = async (
  execCmd: typeof execAndLog,
  absHldPath: string,
  repositoryName: string
): Promise<ExecResult> => {
  assertIsStringWithContent(absHldPath, "hld-path");
  assertIsStringWithContent(repositoryName, "repository-name");

  return execCmd(
    `cd ${absHldPath} && mkdir -p ${repositoryName} && fab add ${repositoryName} --path ./${repositoryName} --method local`
  ).catch((err) => {
    logger.error(
      `error creating repository component '${repositoryName}' in path '${absHldPath}'`
    );
    throw err;
  });
};

export const createServiceComponent = async (
  execCmd: typeof execAndLog,
  absRepositoryInHldPath: string,
  serviceName: string
): Promise<ExecResult> => {
  // Fab add is idempotent.
  // mkdir -p does not fail if ${pathBase} does not exist.
  assertIsStringWithContent(absRepositoryInHldPath, "project-path");
  assertIsStringWithContent(serviceName, "service-name");

  return execCmd(
    `cd ${absRepositoryInHldPath} && mkdir -p ${serviceName} config && fab add ${serviceName} --path ./${serviceName} --method local --type component && touch ./config/common.yaml`
  ).catch((err) => {
    logger.error(
      `error creating service component '${serviceName}' in path '${absRepositoryInHldPath}'`
    );
    throw err;
  });
};

export const createRingComponent = async (
  execCmd: typeof execAndLog,
  svcPathInHld: string,
  normalizedRingName: string
): Promise<ExecResult> => {
  assertIsStringWithContent(svcPathInHld, "service-path");
  assertIsStringWithContent(normalizedRingName, "ring-name");
  const createRingInSvcCommand = `cd ${svcPathInHld} && mkdir -p ${normalizedRingName} config && fab add ${normalizedRingName} --path ./${normalizedRingName} --method local --type component && touch ./config/common.yaml`;

  return execCmd(createRingInSvcCommand).catch((err) => {
    logger.error(
      `error creating ring component '${normalizedRingName}' in path '${svcPathInHld}'`
    );
    throw err;
  });
};

export const addChartToRing = async (
  execCmd: typeof execAndLog,
  ringPathInHld: string,
  serviceConfig: BedrockServiceConfig
): Promise<ExecResult> => {
  let addHelmChartCommand = "";
  const { chart } = serviceConfig.helm;
  if ("git" in chart) {
    let chartVersioning = "";
    if ("branch" in chart) {
      assertIsStringWithContent(chart.branch, "git-branch");
      chartVersioning = `--branch ${chart.branch}`;
    } else {
      assertIsStringWithContent(chart.sha, "git-sha");
      chartVersioning = `--version ${chart.sha}`;
    }
    assertIsStringWithContent(chart.git, "git-url");
    assertIsStringWithContent(chart.path, "git-path");
    addHelmChartCommand = `fab add chart --source ${chart.git} --path ${chart.path} ${chartVersioning} --type helm`;
  } else if ("repository" in chart) {
    assertIsStringWithContent(chart.repository, "helm-repo");
    assertIsStringWithContent(chart.chart, "helm-chart-name");
    addHelmChartCommand = `fab add chart --source ${chart.repository} --path ${chart.chart} --type helm`;
  }

  return execCmd(`cd ${ringPathInHld} && ${addHelmChartCommand}`).catch(
    (err) => {
      logger.error(
        `error adding helm chart for service-config ${JSON.stringify(
          serviceConfig
        )} to ring path '${ringPathInHld}'`
      );
      throw err;
    }
  );
};

export const configureChartForRing = async (
  execCmd: (commandToRun: string) => Promise<ExecResult>,
  normalizedRingPathInHld: string,
  normalizedRingName: string,
  serviceConfig: BedrockServiceConfig
): Promise<ExecResult> => {
  // Configue the k8s backend svc here along with master
  const k8sBackendName = serviceConfig.k8sBackend || "";
  const k8sSvcBackendAndName = [
    normalizedName(k8sBackendName),
    normalizedRingName,
  ].join("-");

  const fabConfigureCommand = `cd ${normalizedRingPathInHld} && fab set --subcomponent "chart" serviceName="${k8sSvcBackendAndName}"`;

  return execCmd(fabConfigureCommand).catch((err) => {
    logger.error(`error configuring helm chart for service `);
    throw err;
  });
};

export const createStaticComponent = async (
  execCmd: typeof execAndLog,
  ringPathInHld: string
): Promise<ExecResult> => {
  assertIsStringWithContent(ringPathInHld, "ring-path");
  const createConfigAndStaticComponentCommand = `cd ${ringPathInHld} && mkdir -p config static && fab add static --path ./static --method local --type static && touch ./config/common.yaml`;

  return execCmd(createConfigAndStaticComponentCommand).catch((err) => {
    logger.error(`error creating static component in path '${ringPathInHld}'`);
    throw err;
  });
};

export const validateInputs = (
  repositoryName: string,
  hldPath: string,
  bedrockApplicationRepoPath: string
): void => {
  assertIsStringWithContent(repositoryName, "repository-name");
  assertIsStringWithContent(hldPath, "hld-path");
  assertIsStringWithContent(
    bedrockApplicationRepoPath,
    "bedrock-application-repo-path"
  );
};

export const testAndGetAbsPath = (
  test: (flags: TestOptions, path: string) => boolean,
  log: (logline: string) => void,
  possiblyRelativePath: string,
  pathType: string
): string => {
  const absPath = path.resolve(possiblyRelativePath);
  if (!test("-e", absPath) && !test("-d", absPath)) {
    throw Error(`Could not validate ${pathType} path.`);
  }
  log(`Found ${pathType} at ${absPath}`);
  return absPath;
};

export const checkForFabrikate = (which: (path: string) => string): void => {
  const fabrikateInstalled = which("fab");
  if (fabrikateInstalled === "") {
    throw ReferenceError(
      `Fabrikate not installed. Please fetch and install the latest version: https://github.com/microsoft/fabrikate/releases`
    );
  }
};
