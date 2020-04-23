import { VariableGroup } from "azure-devops-node-api/interfaces/ReleaseInterfaces";
import commander from "commander";
import path from "path";
import { echo } from "shelljs";
import { Bedrock, Config, readYaml, write } from "../../config";
import * as bedrockYaml from "../../lib/bedrockYaml";
import {
  build as buildCmd,
  exit as exitCmd,
  populateInheritValueFromConfig,
  validateForRequiredValues,
} from "../../lib/commandBuilder";
import { PROJECT_PIPELINE_FILENAME } from "../../lib/constants";
import { addVariableGroup } from "../../lib/pipelines/variableGroup";
import {
  hasValue,
  validateProjectNameThrowable,
  validateOrgNameThrowable,
} from "../../lib/validator";
import { logger } from "../../logger";
import {
  AzurePipelinesYaml,
  BedrockFileInfo,
  VariableGroupData,
  VariableGroupDataVariable,
} from "../../types";
import decorator from "./create-variable-group.decorator.json";
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";

// values that we need to pull out from command operator
export interface CommandOptions {
  registryName: string | undefined;
  servicePrincipalId: string | undefined;
  servicePrincipalPassword: string | undefined;
  tenant: string | undefined;
  hldRepoUrl: string | undefined;
  orgName: string | undefined;
  personalAccessToken: string | undefined;
  devopsProject: string | undefined;
}

interface ConfigValues {
  hldRepoUrl: string;
  orgName: string;
  personalAccessToken: string;
  devopsProject: string;
  registryName: string;
  servicePrincipalId: string;
  servicePrincipalPassword: string;
  tenant: string;
}

export const checkDependencies = (projectPath: string): void => {
  const fileInfo: BedrockFileInfo = bedrockYaml.fileInfo(projectPath);
  if (fileInfo.exist === false) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "project-create-variable-group-cmd-err-dependency"
    );
  }
};

/**
 * Creates a Azure DevOps variable group
 *
 * @param variableGroupName The Azure DevOps varible group name
 * @param registryName The Azure container registry name
 * @param hldRepoUrl The HLD repo url
 * @param servicePrincipalId The Azure service principal id with ACR pull and build permissions for az login
 * @param servicePrincipalPassword The service principal password for az login
 * @param tenantId The Azure AD tenant id for az login
 * @param accessOpts Azure DevOps access options from command options to override spk config
 */
export const create = (
  variableGroupName: string,
  values: ConfigValues
): Promise<VariableGroup> => {
  logger.info(
    `Creating Variable Group from group definition '${variableGroupName}'`
  );

  const vars: VariableGroupDataVariable = {
    ACR_NAME: {
      value: values.registryName,
    },
    HLD_REPO: {
      value: values.hldRepoUrl,
    },
    PAT: {
      isSecret: true,
      value: values.personalAccessToken,
    },
    SP_APP_ID: {
      isSecret: true,
      value: values.servicePrincipalId,
    },
    SP_PASS: {
      isSecret: true,
      value: values.servicePrincipalPassword,
    },
    SP_TENANT: {
      isSecret: true,
      value: values.tenant,
    },
  };
  const variableGroupData: VariableGroupData = {
    description: "Created from spk CLI",
    name: variableGroupName,
    type: "Vsts",
    variables: vars,
  };
  return addVariableGroup(variableGroupData, {
    orgName: values.orgName,
    personalAccessToken: values.personalAccessToken,
    project: values.devopsProject,
  });
};

/**
 * Writes the variable group name in a default bedrock.yaml
 *
 * @param rootProjectPath Path to generate/update the the bedrock.yaml file in
 * @param variableGroupName The variable group name
 */
export const setVariableGroupInBedrockFile = (
  rootProjectPath: string,
  variableGroupName: string
): void => {
  if (!hasValue(rootProjectPath)) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "project-create-variable-group-cmd-err-root-invalid"
    );
  }
  if (!hasValue(variableGroupName)) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "project-create-variable-group-cmd-err-variable-group-invalid"
    );
  }

  logger.info(`Setting variable group ${variableGroupName}`);

  // Get bedrock.yaml
  const bedrockFile = Bedrock(rootProjectPath);
  bedrockYaml.addVariableGroup(bedrockFile, rootProjectPath, variableGroupName);
};

/**
 * Sets the variable group name in a default bedrock.yaml
 *
 * @param rootProjectPath Path to project files
 */
export const updateLifeCyclePipeline = (rootProjectPath: string): void => {
  if (!hasValue(rootProjectPath)) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "project-create-variable-group-cmd-err-root-invalid"
    );
  }

  const fileName = PROJECT_PIPELINE_FILENAME;
  const absProjectRoot = path.resolve(rootProjectPath);

  // Get bedrock.yaml
  const bedrockFile = Bedrock(rootProjectPath);
  const pipelineFile = readYaml(
    path.join(absProjectRoot, fileName)
  ) as AzurePipelinesYaml;

  if (!pipelineFile) {
    throw buildError(errorStatusCode.VALIDATION_ERR, {
      errorKey: "project-create-variable-group-cmd-err-file-missing",
      values: [fileName, absProjectRoot],
    });
  }

  logger.verbose(`${fileName} content: \n ${JSON.stringify(pipelineFile)}`);

  logger.debug(
    `Setting variable groups ${JSON.stringify(
      bedrockFile.variableGroups
    )} in lifecycle pipeline yaml file ${fileName}`
  );

  pipelineFile.variables = [
    ...(bedrockFile.variableGroups ?? []).map((groupName) => {
      return {
        group: groupName,
      };
    }),
  ];

  // Write out
  write(pipelineFile, absProjectRoot, fileName);
};

export const validateValues = (opts: CommandOptions): ConfigValues => {
  populateInheritValueFromConfig(decorator, Config(), opts);
  validateForRequiredValues(decorator, opts, true);

  // validateForRequiredValues already check required values
  // || "" is just to satisfy eslint rule.
  validateProjectNameThrowable(opts.devopsProject || "");
  validateOrgNameThrowable(opts.orgName || "");

  return {
    hldRepoUrl: opts.hldRepoUrl || "",
    orgName: opts.orgName || "",
    personalAccessToken: opts.personalAccessToken || "",
    devopsProject: opts.devopsProject || "",
    registryName: opts.registryName || "",
    servicePrincipalId: opts.servicePrincipalId || "",
    servicePrincipalPassword: opts.servicePrincipalPassword || "",
    tenant: opts.tenant || "",
  };
};

/**
 * Executes the command.
 *
 * @param variableGroupName Variable Group Name
 * @param opts Option object from command
 */
export const execute = async (
  variableGroupName: string,
  opts: CommandOptions,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  if (!hasValue(variableGroupName)) {
    await exitFn(1);
    return;
  }

  try {
    const projectPath = process.cwd();
    logger.verbose(`project path: ${projectPath}`);

    checkDependencies(projectPath);
    const values = validateValues(opts);

    const variableGroup = await create(variableGroupName, values);

    // set the variable group name
    // variableGroup.name is set at this point that's it should have value
    // and not empty string or undefined. having || "" is just to avoid
    // eslint error
    setVariableGroupInBedrockFile(projectPath, variableGroup.name || "");

    // update hld-lifecycle.yaml with variable groups in bedrock.yaml
    updateLifeCyclePipeline(projectPath);

    // print newly created variable group
    echo(JSON.stringify(variableGroup, null, 2));

    logger.info(
      "Successfully created a variable group in Azure DevOps project!"
    );
    await exitFn(0);
  } catch (err) {
    logError(
      buildError(
        errorStatusCode.CMD_EXE_ERR,
        "project-create-variable-group-cmd-failed",
        err
      )
    );
    await exitFn(1);
  }
};

/**
 * Adds the create command to the variable-group command object
 *
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(
    async (variableGroupName: string, opts: CommandOptions) => {
      await execute(variableGroupName, opts, async (status: number) => {
        await exitCmd(logger, process.exit, status);
      });
    }
  );
};
