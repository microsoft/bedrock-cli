import commander from "commander";

import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import {
  generateDefaultHldComponentYaml,
  generateGitIgnoreFile,
  generateHldAzurePipelinesYaml
} from "../../lib/fileutils";
import { checkoutCommitPushCreatePRLink } from "../../lib/gitutils";
import { hasValue } from "../../lib/validator";
import { logger } from "../../logger";
import decorator from "./init.decorator.json";

// values that we need to pull out from command operator
interface ICommandOptions {
  gitPush: boolean;
}

export const execute = async (
  projectPath: string,
  gitPush: boolean,
  exitFn: (status: number) => Promise<void>
) => {
  try {
    if (!hasValue(projectPath)) {
      throw new Error("project path is not provided");
    }
    await initialize(projectPath, gitPush);
    await exitFn(0);
  } catch (err) {
    logger.error(
      `Error occurred while initializing hld repository ${projectPath}`
    );
    logger.error(err);
    await exitFn(1);
  }
};

export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: ICommandOptions) => {
    const projectPath = process.cwd();
    // gitPush will is always true or false. It shall not be
    // undefined because default value is set in the commander decorator
    await execute(projectPath, opts.gitPush, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};

export const initialize = async (rootProjectPath: string, gitPush: boolean) => {
  // Create manifest-generation.yaml for hld repository, if required.
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
