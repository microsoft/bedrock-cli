import commander from "commander";
import path from "path";
import process from "process";
import shelljs from "shelljs";

import { Bedrock } from "../../config";
import { logger } from "../../logger";

import child_process from "child_process";
import { writeFileSync } from "fs";
import yaml from "js-yaml";
import { promisify } from "util";

import { TraefikIngressRoute } from "../../lib/traefik/ingress-route";

const exec = promisify(child_process.exec);

import { IBedrockFile } from "../../types";

export const reconcileHldDecorator = (command: commander.Command): void => {
  command
    .command("reconcile <repository-name> <hld-path>")
    .alias("r")
    .description("Reconcile a HLD with the services tracked in bedrock.yaml.")
    .action(async (repositoryName, hldPath) => {
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
          throw new Error(
            "Error: could not validate bedrock yaml or hld path."
          );
        }

        logger.info(`Found HLD at ${absHldPath}`);
        const bedrockConfig = Bedrock();

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
  const createRepositoryComponent = `cd ${absHldPath} && mkdir -p ${repositoryName} && fab add ${repositoryName} -- source ./${repositoryName} --method local`;

  await execAndLog(createRepositoryComponent);

  // Repository in HLD ie /path/to/hld/repositoryName/
  const absRepositoryInHldPath = path.join(absHldPath, repositoryName);

  for (const serviceRelPath of Object.keys(managedServices)) {
    const pathBase = path.basename(serviceRelPath);
    const serviceName = pathBase;
    logger.info(`Reconciling service: ${pathBase}`);
    const helmConfig = managedServices[serviceRelPath];

    // Fab add is idempotent.
    // mkdir -p does not fail if ${pathBase} does not exist.
    const createSvcInHldCommand = `cd ${absRepositoryInHldPath} && mkdir -p ${pathBase} config && fab add ${pathBase} --source ./${pathBase} --method local`;

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
      const createRingInSvcCommand = `cd ${svcPathInHld} && mkdir -p ${ring} config && fab add ${ring} --source ./${ring} --method local`;

      await execAndLog(createRingInSvcCommand);

      let addHelmChartCommand = "";
      if (helmConfig.helm.chart.method === "git") {
        // TODO: git sha
        addHelmChartCommand = `fab add chart --source ${helmConfig.helm.chart.git} --path ${helmConfig.helm.chart.path}`;
      } else {
        addHelmChartCommand = `fab add chart --source ${helmConfig.helm.chart.repository} --path ${helmConfig.helm.chart.chart}`;
      }

      await execAndLog(addHelmChartCommand);

      // Create config directory, crate static manifest directory.
      const createConfigAndStaticComponentCommand = `cd ${ringPathInHld} && mkdir -p config static && fab add static --source ./static --method local --type static`;

      await execAndLog(createConfigAndStaticComponentCommand);

      // Create Ingress Route.
      const staticComponentPathInRing = path.join(ringPathInHld, "static");
      const ingressRoutePathInStaticComponent = path.join(
        staticComponentPathInRing,
        "ingress-route.yaml"
      );

      // TODO: figure out a way to grab the port from _somewhere_; store in bedrock.yaml?
      const ingressRoute = TraefikIngressRoute(serviceName, ring, 8000);
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
    throw new Error(
      `Error occurred when invoking commmand: ${commandResult.stderr}`
    );
  }
};
