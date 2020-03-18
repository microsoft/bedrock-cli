/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/camelcase */
import { VariableGroup } from "azure-devops-node-api/interfaces/ReleaseInterfaces";
import commander from "commander";
import path from "path";
import { echo } from "shelljs";
import { Bedrock, Config, readYaml, write } from "../../config";
import { fileInfo as bedrockFileInfo } from "../../lib/bedrockYaml";
import {
  build as buildCmd,
  exit as exitCmd,
  validateForRequiredValues
} from "../../lib/commandBuilder";
import {
  PROJECT_INIT_DEPENDENCY_ERROR_MESSAGE,
  PROJECT_PIPELINE_FILENAME
} from "../../lib/constants";
import { AzureDevOpsOpts } from "../../lib/git";
import { addVariableGroup } from "../../lib/pipelines/variableGroup";
import { hasValue } from "../../lib/validator";
import { logger } from "../../logger";
import {
  AzurePipelinesYaml,
  BedrockFileInfo,
  VariableGroupData,
  VariableGroupDataVariable
} from "../../types";
import decorator from "./create-variable-group.decorator.json";

// values that we need to pull out from command operator
interface CommandOptions {
  registryName: string | undefined;
  servicePrincipalId: string | undefined;
  servicePrincipalPassword: string | undefined;
  tenant: string | undefined;
  hldRepoUrl: string | undefined;
  orgName: string | undefined;
  personalAccessToken: string | undefined;
  devopsProject: string | undefined;
}

export const checkDependencies = (projectPath: string): void => {
  const fileInfo: BedrockFileInfo = bedrockFileInfo(projectPath);
  if (fileInfo.exist === false) {
    throw new Error(PROJECT_INIT_DEPENDENCY_ERROR_MESSAGE);
  }
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

    const { azure_devops } = Config();

    const {
      registryName,
      servicePrincipalId,
      servicePrincipalPassword,
      tenant,
      hldRepoUrl = azure_devops?.hld_repository,
      orgName = azure_devops?.org,
      personalAccessToken = azure_devops?.access_token,
      devopsProject = azure_devops?.project
    } = opts;

    const accessOpts: AzureDevOpsOpts = {
      orgName,
      personalAccessToken,
      project: devopsProject
    };

    logger.debug(`access options: ${JSON.stringify(accessOpts)}`);

    const errors = validateForRequiredValues(decorator, {
      devopsProject,
      hldRepoUrl,
      orgName,
      personalAccessToken,
      registryName,
      servicePrincipalId,
      servicePrincipalPassword,
      tenant
    });

    if (errors.length !== 0) {
      await exitFn(1);
      return;
    }

    const variableGroup = await create(
      variableGroupName,
      registryName,
      hldRepoUrl,
      servicePrincipalId,
      servicePrincipalPassword,
      tenant,
      accessOpts
    );

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
    logger.error(`Error occurred while creating variable group`);
    logger.error(err);
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
  registryName: string | undefined,
  hldRepoUrl: string | undefined,
  servicePrincipalId: string | undefined,
  servicePrincipalPassword: string | undefined,
  tenantId: string | undefined,
  accessOpts: AzureDevOpsOpts
): Promise<VariableGroup> => {
  logger.info(
    `Creating Variable Group from group definition '${variableGroupName}'`
  );
  const vars: VariableGroupDataVariable = {
    ACR_NAME: {
      value: registryName
    },
    HLD_REPO: {
      value: hldRepoUrl
    },
    PAT: {
      isSecret: true,
      value: accessOpts.personalAccessToken
    },
    SP_APP_ID: {
      isSecret: true,
      value: servicePrincipalId
    },
    SP_PASS: {
      isSecret: true,
      value: servicePrincipalPassword
    },
    SP_TENANT: {
      isSecret: true,
      value: tenantId
    }
  };
  const variableGroupData: VariableGroupData = {
    description: "Created from spk CLI",
    name: variableGroupName,
    type: "Vsts",
    variables: vars
  };
  return addVariableGroup(variableGroupData, accessOpts);
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
    throw new Error("Project root path is not valid");
  }
  if (!hasValue(variableGroupName)) {
    throw new Error("Variable Group Name is not valid");
  }

  const absProjectRoot = path.resolve(rootProjectPath);
  logger.info(`Setting variable group ${variableGroupName}`);

  // Get bedrock.yaml
  const bedrockFile = Bedrock(rootProjectPath);

  if (typeof bedrockFile === "undefined") {
    throw Error(`Bedrock file does not exist.`);
  }

  logger.verbose(
    `Bedrock file content in ${rootProjectPath}: \n ${JSON.stringify(
      bedrockFile
    )}`
  );

  // add new variable group
  bedrockFile.variableGroups = [
    ...(bedrockFile.variableGroups ?? []),
    variableGroupName
  ];

  // Write out
  write(bedrockFile, absProjectRoot);
};

/**
 * Sets the variable group name in a default bedrock.yaml
 *
 * @param rootProjectPath Path to project files
 */
export const updateLifeCyclePipeline = (rootProjectPath: string): void => {
  if (!hasValue(rootProjectPath)) {
    throw Error("Project root path is not valid");
  }

  const fileName = PROJECT_PIPELINE_FILENAME;
  const absProjectRoot = path.resolve(rootProjectPath);

  // Get bedrock.yaml
  const bedrockFile = Bedrock(rootProjectPath);
  const pipelineFile = readYaml(
    path.join(absProjectRoot, fileName)
  ) as AzurePipelinesYaml;

  if (typeof pipelineFile === "undefined") {
    throw new Error("${fileName} file does not exist in ${absProjectRoot}.");
  }

  logger.verbose(`${fileName} content: \n ${JSON.stringify(pipelineFile)}`);

  logger.debug(
    `Setting variable groups ${JSON.stringify(
      bedrockFile.variableGroups
    )} in lifecycle pipeline yaml file ${fileName}`
  );

  pipelineFile.variables = [
    ...(bedrockFile.variableGroups ?? []).map(groupName => {
      return {
        group: groupName
      };
    })
  ];

  // Write out
  write(pipelineFile, absProjectRoot, fileName);
};
