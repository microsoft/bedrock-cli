/* eslint-disable @typescript-eslint/no-non-null-assertion */
import commander from "commander";
import GitUrlParse from "git-url-parse";
import open = require("open");
import { Config } from "../../config";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { getRepositoryName } from "../../lib/gitutils";
import { exec } from "../../lib/shell";
import { isPortNumberString, validatePrereqs } from "../../lib/validator";
import { logger } from "../../logger";
import { ConfigYaml } from "../../types";
import decorator from "./dashboard.decorator.json";

export interface IntrospectionManifest {
  githubUsername?: string;
  manifestRepoName: string;
}

/**
 * Command line option values from commander
 */
export interface CommandOptions {
  port: string;
  removeAll: boolean;
}

/**
 * Validates port and spk configuration
 *
 * @param config SPK Configuration
 * @param opts Command Line option values
 */
export const validateValues = (
  config: ConfigYaml,
  opts: CommandOptions
): void => {
  if (opts.port) {
    if (!isPortNumberString(opts.port)) {
      throw new Error("value for port option has to be a valid port number");
    }
  }

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
    throw new Error(
      "You need to specify configuration for your introspection storage account and DevOps pipeline to run this dashboard. Please initialize the spk tool with the right configuration"
    );
  }
};

/**
 * Cleans previously launched spk dashboard docker containers
 */
export const cleanDashboardContainers = async (
  config: ConfigYaml
): Promise<void> => {
  let dockerOutput = await exec("docker", [
    "ps",
    "-a",
    "-q",
    "--filter",
    "ancestor=" + config.introspection!.dashboard!.image!,
    '--format="{{.ID}}"'
  ]);
  if (dockerOutput.length > 0) {
    dockerOutput = dockerOutput.replace(/\n/g, " ");
    dockerOutput = dockerOutput.replace(/"/g, "");
    const containerIds = dockerOutput.split(" ");
    const args = ["kill", ...containerIds];

    await exec("docker", args);
  }
};

/**
 * Extracts the necessary information from the config for
 * `azure_devops.manifest_repository` which is required to fetch cluster sync
 * information on dashboard
 */
export const extractManifestRepositoryInformation = (
  config: ConfigYaml
): IntrospectionManifest | undefined => {
  const { azure_devops: azureDevops } = config;
  if (azureDevops!.manifest_repository) {
    const manifestRepoName = getRepositoryName(
      azureDevops!.manifest_repository
    );

    const gitComponents = GitUrlParse(azureDevops!.manifest_repository);
    if (gitComponents.resource === "github.com") {
      return {
        githubUsername: gitComponents.organization,
        manifestRepoName
      };
    } else {
      return {
        manifestRepoName
      };
    }
  }
  return undefined;
};

/**
 * Creates and returns an array of env vars that need to be passed into the
 * docker run command
 */
export const getEnvVars = async (config: ConfigYaml): Promise<string[]> => {
  const key = await config.introspection!.azure!.key;
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
  envVars.push("REACT_APP_STORAGE_ACCESS_KEY=" + key!);
  if (config.azure_devops!.access_token) {
    envVars.push("-e");
    envVars.push(
      "REACT_APP_PIPELINE_ACCESS_TOKEN=" + config.azure_devops!.access_token
    );

    if (!config.introspection!.azure!.source_repo_access_token) {
      envVars.push("-e");
      envVars.push(
        "REACT_APP_SOURCE_REPO_ACCESS_TOKEN=" +
          config.azure_devops!.access_token
      );
      envVars.push("-e");
      envVars.push(
        "REACT_APP_MANIFEST_ACCESS_TOKEN=" + config.azure_devops!.access_token
      );
    }
  } else {
    logger.warn(
      "Pipeline access token was not specified during init, dashboard may show empty results if pipelines are private"
    );
  }
  if (config.introspection!.azure!.source_repo_access_token) {
    envVars.push("-e");
    envVars.push(
      "REACT_APP_SOURCE_REPO_ACCESS_TOKEN=" +
        config.introspection!.azure!.source_repo_access_token
    );
    envVars.push("-e");
    envVars.push(
      "REACT_APP_MANIFEST_ACCESS_TOKEN=" +
        config.introspection!.azure!.source_repo_access_token
    );
  }

  const manifestRepo = extractManifestRepositoryInformation(config);
  if (manifestRepo) {
    envVars.push("-e");
    envVars.push("REACT_APP_MANIFEST=" + manifestRepo.manifestRepoName);
    if (manifestRepo.githubUsername) {
      envVars.push("-e");
      envVars.push(
        "REACT_APP_GITHUB_MANIFEST_USERNAME=" + manifestRepo.githubUsername
      );
    }
  }

  return envVars;
};

/**
 * Launches an instance of the spk dashboard
 *
 * @param port the port number to launch the dashboard
 * @param removeAll true to remove all previously launched instances of the dashboard
 */
export const launchDashboard = async (
  config: ConfigYaml,
  port: number,
  removeAll: boolean
): Promise<string> => {
  try {
    if (!validatePrereqs(["docker"], false)) {
      throw new Error("Requirements to launch dashboard are not met");
    }

    if (removeAll) {
      await cleanDashboardContainers(config);
    }

    const dockerRepository = config.introspection!.dashboard!.image!;
    logger.info("Pulling dashboard docker image");
    await exec("docker", ["pull", dockerRepository]);
    logger.info("Launching dashboard on http://localhost:" + port);
    const containerId = await exec("docker", [
      "run",
      "-d",
      "--rm",
      ...(await getEnvVars(config)),
      "-p",
      port + ":5000",
      dockerRepository
    ]);
    return containerId;
  } catch (err) {
    logger.error(`Error occurred while launching dashboard ${err}`);
    throw err;
  }
};

/**
 * Executes the command, can all exit function with 0 or 1
 * when command completed successfully or failed respectively.
 *
 * @param opts validated option values
 * @param exitFn exit function
 */
export const execute = async (
  opts: CommandOptions,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  try {
    const config = Config();
    validateValues(config, opts);
    const portNumber = parseInt(opts.port, 10);

    if (await launchDashboard(config, portNumber, opts.removeAll)) {
      await open("http://localhost:" + opts.port);
    }
    await exitFn(0);
  } catch (err) {
    logger.error(err);
    await exitFn(1);
  }
};

/**
 * Adds the onboard command to the commander command object
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: CommandOptions) => {
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
