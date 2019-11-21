import commander from "commander";

import {
  generateDefaultHldComponentYaml,
  generateGitIgnoreFile,
  generateHldAzurePipelinesYaml
} from "../../lib/fileutils";
import { checkoutCommitPushCreatePRLink } from "../../lib/gitutils";
import { logger } from "../../logger";

/**
 * Adds the init command to the hld command object
 *
 * @param command Commander command object to decorate
 */
export const initCommandDecorator = (command: commander.Command): void => {
  command
    .command("init")
    .alias("i")
    .description(
      "Initialize your hld repository. Will add the manifest-generation.yaml file to your working directory/repository if it does not already exist."
    )
    .option(
      "--git-push",
      "SPK CLI will try to commit and push these changes to a new origin/branch.",
      false
    )
    .action(async opts => {
      const { gitPush = false } = opts;
      const projectPath = process.cwd();
      try {
        // Type check all parsed command line args here.
        if (typeof gitPush !== "boolean") {
          throw new Error(
            `gitPush must be of type boolean, ${typeof gitPush} given.`
          );
        }
        await initialize(projectPath, gitPush);
      } catch (err) {
        logger.error(
          `Error occurred while initializing hld repository ${projectPath}`
        );
        logger.error(err);
      }
    });
};

export const initialize = async (rootProjectPath: string, gitPush: boolean) => {
  // Create azure-pipelines.yaml for hld repository, if required.
  logger.info("Initializing bedrock HLD repository.");

  generateHldAzurePipelinesYaml(rootProjectPath);
  generateDefaultHldComponentYaml(rootProjectPath);
  // Create .gitignore file in directory ignoring spk.log, if one doesn't already exist.
  generateGitIgnoreFile(rootProjectPath, "spk.log");

  // If requested, create new git branch, commit, and push
  if (gitPush) {
    const newBranchName = "spk-hld-init";
    const directory = ".";
    await checkoutCommitPushCreatePRLink(newBranchName, directory);
  }
};
