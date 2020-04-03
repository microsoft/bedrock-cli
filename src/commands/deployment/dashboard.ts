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
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";

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

export interface DashboardConfig {
  port: number;
  image: string;
  org: string;
  project: string;
  key: string;
  accountName: string;
  tableName: string;
  partitionKey: string;
  accessToken?: string;
  sourceRepoAccessToken?: string;
  manifestRepository?: string;
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
): DashboardConfig => {
  if (opts.port) {
    if (!isPortNumberString(opts.port)) {
      throw buildError(
        errorStatusCode.VALIDATION_ERR,
        "introspect-dashboard-cmd-invalid-port"
      );
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
    !config.introspection.azure.partition_key ||
    !config.introspection.dashboard ||
    !config.introspection.dashboard.image
  ) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "introspect-dashboard-cmd-missing-vals"
    );
  }

  return {
    port: parseInt(opts.port, 10),
    image: config.introspection.dashboard.image,
    org: config.azure_devops.org,
    project: config.azure_devops.project,
    key: config.introspection.azure.key,
    accountName: config.introspection.azure.account_name,
    tableName: config.introspection.azure.table_name,
    partitionKey: config.introspection.azure.partition_key,
    accessToken: config.azure_devops.access_token,
    sourceRepoAccessToken: config.introspection.azure.source_repo_access_token,
    manifestRepository: config.azure_devops.manifest_repository,
  };
};

/**
 * Cleans previously launched spk dashboard docker containers
 */
export const cleanDashboardContainers = async (
  config: DashboardConfig
): Promise<void> => {
  try {
    let dockerOutput = await exec("docker", [
      "ps",
      "-a",
      "-q",
      "--filter",
      "ancestor=" + config.image,
      '--format="{{.ID}}"',
    ]);
    if (dockerOutput.length > 0) {
      dockerOutput = dockerOutput.replace(/\n/g, " ");
      dockerOutput = dockerOutput.replace(/"/g, "");
      const containerIds = dockerOutput.split(" ");
      const args = ["kill", ...containerIds];

      await exec("docker", args);
    }
  } catch (err) {
    throw buildError(
      errorStatusCode.DOCKER_ERR,
      "introspect-dashboard-cmd-kill-docker-container",
      err
    );
  }
};

/**
 * Extracts the necessary information from the config for
 * `azure_devops.manifest_repository` which is required to fetch cluster sync
 * information on dashboard
 */
export const extractManifestRepositoryInformation = (
  config: DashboardConfig
): IntrospectionManifest | undefined => {
  if (config.manifestRepository) {
    const manifestRepoName = getRepositoryName(config.manifestRepository);

    const gitComponents = GitUrlParse(config.manifestRepository);
    if (gitComponents.resource === "github.com") {
      return {
        githubUsername: gitComponents.organization,
        manifestRepoName,
      };
    } else {
      return {
        manifestRepoName,
      };
    }
  }
  return undefined;
};

/**
 * Creates and returns an array of env vars that need to be passed into the
 * docker run command
 */
export const getEnvVars = async (
  config: DashboardConfig
): Promise<string[]> => {
  try {
    const envVars = [
      "-e",
      `REACT_APP_PIPELINE_ORG=${config.org}`,
      "-e",
      `REACT_APP_PIPELINE_PROJECT=${config.project}`,
      "-e",
      `REACT_APP_STORAGE_ACCOUNT_NAME=${config.accountName}`,
      "-e",
      `REACT_APP_STORAGE_PARTITION_KEY=${config.partitionKey}`,
      "-e",
      `REACT_APP_STORAGE_TABLE_NAME=${config.tableName}`,
      "-e",
      `REACT_APP_STORAGE_ACCESS_KEY=${config.key}`,
    ];

    if (config.accessToken) {
      envVars.push("-e");
      envVars.push(`REACT_APP_PIPELINE_ACCESS_TOKEN=${config.accessToken}`);

      if (!config.sourceRepoAccessToken) {
        envVars.push("-e");
        envVars.push(
          `REACT_APP_SOURCE_REPO_ACCESS_TOKEN=${config.accessToken}`
        );
        envVars.push("-e");
        envVars.push(`REACT_APP_MANIFEST_ACCESS_TOKEN=${config.accessToken}`);
      }
    } else {
      logger.warn(
        "Pipeline access token was not specified during init, dashboard may show empty results if pipelines are private"
      );
    }
    if (config.sourceRepoAccessToken) {
      envVars.push("-e");
      envVars.push(
        `REACT_APP_SOURCE_REPO_ACCESS_TOKEN=${config.sourceRepoAccessToken}`
      );
      envVars.push("-e");
      envVars.push(
        `REACT_APP_MANIFEST_ACCESS_TOKEN=${config.sourceRepoAccessToken}`
      );
    }

    const manifestRepo = extractManifestRepositoryInformation(config);
    if (manifestRepo) {
      envVars.push("-e");
      envVars.push(`REACT_APP_MANIFEST=${manifestRepo.manifestRepoName}`);
      if (manifestRepo.githubUsername) {
        envVars.push("-e");
        envVars.push(
          `REACT_APP_GITHUB_MANIFEST_USERNAME=${manifestRepo.githubUsername}`
        );
      }
    }

    return envVars;
  } catch (err) {
    throw buildError(
      errorStatusCode.ENV_SETTING_ERR,
      "introspect-dashboard-cmd-get-env",
      err
    );
  }
};

/**
 * Launches an instance of the spk dashboard
 *
 * @param port the port number to launch the dashboard
 * @param removeAll true to remove all previously launched instances of the dashboard
 */
export const launchDashboard = async (
  config: DashboardConfig,
  removeAll: boolean
): Promise<string> => {
  try {
    if (!validatePrereqs(["docker"], false)) {
      throw buildError(
        errorStatusCode.DOCKER_ERR,
        "introspect-dashboard-cmd-launch-pre-req-err"
      );
    }

    if (removeAll) {
      await cleanDashboardContainers(config);
    }

    const dockerRepository = config.image;
    logger.info("Pulling dashboard docker image");
    await exec("docker", ["pull", dockerRepository]);
    logger.info(`Launching dashboard on http://localhost:${config.port}`);
    const containerId = await exec("docker", [
      "run",
      "-d",
      "--rm",
      ...(await getEnvVars(config)),
      "-p",
      `${config.port}:5000`,
      dockerRepository,
    ]);
    return containerId;
  } catch (err) {
    throw buildError(
      errorStatusCode.DOCKER_ERR,
      "introspect-dashboard-cmd-launch-err",
      err
    );
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
    const config = validateValues(Config(), opts);

    if (await launchDashboard(config, opts.removeAll)) {
      await open(`http://localhost:${config.port}`);
    }
    await exitFn(0);
  } catch (err) {
    logError(
      buildError(
        errorStatusCode.CMD_EXE_ERR,
        "introspect-dashboard-cmd-failed",
        err
      )
    );
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
