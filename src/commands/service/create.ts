import commander from "commander";
import path from "path";
import shelljs from "shelljs";
import { BedrockAsync } from "../../config";
import {
  addNewServiceToBedrockFile,
  addNewServiceToMaintainersFile,
  generateDockerfile,
  generateGitIgnoreFile,
  generateStarterAzurePipelinesYaml
} from "../../lib/fileutils";
import { checkoutCommitPushCreatePRLink } from "../../lib/gitutils";
import { logger } from "../../logger";
import { IHelmConfig, IUser } from "../../types";

/**
 * Adds the create command to the service command object
 *
 * @param command Commander command object to decorate
 */
export const createCommandDecorator = (command: commander.Command): void => {
  command
    .command("create <service-name>")
    .alias("c")
    .description(
      "Add a new service into this initialized spk project repository"
    )
    .option(
      "-c, --helm-chart-chart <helm-chart>",
      "bedrock helm chart name. --helm-chart-* and --helm-config-* are exclusive; you may only use one.",
      ""
    )
    .option(
      "-r, --helm-chart-repository <helm-repository>",
      "bedrock helm chart repository. --helm-chart-* and --helm-config-* are exclusive; you may only use one.",
      ""
    )
    .option(
      "-b, --helm-config-branch <helm-branch>",
      "bedrock custom helm chart configuration branch. --helm-chart-* and --helm-config-* are exclusive; you may only use one.",
      ""
    )
    .option(
      "-p, --helm-config-path <helm-path>",
      "bedrock custom helm chart configuration path. --helm-chart-* and --helm-config-* are exclusive; you may only use one.",
      ""
    )
    .option(
      "-g, --helm-config-git <helm-git>",
      "bedrock helm chart configuration git repository. --helm-chart-* and --helm-config-* are exclusive; you may only use one.",
      ""
    )
    .option(
      "-d, --packages-dir <dir>",
      "The directory containing the mono-repo packages.",
      ""
    )
    .option(
      "-n, --display-name <display-name>",
      "Display name of the service.",
      ""
    )
    .option(
      "-m, --maintainer-name <maintainer-name>",
      "The name of the primary maintainer for this service.",
      "maintainer name"
    )
    .option(
      "-e, --maintainer-email <maintainer-email>",
      "The email of the primary maintainer for this service.",
      "maintainer email"
    )
    .option(
      "--git-push",
      "SPK CLI will try to commit and push these changes to a new origin/branch named after the service.",
      false
    )
    .option(
      "--variable-group-name <variable-group-name>",
      "The Azure DevOps Variable Group.",
      undefined
    )
    .option(
      "--middlewares <comma-delimitated-list-of-middleware-names>",
      "Traefik2 middlewares you wish to to be injected into your Traefik2 IngressRoutes",
      ""
    )
    .action(async (serviceName, opts) => {
      const bedrock = await BedrockAsync().catch(err => {
        logger.warn(err);
        return undefined;
      });
      const {
        displayName,
        helmChartChart,
        helmChartRepository,
        helmConfigBranch,
        helmConfigPath,
        helmConfigGit,
        packagesDir,
        maintainerName,
        maintainerEmail,
        middlewares,
        gitPush
      } = opts;
      const variableGroupName =
        opts.variableGroupName ?? (bedrock?.variableGroups ?? [])[0] ?? ""; // fall back to bedrock.yaml when <variable-group-name> argument is not specified; default to empty string

      const projectPath = process.cwd();
      try {
        if (
          !isValidConfig(
            helmChartChart,
            helmChartRepository,
            helmConfigBranch,
            helmConfigGit,
            helmConfigPath,
            serviceName,
            packagesDir,
            maintainerName,
            maintainerEmail,
            middlewares,
            gitPush,
            variableGroupName,
            displayName
          )
        ) {
          throw Error(`Invalid configuration provided`);
        }

        await createService(projectPath, serviceName, packagesDir, gitPush, {
          displayName,
          helmChartChart,
          helmChartRepository,
          helmConfigBranch,
          helmConfigGit,
          helmConfigPath,
          maintainerEmail,
          maintainerName,
          middlewares: (middlewares as string)
            .split(",")
            .map(str => str.trim()),
          variableGroups:
            variableGroupName.length > 0 ? [variableGroupName] : []
        });
      } catch (err) {
        logger.error(
          `Error occurred adding service ${serviceName} to project ${projectPath}`
        );
        logger.error(err);
        process.exit(1);
      }
    });
};

/**
 * Validates the pipeline configuration
 * @param helmChartChart Helm chart chart
 * @param helmChartRepository  Helm chart repository
 * @param helmConfigBranch Helm chart branch
 * @param helmConfigGit Helm git
 * @param helmConfigPath Helm config path
 * @param serviceName Service name
 * @param packagesDir Packages directory
 * @param maintainerName Name of maintainer
 * @param maintainerEmail Email of maintainer
 * @param middlewares comma-delimitated list of Traefik2 middlewares
 * @param gitPush Push to git
 * @param variableGroupName Variable group name
 */
export const isValidConfig = (
  helmChartChart: any,
  helmChartRepository: any,
  helmConfigBranch: any,
  helmConfigGit: any,
  helmConfigPath: any,
  serviceName: any,
  packagesDir: any,
  maintainerName: any,
  maintainerEmail: any,
  middlewares: any,
  gitPush: any,
  variableGroupName: any,
  displayName: any
): boolean => {
  const missingConfig = [];

  // Type check all parsed command line args here.
  if (typeof helmChartChart !== "string") {
    missingConfig.push(
      `helmChartChart must be of type 'string', ${typeof helmChartChart} given.`
    );
  }
  if (typeof helmChartRepository !== "string") {
    missingConfig.push(
      `helmChartRepository must be of type 'string', ${typeof helmChartRepository} given.`
    );
  }
  if (typeof helmConfigBranch !== "string") {
    missingConfig.push(
      `helmConfigBranch must be of type 'string', ${typeof helmConfigBranch} given.`
    );
  }
  if (typeof helmConfigGit !== "string") {
    missingConfig.push(
      `helmConfigGit must be of type 'string', ${typeof helmConfigGit} given.`
    );
  }
  if (typeof helmConfigPath !== "string") {
    missingConfig.push(
      `helmConfigPath must be of type 'string', ${typeof helmConfigPath} given.`
    );
  }
  if (typeof serviceName !== "string") {
    missingConfig.push(
      `serviceName must be of type 'string', ${typeof serviceName} given.`
    );
  }
  if (typeof displayName !== "string") {
    missingConfig.push(
      `displayName must be of type 'string', ${typeof displayName} given.`
    );
  }
  if (typeof packagesDir !== "string") {
    missingConfig.push(
      `packagesDir must be of type 'string', ${typeof packagesDir} given.`
    );
  }
  if (typeof maintainerName !== "string") {
    missingConfig.push(
      `maintainerName must be of type 'string', ${typeof maintainerName} given.`
    );
  }
  if (typeof maintainerEmail !== "string") {
    missingConfig.push(
      `maintainerEmail must be of type 'string', ${typeof maintainerEmail} given.`
    );
  }
  if (typeof middlewares !== "string") {
    missingConfig.push(
      `middlewares must be of type of 'string', ${typeof middlewares} given.`
    );
  }
  if (typeof gitPush !== "boolean") {
    missingConfig.push(
      `gitPush must be of type 'boolean', ${typeof gitPush} given.`
    );
  }
  if (typeof variableGroupName !== "string") {
    missingConfig.push(
      `variableGroupName must be of type 'string', ${typeof variableGroupName} given.`
    );
  }

  if (missingConfig.length > 0) {
    logger.error("Error in configuration: " + missingConfig.join(" "));
    return false;
  }

  return true;
};

/**
 * Create a service in a bedrock project directory.
 *
 * @param rootProjectPath
 * @param serviceName
 * @param opts
 */
export const createService = async (
  rootProjectPath: string,
  serviceName: string,
  packagesDir: string,
  gitPush: boolean,
  opts?: {
    displayName?: string;
    helmChartChart?: string;
    helmChartRepository?: string;
    helmConfigBranch?: string;
    helmConfigGit?: string;
    helmConfigPath?: string;
    maintainerEmail?: string;
    maintainerName?: string;
    variableGroups?: string[];
    middlewares?: string[];
  }
) => {
  const {
    displayName = "",
    helmChartChart = "",
    helmChartRepository = "",
    helmConfigBranch = "",
    helmConfigPath = "",
    helmConfigGit = "",
    maintainerName = "",
    maintainerEmail = "",
    middlewares = [],
    variableGroups = []
  } = opts ?? {};

  logger.info(
    `Adding Service: ${serviceName}, to Project: ${rootProjectPath} under directory: ${packagesDir}`
  );
  logger.info(
    `DisplayName: ${displayName}, MaintainerName: ${maintainerName}, MaintainerEmail: ${maintainerEmail}`
  );

  const newServiceDir = path.join(rootProjectPath, packagesDir, serviceName);
  logger.info(`servicePath: ${newServiceDir}`);

  // Mkdir
  shelljs.mkdir("-p", newServiceDir);

  // Create azure pipelines yaml in directory
  await generateStarterAzurePipelinesYaml(rootProjectPath, newServiceDir, {
    variableGroups
  });

  // Create empty .gitignore file in directory
  generateGitIgnoreFile(newServiceDir, "");

  // Create simple Dockerfile in directory
  generateDockerfile(newServiceDir);

  // add maintainers to file in parent repo file
  const newUser = {
    email: maintainerEmail,
    name: maintainerName
  } as IUser;

  const newServiceRelativeDir = path.relative(rootProjectPath, newServiceDir);
  logger.debug(`newServiceRelPath: ${newServiceRelativeDir}`);

  addNewServiceToMaintainersFile(
    path.join(rootProjectPath, "maintainers.yaml"),
    newServiceRelativeDir,
    [newUser]
  );

  // Add relevant bedrock info to parent bedrock.yaml

  let helmConfig: IHelmConfig;
  if (helmChartChart && helmChartRepository) {
    helmConfig = {
      chart: {
        chart: helmChartChart,
        repository: helmChartRepository
      }
    };
  } else {
    helmConfig = {
      chart: {
        branch: helmConfigBranch,
        git: helmConfigGit,
        path: helmConfigPath
      }
    };
  }

  addNewServiceToBedrockFile(
    path.join(rootProjectPath, "bedrock.yaml"),
    newServiceRelativeDir,
    displayName,
    helmConfig,
    middlewares
  );

  // If requested, create new git branch, commit, and push
  if (gitPush) {
    await checkoutCommitPushCreatePRLink(
      serviceName,
      newServiceDir,
      path.join(rootProjectPath, "bedrock.yaml"),
      path.join(rootProjectPath, "maintainers.yaml")
    );
  }
};
