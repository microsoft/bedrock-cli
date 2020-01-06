import child_process from "child_process";
import commander from "commander";
import { writeFileSync } from "fs";
import yaml from "js-yaml";
import path from "path";
import process from "process";
import shelljs from "shelljs";
import { promisify } from "util";
import { Bedrock } from "../../config";
import { TraefikIngressRoute } from "../../lib/traefik/ingress-route";
import { TraefikMiddleware } from "../../lib/traefik/middleware";
import { logger } from "../../logger";

const exec = promisify(child_process.exec);

import { IBedrockFile } from "../../types";

export const reconcileHldDecorator = (command: commander.Command): void => {
  command
    .command(
      "reconcile <repository-name> <hld-path> <bedrock-application-repo-path>"
    )
    .alias("r")
    .description("Reconcile a HLD with the services tracked in bedrock.yaml.")
    .action(async (repositoryName, hldPath, bedrockApplicationRepoPath) => {
      try {
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

        const fabrikateInstalled = shelljs.which("fab");

        if (fabrikateInstalled === "") {
          throw new Error(
            `Error: Fabrikate not installed. Please fetch and install the latest version: https://github.com/microsoft/fabrikate/releases`
          );
        }

        const absHldPath = path.resolve(hldPath);

        if (
          !shelljs.test("-e", absHldPath) &&
          !shelljs.test("-d", absHldPath)
        ) {
          throw new Error("Error: could not validate hld path.");
        }

        logger.info(`Found HLD at ${absHldPath}`);

        const absBedrockPath = path.resolve(bedrockApplicationRepoPath);

        if (
          !shelljs.test("-e", absBedrockPath) &&
          !shelljs.test("-d", absBedrockPath)
        ) {
          throw new Error(
            "Error: could not validate bedrock application path."
          );
        }

        logger.info(`Found bedrock application at ${absHldPath}`);
        const bedrockConfig = Bedrock(absBedrockPath);

        logger.info(
          `Attempting to reconcile HLD with services tracked in bedrock.yaml`
        );
        await reconcileHld(bedrockConfig, repositoryName, absHldPath);
      } catch (err) {
        logger.error(`Error occurred while reconciling HLD`);
        logger.error(err);
        process.exit(1);
      }
    });
};

export const reconcileHld = async (
  bedrockYaml: IBedrockFile,
  repositoryName: string,
  absHldPath: string
) => {
  const managedServices = bedrockYaml.services;
  const managedRings = bedrockYaml.rings;

  // Create Repository Component if it doesn't exist.
  // In a pipeline, the repository component is the name of the application repository.
  const createRepositoryComponent = `cd ${absHldPath} && mkdir -p ${repositoryName} && fab add ${repositoryName} -- path ./${repositoryName} --method local`;

  await execAndLog(createRepositoryComponent);

  // Repository in HLD ie /path/to/hld/repositoryName/
  const absRepositoryInHldPath = path.join(absHldPath, repositoryName);

  for (const [serviceRelPath, serviceConfig] of Object.entries(
    managedServices
  )) {
    const pathBase = path.basename(serviceRelPath);
    const serviceName = pathBase;
    logger.info(`Reconciling service: ${pathBase}`);

    // Fab add is idempotent.
    // mkdir -p does not fail if ${pathBase} does not exist.
    const createSvcInHldCommand = `cd ${absRepositoryInHldPath} && mkdir -p ${pathBase} config && fab add ${pathBase} --path ./${pathBase} --method local --type component && touch ./config/common.yaml`;

    await execAndLog(createSvcInHldCommand);

    // No rings
    if (!managedRings) {
      continue;
    }

    // Create ring components.
    const svcPathInHld = path.join(absRepositoryInHldPath, pathBase);
    for (const ring of Object.keys(managedRings)) {
      const ringPathInHld = path.join(svcPathInHld, ring);

      // If the ring component already exists, we do not attempt to create it.
      if (
        shelljs.test("-e", ringPathInHld) &&
        shelljs.test("-d", ringPathInHld)
      ) {
        logger.info(
          `Ring component: ${ring} already exists, skipping ring generation.`
        );
        continue;
      }

      // Otherwise, create the ring in the service.
      const createRingInSvcCommand = `cd ${svcPathInHld} && mkdir -p ${ring} config && fab add ${ring} --path ./${ring} --method local --type component && touch ./config/common.yaml`;

      await execAndLog(createRingInSvcCommand);

      let addHelmChartCommand = "";
      const { chart } = serviceConfig.helm;
      if ("git" in chart) {
        const chartVersioning =
          "branch" in chart
            ? `--branch ${chart.branch}`
            : `--version ${chart.sha}`;
        addHelmChartCommand = `fab add chart --source ${chart.git} --path ${chart.path} ${chartVersioning}`;
      } else if ("repository" in chart) {
        addHelmChartCommand = `fab add chart --source ${chart.repository} --path ${chart.chart}`;
      }

      await execAndLog(`cd ${ringPathInHld} && ${addHelmChartCommand}`);

      // Create config directory, crate static manifest directory.
      const createConfigAndStaticComponentCommand = `cd ${ringPathInHld} && mkdir -p config static && fab add static --path ./static --method local --type static && touch ./config/common.yaml`;

      await execAndLog(createConfigAndStaticComponentCommand);

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

      // Create Ingress Route.
      const ingressRoutePathInStaticComponent = path.join(
        staticComponentPathInRing,
        "ingress-route.yaml"
      );
      // TODO: figure out a way to grab the port from _somewhere_; store in bedrock.yaml?
      const ingressRoute = TraefikIngressRoute(serviceName, ring, 8000, {
        middlewares: [
          middlewares.metadata.name,
          ...(serviceConfig.middlewares ?? [])
        ]
      });
      const routeYaml = yaml.safeDump(ingressRoute, {
        lineWidth: Number.MAX_SAFE_INTEGER
      });

      logger.info(
        `Writing IngressRoute YAML to ${ingressRoutePathInStaticComponent}`
      );
      writeFileSync(ingressRoutePathInStaticComponent, routeYaml);
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
const execAndLog = async (commandToRun: string) => {
  logger.info(`Running: ${commandToRun}`);
  const commandResult = await exec(commandToRun);
  logger.info(commandResult.stdout);

  if (commandResult.stderr) {
    logger.error(commandResult.stderr);
    throw Error(
      `Error occurred when invoking command: ${commandResult.stderr}`
    );
  }
};
