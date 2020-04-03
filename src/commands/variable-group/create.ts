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
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";

interface CommandOptions {
  file: string | undefined;
  orgName: string | undefined;
  devopsProject: string | undefined;
  personalAccessToken: string | undefined;
}

export const validateValues = (opts: CommandOptions): void => {
  if (!opts.file) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "variable-group-create-cmd-err-file-missing"
    );
  }
  const config = Config();
  const azure = config.azure_devops;

  if (!hasValue(opts.orgName) && !azure?.org) {
    throw buildError(errorStatusCode.VALIDATION_ERR, {
      errorKey: "variable-group-create-cmd-err-org-missing",
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      values: [getCmdOption(decorator, "org-name")!.arg],
    });
  }

  if (hasValue(opts.orgName)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    validateOrgNameThrowable(opts.orgName!);
  }

  if (!hasValue(opts.devopsProject) && !azure?.project) {
    throw buildError(errorStatusCode.VALIDATION_ERR, {
      errorKey: "variable-group-create-cmd-err-project-missing",
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      values: [getCmdOption(decorator, "devops-project")!.arg],
    });
  }

  if (hasValue(opts.devopsProject)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    validateProjectNameThrowable(opts.devopsProject!);
  }

  if (!hasValue(opts.personalAccessToken) && !azure?.access_token) {
    throw buildError(errorStatusCode.VALIDATION_ERR, {
      errorKey: "variable-group-create-cmd-err-access-token",
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      values: [getCmdOption(decorator, "personal-access-token")!.arg],
    });
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      logError(
        buildError(
          errorStatusCode.CMD_EXE_ERR,
          "variable-group-create-cmd-failed"
        )
      );
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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    throw buildError(errorStatusCode.EXE_FLOW_ERR, {
      errorKey: "variable-group-create-cmd-err-create",
      values: [data.type],
    });
  }
};
