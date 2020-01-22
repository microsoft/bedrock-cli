import { VariableGroup } from "azure-devops-node-api/interfaces/ReleaseInterfaces";
import commander from "commander";
import path from "path";
import { echo } from "shelljs";
import { Bedrock, Config, write } from "../../config";
import {
  build as buildCmd,
  validateForRequiredValues
} from "../../lib/commandBuilder";
import { IAzureDevOpsOpts } from "../../lib/git";
import { addVariableGroup } from "../../lib/pipelines/variableGroup";
import { hasValue } from "../../lib/validator";
import { logger } from "../../logger";
import {
  IBedrockFile,
  IVariableGroupData,
  IVariableGroupDataVariable
} from "../../types";
import decorator from "./create-variable-group.decorator.json";

// values that we need to pull out from command operator
interface ICommandOptions {
  registryName: string | undefined;
  servicePrincipalId: string | undefined;
  servicePrincipalPassword: string | undefined;
  tenant: string | undefined;
  hldRepoUrl: string | undefined;
  orgName: string | undefined;
  personalAccessToken: string | undefined;
  project: string | undefined;
}

/**
 * Returns an array of error message for missing variable values. Returns empty
 * array if all values are present.
 *
 * @param registryName The Azure container registry name
 * @param hldRepoUrl High Level Definition URL
 * @param servicePrincipalId The Azure service principla id with ACR pull and build permissions for az login
 * @param servicePrincipalPassword The service principla password for az login
 * @param tenantId The Azure AD tenant id for az login
 * @param accessOpts Azure DevOp options
 */
export const validateRequiredArguments = (
  registryName: string | undefined,
  hldRepoUrl: string | undefined,
  servicePrincipalId: string | undefined,
  servicePrincipalPassword: string | undefined,
  tenant: string | undefined,
  accessOpts: IAzureDevOpsOpts
): string[] => {
  return validateForRequiredValues(decorator, {
    hldRepoUrl,
    orgName: accessOpts.orgName,
    personalAccessToken: accessOpts.personalAccessToken,
    project: accessOpts.project,
    registryName,
    servicePrincipalId,
    servicePrincipalPassword,
    tenant
  });
};

/**
 * Executes the command.
 *
 * @param variableGroupName Variable Group Name
 * @param opts Option object from command
 */
export const execute = async (
  variableGroupName: string,
  opts: ICommandOptions,
  exitFn: (status: number) => void
) => {
  if (!hasValue(variableGroupName)) {
    exitFn(1);
  } else {
    try {
      const { azure_devops } = Config();

      const {
        registryName,
        servicePrincipalId,
        servicePrincipalPassword,
        tenant,
        hldRepoUrl = azure_devops?.hld_repository,
        orgName = azure_devops?.org,
        personalAccessToken = azure_devops?.access_token,
        project = azure_devops?.project
      } = opts;

      const accessOpts: IAzureDevOpsOpts = {
        orgName,
        personalAccessToken,
        project
      };

      logger.debug(`access options: ${JSON.stringify(accessOpts)}`);

      const errors = validateRequiredArguments(
        registryName,
        hldRepoUrl,
        servicePrincipalId,
        servicePrincipalPassword,
        tenant,
        accessOpts
      );

      if (errors.length !== 0) {
        exitFn(1);
      } else {
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
        const projectPath = process.cwd();
        await setVariableGroupInBedrockFile(projectPath, variableGroup.name!);

        // print newly created variable group
        echo(JSON.stringify(variableGroup, null, 2));

        logger.info(
          "Successfully created a variable group in Azure DevOps project!"
        );
        exitFn(0);
      }
    } catch (err) {
      logger.error(`Error occurred while creating variable group`);
      logger.error(err);
      exitFn(1);
    }
  }
};

/**
 * Adds the create command to the variable-group command object
 *
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(
    async (variableGroupName: string, opts: ICommandOptions) => {
      await execute(variableGroupName, opts, process.exit);
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
export const create = async (
  variableGroupName: string,
  registryName: string | undefined,
  hldRepoUrl: string | undefined,
  servicePrincipalId: string | undefined,
  servicePrincipalPassword: string | undefined,
  tenantId: string | undefined,
  accessOpts: IAzureDevOpsOpts
): Promise<VariableGroup> => {
  logger.info(
    `Creating Variable Group from group definition '${variableGroupName}'`
  );
  try {
    const vars: IVariableGroupDataVariable = {
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
    const variableGroupData: IVariableGroupData = {
      description: "Created from spk CLI",
      name: variableGroupName,
      type: "Vsts",
      variables: [vars]
    };

    return await addVariableGroup(variableGroupData, accessOpts);
  } catch (err) {
    throw err; // TOFIX: are we just rethrowing error?
  }
};

/**
 * Writes the variable group name in a default bedrock.yaml
 *
 * @param rootProjectPath Path to generate/update the the bedrock.yaml file in
 * @param variableGroupName The varible group name
 */
export const setVariableGroupInBedrockFile = async (
  rootProjectPath: string,
  variableGroupName: string
) => {
  if (!hasValue(rootProjectPath)) {
    throw new Error("Project root path is not valid");
  }
  if (!hasValue(variableGroupName)) {
    throw new Error("Variable Group Name is not valid");
  }

  const absProjectRoot = path.resolve(rootProjectPath);
  logger.info(`Creating variable group ${variableGroupName}`);

  let bedrockFile: IBedrockFile | undefined;

  // Get bedrock.yaml if it already exists
  try {
    bedrockFile = Bedrock(rootProjectPath);
  } catch (err) {
    logger.info(
      `No bedrock.yaml found at ${absProjectRoot}, creating a new file to add variable group`
    );
    bedrockFile = {
      rings: {}, // rings is optional but necessary to create a bedrock file in config.write method
      services: {} // service property is not optional so set it to null
    };
  }

  // to be sure that variableGroups is not undefined.
  bedrockFile.variableGroups = bedrockFile.variableGroups || [];
  // add new variabe group
  bedrockFile.variableGroups.push(variableGroupName);

  write(bedrockFile, absProjectRoot);
};
