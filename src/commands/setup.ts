import commander from "commander";
import fs from "fs";
import yaml from "js-yaml";
import { defaultConfigFile } from "../config";
import { getWebApi } from "../lib/azdoClient";
import { build as buildCmd, exit as exitCmd } from "../lib/commandBuilder";
import { createProjectIfNotExist } from "../lib/setup/projectService";
import {
  DEFAULT_PROJECT_NAME,
  getAnswerFromFile,
  IAnswer,
  prompt
} from "../lib/setup/prompt";
import { logger } from "../logger";
import decorator from "./setup.decorator.json";

interface ICommandOptions {
  file: string | undefined;
}

/**
 * Creates SPK config file under `user-home/.spk` folder
 *
 * @param answers Answers provided to the commander
 */
export const createSPKConfig = (answers: IAnswer) => {
  const data = yaml.safeDump({
    azure_devops: {
      access_token: answers.azdo_pat,
      org: answers.azdo_org_name,
      project: answers.azdo_project_name
    }
  });
  fs.writeFileSync(defaultConfigFile(), data);
};

/**
 * Executes the command, can all exit function with 0 or 1
 * when command completed successfully or failed respectively.
 *
 * @param opts option value from commander
 * @param exitFn exit function
 */
export const execute = async (
  opts: ICommandOptions,
  exitFn: (status: number) => Promise<void>
) => {
  try {
    const answers = opts.file ? getAnswerFromFile(opts.file) : await prompt();

    createSPKConfig(answers!);
    const webAPI = await getWebApi();
    const coreAPI = await webAPI.getCoreApi();

    await createProjectIfNotExist(coreAPI, answers);
    await exitFn(0);
  } catch (err) {
    if (err.statusCode === 401) {
      logger.error(
        `Authentication Failed. Make sure that the organization name and access token are correct; or your access token may have expired.`
      );
    } else if (err.message && err.message.indexOf("VS402392") !== -1) {
      logger.error(
        `Project, ${DEFAULT_PROJECT_NAME} might be deleted less than 28 days ago. Choose a different project name.`
      );
    } else {
      logger.error(err);
    }
    await exitFn(1);
  }
};

/**
 * Adds the init command to the commander command object
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: ICommandOptions) => {
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
