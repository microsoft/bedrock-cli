import commander from "commander";
import fs from "fs";
import yaml from "js-yaml";
import { defaultConfigFile } from "../config";
import { getWebApi } from "../lib/azdoClient";
import { build as buildCmd, exit as exitCmd } from "../lib/commandBuilder";
import { IRequestContext, WORKSPACE } from "../lib/setup/constants";
import { createDirectory } from "../lib/setup/fsUtil";
import { getGitApi } from "../lib/setup/gitService";
import { createProjectIfNotExist } from "../lib/setup/projectService";
import { getAnswerFromFile, prompt } from "../lib/setup/prompt";
import { hldRepo, manifestRepo } from "../lib/setup/scaffold";
import { create as createSetupLog } from "../lib/setup/setupLog";
import { logger } from "../logger";
import decorator from "./setup.decorator.json";

interface ICommandOptions {
  file: string | undefined;
}

interface IAPIError {
  message: string;
  statusCode: number;
}

/**
 * Creates SPK config file under `user-home/.spk` folder
 *
 * @param answers Answers provided to the commander
 */
export const createSPKConfig = (rc: IRequestContext) => {
  const data = yaml.safeDump({
    azure_devops: {
      access_token: rc.accessToken,
      org: rc.orgName,
      project: rc.projectName
    }
  });
  fs.writeFileSync(defaultConfigFile(), data);
};

export const getErrorMessage = (
  rc: IRequestContext | undefined,
  err: Error | IAPIError
) => {
  if (rc) {
    if (err.message && err.message.indexOf("VS402392") !== -1) {
      return `Project, ${
        rc!.projectName
      } might have been deleted less than 28 days ago. Choose a different project name.`;
    }
    if (!(err instanceof Error) && err.statusCode && err.statusCode === 401) {
      return `Authentication Failed. Make sure that the organization name and access token are correct; or your access token may have expired.`;
    }
  }
  return err.toString();
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
  // tslint:disable-next-line: no-unnecessary-initializer
  let requestContext: IRequestContext | undefined = undefined;

  try {
    requestContext = opts.file ? getAnswerFromFile(opts.file) : await prompt();
    createDirectory(WORKSPACE, true);

    createSPKConfig(requestContext!);
    const webAPI = await getWebApi();
    const coreAPI = await webAPI.getCoreApi();
    const gitAPI = await getGitApi(webAPI);

    await createProjectIfNotExist(coreAPI, requestContext);
    await hldRepo(gitAPI, requestContext);
    await manifestRepo(gitAPI, requestContext);

    createSetupLog(requestContext);
    await exitFn(0);
  } catch (err) {
    const msg = getErrorMessage(requestContext, err);

    // requestContext will not be created if input validation failed
    if (requestContext) {
      requestContext.error = msg;
    }
    createSetupLog(requestContext!);

    logger.error(msg);
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
