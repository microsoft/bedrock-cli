import commander from "commander";
import path from "path";
import shelljs from "shelljs";
import { logger } from "../../logger";

import {
  addNewServiceToBedrockFile,
  addNewServiceToMaintainersFile,
  generateAzurePipelinesYaml,
  generateGitIgnoreFile
} from "../../lib/fileutils";
import {
  checkoutBranch,
  commitDir,
  deleteBranch,
  getCurrentBranch,
  getOriginUrl,
  getPullRequestLink,
  pushBranch
} from "../../lib/gitutils";
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
    .action(async (serviceName, opts) => {
      const {
        helmChartChart,
        helmChartRepository,
        helmConfigBranch,
        helmConfigPath,
        helmConfigGit,
        packagesDir,
        maintainerName,
        maintainerEmail,
        gitPush
      } = opts;
      const projectPath = process.cwd();

      try {
        // Type check all parsed command line args here.
        if (typeof helmChartChart !== "string") {
          throw new Error(
            `helmChartChart must be of type 'string', ${typeof helmChartChart} given.`
          );
        }
        if (typeof helmChartRepository !== "string") {
          throw new Error(
            `helmChartRepository must be of type 'string', ${typeof helmChartRepository} given.`
          );
        }
        if (typeof helmConfigBranch !== "string") {
          throw new Error(
            `helmConfigBranch must be of type 'string', ${typeof helmConfigBranch} given.`
          );
        }
        if (typeof helmConfigGit !== "string") {
          throw new Error(
            `helmConfigGit must be of type 'string', ${typeof helmConfigGit} given.`
          );
        }
        if (typeof helmConfigPath !== "string") {
          throw new Error(
            `helmConfigPath must be of type 'string', ${typeof helmConfigPath} given.`
          );
        }
        if (typeof serviceName !== "string") {
          throw new Error(
            `serviceName must be of type 'string', ${typeof serviceName} given.`
          );
        }
        if (typeof packagesDir !== "string") {
          throw new Error(
            `packagesDir must be of type 'string', ${typeof packagesDir} given.`
          );
        }
        if (typeof maintainerName !== "string") {
          throw new Error(
            `maintainerName must be of type 'string', ${typeof maintainerName} given.`
          );
        }
        if (typeof maintainerEmail !== "string") {
          throw new Error(
            `maintainerEmail must be of type 'string', ${typeof maintainerEmail} given.`
          );
        }
        if (typeof gitPush !== "boolean") {
          throw new Error(
            `gitPush must be of type 'boolean', ${typeof gitPush} given.`
          );
        }
        await createService(projectPath, serviceName, packagesDir, gitPush, {
          helmChartChart,
          helmChartRepository,
          helmConfigBranch,
          helmConfigGit,
          helmConfigPath,
          maintainerEmail,
          maintainerName
        });
      } catch (err) {
        logger.error(
          `Error occurred adding service ${serviceName} to project ${projectPath}`
        );
        logger.error(err);
      }
    });
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
    helmChartChart: string;
    helmChartRepository: string;
    helmConfigBranch: string;
    helmConfigGit: string;
    helmConfigPath: string;
    maintainerEmail: string;
    maintainerName: string;
  }
) => {
  const {
    helmChartChart,
    helmChartRepository,
    helmConfigBranch,
    helmConfigPath,
    helmConfigGit,
    maintainerName,
    maintainerEmail
  } = opts || {
    helmChartChart: "",
    helmChartRepository: "",
    helmConfigBranch: "",
    helmConfigGit: "",
    helmConfigPath: "",
    maintainerEmail: "",
    maintainerName: ""
  };

  logger.info(
    `Adding Service: ${serviceName}, to Project: ${rootProjectPath} under directory: ${packagesDir}`
  );
  logger.info(
    `MaintainerName: ${maintainerName}, MaintainerEmail: ${maintainerEmail}`
  );

  const newServiceDir = path.join(rootProjectPath, packagesDir, serviceName);
  logger.info(`servicePath: ${newServiceDir}`);

  // Mkdir
  shelljs.mkdir("-p", newServiceDir);

  // Create azure pipelines yaml in directory
  await generateAzurePipelinesYaml(rootProjectPath, newServiceDir);

  // Create empty .gitignore file in directory
  generateGitIgnoreFile(newServiceDir, "");

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
    helmConfig
  );

  // If requested, create new git branch, commit, and push
  if (gitPush) {
    try {
      const currentBranch = await getCurrentBranch();
      try {
        await checkoutBranch(serviceName, true);
        try {
          await commitDir(newServiceDir, serviceName);
          try {
            await pushBranch(serviceName);

            try {
              const pullRequestLink = await getPullRequestLink(
                currentBranch,
                serviceName,
                await getOriginUrl()
              );
              logger.info(`Link to create PR: ${pullRequestLink}`);
            } catch (e) {
              logger.error(
                `Could not create link for Pull Request. It will need to be done manually. ${e}`
              );
            }

            // Clean up
            try {
              await checkoutBranch(currentBranch, false);
              try {
                await deleteBranch(serviceName);
              } catch (e) {
                logger.error(
                  `Cannot delete new branch ${serviceName}. Cleanup will need to be done manually. ${e}`
                );
              }
            } catch (e) {
              logger.error(
                `Cannot checkout original branch ${currentBranch}. Clean up will need to be done manually. ${e}`
              );
            }
          } catch (e) {
            logger.error(
              `Cannot push branch ${serviceName}. Changes will have to be manually commited. ${e}`
            );
          }
        } catch (e) {
          logger.error(
            `Cannot commit changes in ${newServiceDir} to branch ${serviceName}. Changes will have to be manually commited. ${e}`
          );
        }
      } catch (e) {
        logger.error(
          `Cannot create and checkout new branch ${serviceName}. Changes will have to be manually commited. ${e}`
        );
      }
    } catch (e) {
      logger.error(
        `Cannot fetch current branch. Changes will have to be manually commited. ${e}`
      );
    }
  }
};
