import child_process from "child_process";
import commander from "commander";
import { writeFileSync } from "fs";
import yaml from "js-yaml";
import path from "path";
import process from "process";
import shelljs, { TestOptions } from "shelljs";
import { promisify } from "util";
import { Bedrock } from "../../config";
import { TraefikIngressRoute } from "../../lib/traefik/ingress-route";
import {
  ITraefikMiddleware,
  TraefikMiddleware
} from "../../lib/traefik/middleware";
import { logger } from "../../logger";

const exec = promisify(child_process.exec);

import { IBedrockFile, IBedrockServiceConfig } from "../../types";

export interface IReconcileDependencies {
  exec: (commandToRun: string) => Promise<void>;

  writeFile: (path: string, contents: string) => void;

  test: (option: shelljs.TestOptions, path: string) => boolean;

  createRepositoryComponent: (
    execCmd: (commandToRun: string) => Promise<void>,
    absHldPath: string,
    repositoryName: string
  ) => Promise<void>;

  createServiceComponent: (
    execCmd: (commandToRun: string) => Promise<void>,
    absRepositoryInHldPath: string,
    pathBase: string
  ) => Promise<void>;

  createRingComponent: (
    execCmd: (commandToRun: string) => Promise<void>,
    svcPathInHld: string,
    ring: string
  ) => Promise<void>;

  addChartToRing: (
    execCmd: (commandToRun: string) => Promise<void>,
    ringPathInHld: string,
    serviceConfig: IBedrockServiceConfig
  ) => Promise<void>;

  createStaticComponent: (
    execCmd: (commandToRun: string) => Promise<void>,
    ringPathInHld: string
  ) => Promise<void>;

  createIngressRouteForRing: (
    ringPathInHld: string,
    serviceName: string,
    serviceConfig: IBedrockServiceConfig,
    middlewares: ITraefikMiddleware,
    ring: string
  ) => void;

  createMiddlewareForRing: (
    ringPathInHld: string,
    serviceName: string,
    ring: string
  ) => ITraefikMiddleware;
}

export const reconcileHldDecorator = (command: commander.Command): void => {
  command
    .command(
      "reconcile <repository-name> <hld-path> <bedrock-application-repo-path>"
    )
    .alias("r")
    .description("Reconcile a HLD with the services tracked in bedrock.yaml.")
    .action(async (repositoryName, hldPath, bedrockApplicationRepoPath) => {
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

        logger.info(
          `Attempting to reconcile HLD with services tracked in bedrock.yaml`
        );

        const reconcileDependencies: IReconcileDependencies = {
          addChartToRing,
          createIngressRouteForRing,
          createMiddlewareForRing,
          createRepositoryComponent,
          createRingComponent,
          createServiceComponent,
          createStaticComponent,
          exec: execAndLog,
          test: shelljs.test,
          writeFile: writeFileSync
        };

        await reconcileHld(
          reconcileDependencies,
          bedrockConfig,
          repositoryName,
          absHldPath
        );
      } catch (err) {
        logger.error(`An error occurred while reconciling HLD`);
        logger.error(err);
        process.exit(1);
      }
    });
};

export const reconcileHld = async (
  dependencies: IReconcileDependencies,
  bedrockYaml: IBedrockFile,
  repositoryName: string,
  absHldPath: string
) => {
  const managedServices = bedrockYaml.services;
  const managedRings = bedrockYaml.rings;

  // Create Repository Component if it doesn't exist.
  // In a pipeline, the repository component is the name of the application repository.
  await dependencies.createRepositoryComponent(
    dependencies.exec,
    absHldPath,
    repositoryName
  );

  // Repository in HLD ie /path/to/hld/repositoryName/
  const absRepositoryInHldPath = path.join(absHldPath, repositoryName);

  for (const [serviceRelPath, serviceConfig] of Object.entries(
    managedServices
  )) {
    const pathBase = path.basename(serviceRelPath);
    const serviceName = pathBase;
    logger.info(`Reconciling service: ${pathBase}`);

    // Utilizes fab add, which is idempotent.
    await dependencies.createServiceComponent(
      dependencies.exec,
      absRepositoryInHldPath,
      pathBase
    );

    // No rings
    if (!managedRings) {
      continue;
    }

    // Create ring components.
    const svcPathInHld = path.join(absRepositoryInHldPath, pathBase);

    // Will only loop over _existing_ rings in bedrock.yaml - does not cover the deletion case, ie: i remove a ring from bedrock.yaml
    for (const ring of Object.keys(managedRings)) {
      const ringPathInHld = path.join(svcPathInHld, ring);

      // If the ring component already exists, we do not attempt to create it.
      if (
        dependencies.test("-e", ringPathInHld) && // path exists
        dependencies.test("-d", ringPathInHld) // path is a directory
      ) {
        logger.info(
          `Ring component: ${ring} already exists, skipping ring generation.`
        );
        continue;
      }

      // Otherwise, create the ring in the service.
      await dependencies.createRingComponent(
        dependencies.exec,
        svcPathInHld,
        ring
      );

      // Add the helm chart to the ring.
      await dependencies.addChartToRing(
        dependencies.exec,
        ringPathInHld,
        serviceConfig
      );

      // Create config directory, create static manifest directory.
      await dependencies.createStaticComponent(
        dependencies.exec,
        ringPathInHld
      );

      // Service explicitly requests no ingress-routes to be generated.
      if (serviceConfig.disableRouteScaffold) {
        logger.info(
          `Skipping ingress route generation for service ${serviceName}`
        );
        continue;
      }

      // Create middleware.
      const middlewares = dependencies.createMiddlewareForRing(
        ringPathInHld,
        serviceName,
        ring
      );

      // Create Ingress Route.
      dependencies.createIngressRouteForRing(
        ringPathInHld,
        serviceName,
        serviceConfig,
        middlewares,
        ring
      );
    }
  }
};

/**
 * Runs a command via `exec` and captures the results, logging the command
 * that will be run, and the results of that command.
 *
 * @param commandToRun String version of the command that must be run
 * @throws An Error containing the logs captured from stderr
 */
export const execAndLog = async (commandToRun: string) => {
  logger.info(`Running: ${commandToRun}`);
  const commandResult = await exec(commandToRun);
  logger.info(commandResult.stdout);

  if (commandResult.stderr) {
    logger.error(commandResult.stderr);
    throw Error(
      `An error occurred when invoking command: ${commandResult.stderr}`
    );
  }
};

const createIngressRouteForRing = (
  ringPathInHld: string,
  serviceName: string,
  serviceConfig: IBedrockServiceConfig,
  middlewares: ITraefikMiddleware,
  ring: string
) => {
  const staticComponentPathInRing = path.join(ringPathInHld, "static");
  const ingressRoutePathInStaticComponent = path.join(
    staticComponentPathInRing,
    "ingress-route.yaml"
  );
  const ingressRoute = TraefikIngressRoute(
    serviceName,
    ring,
    serviceConfig.k8sServicePort,
    {
      middlewares: [
        middlewares.metadata.name,
        ...(serviceConfig.middlewares ?? [])
      ]
    }
  );

  const routeYaml = yaml.safeDump(ingressRoute, {
    lineWidth: Number.MAX_SAFE_INTEGER
  });

  logger.info(
    `Writing IngressRoute YAML to ${ingressRoutePathInStaticComponent}`
  );

  writeFileSync(ingressRoutePathInStaticComponent, routeYaml);
};

const createMiddlewareForRing = (
  ringPathInHld: string,
  serviceName: string,
  ring: string
): ITraefikMiddleware => {
  // Create Middlewares
  const staticComponentPathInRing = path.join(ringPathInHld, "static");
  const middlewaresPathInStaticComponent = path.join(
    staticComponentPathInRing,
    "middlewares.yaml"
  );

  const servicePrefix = `/${serviceName}`;
  const middlewares = TraefikMiddleware(serviceName, ring, [servicePrefix]);
  const middlewareYaml = yaml.safeDump(middlewares, {
    lineWidth: Number.MAX_SAFE_INTEGER
  });

  logger.info(
    `Writing Middlewares YAML to ${middlewaresPathInStaticComponent}`
  );
  writeFileSync(middlewaresPathInStaticComponent, middlewareYaml);

  return middlewares;
};

export const createRepositoryComponent = async (
  execCmd: (commandToRun: string) => Promise<void>,
  absHldPath: string,
  repositoryName: string
) => {
  await execCmd(
    `cd ${absHldPath} && mkdir -p ${repositoryName} && fab add ${repositoryName} --path ./${repositoryName} --method local`
  );
};

export const createServiceComponent = async (
  execCmd: (commandToRun: string) => Promise<void>,
  absRepositoryInHldPath: string,
  pathBase: string
) => {
  // Fab add is idempotent.
  // mkdir -p does not fail if ${pathBase} does not exist.
  await execCmd(
    `cd ${absRepositoryInHldPath} && mkdir -p ${pathBase} config && fab add ${pathBase} --path ./${pathBase} --method local --type component && touch ./config/common.yaml`
  );
};

export const createRingComponent = async (
  execCmd: (commandToRun: string) => Promise<void>,
  svcPathInHld: string,
  ring: string
) => {
  const createRingInSvcCommand = `cd ${svcPathInHld} && mkdir -p ${ring} config && fab add ${ring} --path ./${ring} --method local --type component && touch ./config/common.yaml`;
  await execCmd(createRingInSvcCommand);
};

export const addChartToRing = async (
  execCmd: (commandToRun: string) => Promise<void>,
  ringPathInHld: string,
  serviceConfig: IBedrockServiceConfig
) => {
  let addHelmChartCommand = "";
  const { chart } = serviceConfig.helm;
  if ("git" in chart) {
    const chartVersioning =
      "branch" in chart ? `--branch ${chart.branch}` : `--version ${chart.sha}`;
    addHelmChartCommand = `fab add chart --source ${chart.git} --path ${chart.path} ${chartVersioning}`;
  } else if ("repository" in chart) {
    addHelmChartCommand = `fab add chart --source ${chart.repository} --path ${chart.chart}`;
  }

  await execCmd(`cd ${ringPathInHld} && ${addHelmChartCommand}`);
};

export const createStaticComponent = async (
  execCmd: (commandToRun: string) => {},
  ringPathInHld: string
) => {
  const createConfigAndStaticComponentCommand = `cd ${ringPathInHld} && mkdir -p config static && fab add static --path ./static --method local --type static && touch ./config/common.yaml`;
  await execCmd(createConfigAndStaticComponentCommand);
};

export const validateInputs = (
  repositoryName: any,
  hldPath: any,
  bedrockApplicationRepoPath: any
) => {
  if (typeof repositoryName !== "string") {
    throw new Error(
      `repository-name must be of type 'string', ${typeof repositoryName} given`
    );
  }

  if (typeof hldPath !== "string") {
    throw new Error(
      `hld-path must be of type 'string', ${typeof hldPath} given`
    );
  }

  if (typeof bedrockApplicationRepoPath !== "string") {
    throw new Error(
      `bedrock-application-repo-path must be of type 'string', ${typeof bedrockApplicationRepoPath} given`
    );
  }
};

export const testAndGetAbsPath = (
  test: (flags: TestOptions, path: string) => boolean,
  log: (logline: string) => void,
  possiblyRelativePath: string,
  pathType: string
): string => {
  const absPath = path.resolve(possiblyRelativePath);
  if (!test("-e", absPath) && !test("-d", absPath)) {
    throw new Error(`Could not validate ${pathType} path.`);
  }
  log(`Found ${pathType} at ${absPath}`);
  return absPath;
};

export const checkForFabrikate = (which: (path: string) => string) => {
  const fabrikateInstalled = which("fab");
  if (fabrikateInstalled === "") {
    throw new Error(
      `Fabrikate not installed. Please fetch and install the latest version: https://github.com/microsoft/fabrikate/releases`
    );
  }
};
