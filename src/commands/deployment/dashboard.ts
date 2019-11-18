import commander from "commander";
import GitUrlParse from "git-url-parse";
import open = require("open");
import { Config } from "../../config";
import { getRepositoryName } from "../../lib/gitutils";
import { exec } from "../../lib/shell";
import { logger } from "../../logger";
import { validatePrereqs } from "../infra/validate";

export interface IIntrospectionManifest {
  githubUsername?: string;
  manifestRepoName: string;
}

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
    .option(
      "-r, --remove-all",
      "Removes previously launched instances of the dashboard",
      false
    )
    .action(async opts => {
      const config = Config();
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
      if (await launchDashboard(opts.port, opts.removeAll)) {
        await open("http://localhost:" + opts.port);
      }
    });
};

/**
 * Cleans previously launched spk dashboard docker containers
 */
export const cleanDashboarContainers = async () => {
  const config = Config();

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
 * Launches an instance of the spk dashboard
 * @param port the port number to launch the dashboard
 */
export const launchDashboard = async (
  port: number,
  removeAll: boolean
): Promise<string> => {
  try {
    if (!(await validatePrereqs(["docker"], false))) {
      return "";
    }
    // Clean previous dashboard containers
    if (removeAll) {
      await cleanDashboarContainers();
    }

    const config = Config();
    const dockerRepository = config.introspection!.dashboard!.image!;
    logger.info("Pulling dashboard docker image");
    await exec("docker", ["pull", dockerRepository]);
    logger.info("Launching dashboard on http://localhost:" + port);
    const containerId = await exec("docker", [
      "run",
      "-d",
      "--rm",
      ...(await getEnvVars()),
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

/**
 * Creates and returns an array of env vars that need to be passed into the
 * docker run command
 */
export const getEnvVars = async (): Promise<string[]> => {
  const config = Config();
  const key = await Config().introspection!.azure!.key;
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
  }

  const manifestRepo = extractManifestRepositoryInformation();
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
 * Extracts the necessary information from the config for
 * `azure_devops.manifest_repository` which is required to fetch cluster sync
 * information on dashboard
 */
export const extractManifestRepositoryInformation = ():
  | IIntrospectionManifest
  | undefined => {
  const { azure_devops } = Config();
  if (azure_devops!.manifest_repository) {
    const manifestRepoName = getRepositoryName(
      azure_devops!.manifest_repository
    );

    const gitComponents = GitUrlParse(azure_devops!.manifest_repository);
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
};
