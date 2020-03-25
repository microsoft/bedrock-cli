/* eslint-disable @typescript-eslint/no-use-before-define */
import commander from "commander";
import fs from "fs";
import path from "path";
import { Config, readYaml } from "../../config";
import {
  build as buildCmd,
  exit as exitCmd,
  getOption as getCmdOption,
} from "../../lib/commandBuilder";
import { AzureDevOpsOpts } from "../../lib/git";
import {
  addVariableGroup,
  addVariableGroupWithKeyVaultMap,
} from "../../lib/pipelines/variableGroup";
import {
  hasValue,
  validateProjectNameThrowable,
  validateOrgNameThrowable,
} from "../../lib/validator";
import { logger } from "../../logger";
import { VariableGroupData } from "../../types";
import decorator from "./create.decorator.json";

interface CommandOptions {
  file: string | undefined;
  orgName: string | undefined;
  devopsProject: string | undefined;
  personalAccessToken: string | undefined;
}

export const validateValues = (opts: CommandOptions): void => {
  if (!opts.file) {
    throw Error("You need to specify a file with variable group manifest");
  }
  const config = Config();
  const azure = config.azure_devops;

  if (!hasValue(opts.orgName) && !azure?.org) {
    throw Error(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      `value for ${getCmdOption(decorator, "org-name")!.arg} is missing`
    );
  }

  if (hasValue(opts.orgName)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    validateOrgNameThrowable(opts.orgName!);
  }

  if (!hasValue(opts.devopsProject) && !azure?.project) {
    throw Error(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      `value for ${getCmdOption(decorator, "devops-project")!.arg} is missing`
    );
  }

  if (hasValue(opts.devopsProject)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    validateProjectNameThrowable(opts.devopsProject!);
  }

  if (!hasValue(opts.personalAccessToken) && !azure?.access_token) {
    throw Error(
      `value for ${
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        getCmdOption(decorator, "personal-access-token")!.arg
      } is missing`
    );
  }
};

/**
 * Adds the create command to the variable-group command object
 *
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: CommandOptions) => {
    try {
      validateValues(opts);

      const accessOpts: AzureDevOpsOpts = {
        orgName: opts.orgName,
        personalAccessToken: opts.personalAccessToken,
        project: opts.devopsProject,
      };
      logger.debug(`access options: ${JSON.stringify(accessOpts)}`);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await create(opts.file!, accessOpts);

      logger.info(
        "Successfully added a variable group in Azure DevOps project!"
      );
      await exitCmd(logger, process.exit, 0);
    } catch (err) {
      logger.error(`Error occurred while creating variable group`);
      logger.error(err);
      await exitCmd(logger, process.exit, 1);
    }
  });
};

/**
 * Loads variable group manifest from a given filename
 *
 * @param filepath file to read manifest
 * @param accessOpts Azure DevOps access options from command options to override spk config
 */
export const create = async (
  filepath: string,
  accessOpts: AzureDevOpsOpts
): Promise<void> => {
  logger.info(
    `Creating Variable Group from group definition '${path.resolve(filepath)}'`
  );

  fs.statSync(filepath);
  const data = readYaml<VariableGroupData>(filepath);
  logger.debug(`Variable Group Yaml data: ${JSON.stringify(data)}`);

  // validate variable group type
  if (data.type === "AzureKeyVault") {
    await addVariableGroupWithKeyVaultMap(data, accessOpts);
  } else if (data.type === "Vsts") {
    await addVariableGroup(data, accessOpts);
  } else {
    throw new Error(
      `Variable Group type "${data.type}" is not supported. Only "Vsts" and "AzureKeyVault" are valid types and case sensitive.`
    );
  }
};
