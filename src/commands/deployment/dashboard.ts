import commander from "commander";
import open = require("open");
import { env } from "shelljs";
import { exec } from "../../lib/shell";
import { logger } from "../../logger";
import { validatePrereqs } from "../infra/vaildate";
import { config } from "../init";

/**
 * Adds the onboard command to the commander command object
 * @param command Commander command object to decorate
 */
export const dashboardCommandDecorator = (command: commander.Command): void => {
  command
    .command("dashboard")
    .alias("d")
    .description("Launch the service introspection dashboard")
    .option("-p, --port <port>", "Port to launch the dashboard on", 4040)
    .action(async opts => {
      if (
        !config.introspection ||
        !config.azure_devops ||
        !config.azure_devops.org ||
        !config.azure_devops.project ||
        !config.introspection.azure ||
        !config.introspection.azure.key ||
        !config.introspection.azure.account_name ||
        !config.introspection.azure.table_name ||
        !config.introspection.azure.partition_key
      ) {
        logger.error(
          "You need to specify configuration for your introspection storage account and DevOps pipeline to run this dashboard. Please initialize the spk tool with the right configuration"
        );
        return;
      }
      if (await launchDashboard(opts.port)) {
        await open("http://localhost:" + opts.port);
      }
    });
};

export const launchDashboard = async (port: number): Promise<string> => {
  try {
    if (!(await validatePrereqs(["docker"], false))) {
      return "";
    }
    const dockerRepository = config.introspection!.dashboard!.image!;
    logger.info("Pulling dashboard docker image");
    await exec("docker", ["pull", dockerRepository]);
    logger.info("Launching dashboard on http://localhost:" + port);
    const containerId = await exec("docker", [
      "run",
      "-d",
      "--rm",
      ...getEnvVars(),
      "-p",
      port + ":80",
      dockerRepository
    ]);
    return containerId;
  } catch (err) {
    logger.error(`Error occurred while launching dashboard ${err}`);
    return "";
  }
};

const getEnvVars = (): string[] => {
  const envVars = [];
  envVars.push("-e");
  envVars.push("REACT_APP_PIPELINE_ORG=" + config.azure_devops!.org!);
  envVars.push("-e");
  envVars.push("REACT_APP_PIPELINE_PROJECT=" + config.azure_devops!.project!);
  envVars.push("-e");
  envVars.push(
    "REACT_APP_STORAGE_ACCOUNT_NAME=" +
      config.introspection!.azure!.account_name!
  );
  envVars.push("-e");
  envVars.push(
    "REACT_APP_STORAGE_PARTITION_KEY=" +
      config.introspection!.azure!.partition_key!
  );
  envVars.push("-e");
  envVars.push(
    "REACT_APP_STORAGE_TABLE_NAME=" + config.introspection!.azure!.table_name!
  );
  envVars.push("-e");
  envVars.push(
    "REACT_APP_STORAGE_ACCESS_KEY=" + config.introspection!.azure!.key!
  );
  if (config.azure_devops!.access_token) {
    envVars.push("-e");
    envVars.push(
      "REACT_APP_PIPELINE_ACCESS_TOKEN=" + config.azure_devops!.access_token
    );
  }

  return envVars;
};
