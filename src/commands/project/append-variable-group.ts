import commander from "commander";
import {
  build as buildCmd,
  exit as exitCmd,
  populateInheritValueFromConfig,
  validateForRequiredValues,
} from "../../lib/commandBuilder";
import {
  hasValue,
  validateProjectNameThrowable,
  validateOrgNameThrowable,
} from "../../lib/validator";
import { Bedrock, Config } from "../../config";
import { logger } from "../../logger";
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";
import decorator from "./append-variable-group.decorator.json";
import { BedrockFileInfo, BedrockFile } from "../../types";
import * as bedrockYaml from "../../lib/bedrockYaml";
import { hasVariableGroup } from "../../lib/pipelines/variableGroup";
import { AzureDevOpsOpts } from "../../lib/git";
import { appendVariableGroupToPipelineYaml } from "../../lib/fileutils";
import { SERVICE_PIPELINE_FILENAME } from "../../lib/constants";

// Values that need to be pulled out from the command operator
export interface CommandOptions {
  orgName: string | undefined;
  personalAccessToken: string | undefined;
  devopsProject: string | undefined;
}

// Configuration values
interface ConfigValues {
  orgName: string;
  personalAccessToken: string;
  devopsProject: string;
}

/**
 * Validates values passed as options
 * @param opts The initialized options
 */
export const validateValues = (opts: CommandOptions): ConfigValues => {
  populateInheritValueFromConfig(decorator, Config(), opts);
  validateForRequiredValues(decorator, opts, true);

  // validateForRequiredValues already check required values
  // || "" is just to satisfy eslint rule.
  validateProjectNameThrowable(opts.devopsProject || "");
  validateOrgNameThrowable(opts.orgName || "");

  return {
    orgName: opts.orgName || "",
    personalAccessToken: opts.personalAccessToken || "",
    devopsProject: opts.devopsProject || "",
  };
};

/**
 * Check project dependencies
 * @param projectPath Path to the project directory
 */
export const checkDependencies = (projectPath: string): void => {
  const fileInfo: BedrockFileInfo = bedrockYaml.fileInfo(projectPath);
  if (fileInfo.exist === false) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "project-append-variable-group-cmd-err-bedrock-yaml-missing"
    );
  }
};

/**
 * Checks if a variable group exists in an Azure DevOps project
 * @param variableGroupName Variable Group Name
 * @param values The config values
 */
export const variableGroupExists = async (
  variableGroupName: string,
  values: ConfigValues
): Promise<boolean> => {
  const accessOpts: AzureDevOpsOpts = {
    orgName: values.orgName,
    personalAccessToken: values.personalAccessToken,
    project: values.devopsProject,
  };

  return await hasVariableGroup(accessOpts, variableGroupName);
};

/**
 * Update the variable groups for the project services
 * @param bedrockFile The bedrock.yaml file
 * @param variableGroupName Variable Group Name
 */
export const updateServicesVariableGroups = (
  bedrockFile: BedrockFile,
  variableGroupName: string
): void => {
  bedrockFile.services.forEach((service) => {
    const path = service.path;
    appendVariableGroupToPipelineYaml(
      path,
      SERVICE_PIPELINE_FILENAME,
      variableGroupName
    );
  });
};

/**
 * Executes the command.
 *
 * @param projectPath The path to the spk project
 * @param variableGroupName Variable Group Name
 * @param opts Option object from command
 * @param exitFn The exit function
 */
export const execute = async (
  projectPath: string,
  variableGroupName: string,
  opts: CommandOptions,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  try {
    if (!hasValue(variableGroupName)) {
      throw buildError(
        errorStatusCode.CMD_EXE_ERR,
        "project-append-variable-group-cmd-err-variable-group-missing"
      );
    }

    checkDependencies(projectPath);
    const values = validateValues(opts);

    if (!(await variableGroupExists(variableGroupName, values))) {
      throw buildError(errorStatusCode.CMD_EXE_ERR, {
        errorKey:
          "project-append-variable-group-cmd-err-variable-group-invalid",
        values: [variableGroupName, values.orgName, values.devopsProject],
      });
    }

    const bedrockFile = Bedrock(projectPath);
    bedrockYaml.addVariableGroup(bedrockFile, projectPath, variableGroupName);
    updateServicesVariableGroups(bedrockFile, variableGroupName);
    await exitFn(0);
  } catch (err) {
    logError(
      buildError(
        errorStatusCode.CMD_EXE_ERR,
        "project-append-variable-group-cmd-failed",
        err
      )
    );
    await exitFn(1);
  }
};

/**
 * Adds the init command to the commander command object
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(
    async (variableGroupName: string, opts: CommandOptions) => {
      const projectPath = process.cwd();
      await execute(
        projectPath,
        variableGroupName,
        opts,
        async (status: number) => {
          await exitCmd(logger, process.exit, status);
        }
      );
    }
  );
};
