import { VariableGroup } from "azure-devops-node-api/interfaces/ReleaseInterfaces";
import commander from "commander";
import path from "path";
import { echo } from "shelljs";
import { Bedrock, Config, write } from "../../config";
import { IAzureDevOpsOpts } from "../../lib/git";
import { addVariableGroup } from "../../lib/pipelines/variableGroup";
import { logger } from "../../logger";
import {
  IBedrockFile,
  IVariableGroupData,
  IVariableGroupDataVariable
} from "../../types";

/**
 * Adds the create command to the variable-group command object
 *
 * @param command Commander command object to decorate
 */
export const createVariablegroupCommandDecorator = (
  command: commander.Command
): void => {
  command
    .command("create-variable-group <variable-group-name>")
    .alias("cvg")
    .description(
      "Create a new variable group in Azure DevOps project with specific variables (ACR name, HLD Repo name, Personal Access Token, Service Principal id, Service Principal password, and Azure AD tenant id)"
    )
    .option(
      "-r, --registry-name <registry-name>",
      "The name of the existing Azure Container Registry."
    )
    .option(
      "-d, --hld-repo-url <hld-repo-url>",
      "The high level definition (HLD) git repo url; falls back to azure_devops.org in spk config."
    )
    .option(
      "-u, --service-principal-id <service-principal-id>",
      "Azure service principal id with `contributor` role in Azure Container Registry."
    )
    .option(
      "-p, --service-principal-password <service-principal-password>",
      "The Azure service principal password."
    )
    .option(
      "-t, --tenant <tenant>",
      "The Azure AD tenant id of service principal."
    )
    .option(
      "--org-name <organization-name>",
      "Azure DevOps organization name; falls back to azure_devops.org in spk config."
    )
    .option(
      "--project <project>",
      "Azure DevOps project name; falls back to azure_devops.project in spk config."
    )
    .option(
      "--personal-access-token <personal-access-token>",
      "Azure DevOps Personal access token; falls back to azure_devops.access_token in spk config."
    )
    .action(async (variableGroupName, opts) => {
      try {
        const {
          registryName,
          servicePrincipalId,
          servicePrincipalPassword,
          tenant
        } = opts;

        const { azure_devops } = Config();

        const {
          hldRepoUrl = azure_devops && azure_devops.hld_repository,
          orgName = azure_devops && azure_devops.org,
          personalAccessToken = azure_devops && azure_devops.access_token,
          project = azure_devops && azure_devops.project
        } = opts;

        const accessOpts: IAzureDevOpsOpts = {
          orgName,
          personalAccessToken,
          project
        };

        logger.debug(`access options: ${JSON.stringify(accessOpts)}`);

        // required parameters check
        const errors: string[] = await validateRequiredArguments(
          variableGroupName,
          registryName,
          hldRepoUrl,
          servicePrincipalId,
          servicePrincipalPassword,
          tenant,
          accessOpts
        );

        if (errors.length !== 0) {
          logger.error(
            `the following arguments are required: ${errors.join("")}`
          );
          return errors;
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
        const projectPath = process.cwd();
        await setVariableGroupInBedrockFile(projectPath, variableGroup.name!);

        // print newly created variable group
        echo(JSON.stringify(variableGroup, null, 2));

        logger.info(
          "Successfully created a variable group in Azure DevOps project!"
        );
      } catch (err) {
        logger.error(`Error occurred while creating variable group`);
        logger.error(err);
      }
    });
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
  registryName: string,
  hldRepoUrl: string,
  servicePrincipalId: string,
  servicePrincipalPassword: string,
  tenantId: string,
  accessOpts: IAzureDevOpsOpts
): Promise<VariableGroup> => {
  logger.info(
    `Creating Variable Group from group definition '${variableGroupName}'`
  );
  try {
    // validate input
    await validateRequiredArguments(
      variableGroupName,
      registryName,
      hldRepoUrl,
      servicePrincipalId,
      servicePrincipalPassword,
      tenantId,
      accessOpts
    );

    // validate variable group type"
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
    throw err;
  }
};

/**
 * Checks arguments for undefined or null and returns errors
 *
 * @param variableGroupName The Azure DevOps varible group name
 * @param registryName The Azure container registry name
 * @param servicePrincipalId The Azure service principla id with ACR pull and build permissions for az login
 * @param servicePrincipalPassword The service principla password for az login
 * @param tenantId The Azure AD tenant id for az login
 */
export const validateRequiredArguments = async (
  variableGroupName: any,
  registryName: any,
  hldRepoUrl: any,
  servicePrincipalId: any,
  servicePrincipalPassword: any,
  tenant: any,
  accessOpts: IAzureDevOpsOpts
): Promise<string[]> => {
  const errors: string[] = [];

  if (variableGroupName === undefined || variableGroupName === "") {
    errors.push("\n <variable-group-name>");
  }

  if (registryName === undefined || registryName === "") {
    errors.push("\n -r / --registry-name");
  }

  if (hldRepoUrl === undefined || hldRepoUrl === "") {
    errors.push("\n -d / --hld-repo-url");
  }

  if (servicePrincipalId === undefined || servicePrincipalId === "") {
    errors.push("\n -u / --service-principal-id");
  }

  if (
    servicePrincipalPassword === undefined ||
    servicePrincipalPassword === ""
  ) {
    errors.push("\n -p / --service-principal-password");
  }

  if (tenant === undefined || servicePrincipalPassword === "") {
    errors.push("\n -t / --tenant");
  }

  if (accessOpts.orgName === undefined || accessOpts.orgName === "") {
    errors.push("\n --org-name / azure_devops:org is not set in spk config");
  }

  if (
    accessOpts.personalAccessToken === undefined ||
    accessOpts.personalAccessToken === ""
  ) {
    errors.push(
      "\n --personal-access-token / azure_devops:access_token is not set in spk config"
    );
  }

  if (accessOpts.project === undefined || accessOpts.project === "") {
    errors.push("\n --project / azure_devops:project is not set in spk config");
  }

  return errors;
};

/**
 * Sets the variable group name in a default bedrock.yaml
 *
 * @param rootProjectPath Path to generate/update the the bedrock.yaml file in
 * @param variableGroupName The varible group name
 */
export const setVariableGroupInBedrockFile = async (
  rootProjectPath: string,
  variableGroupName: string
) => {
  if (
    rootProjectPath === undefined ||
    rootProjectPath === null ||
    rootProjectPath === ""
  ) {
    throw new Error("Project root path is not valid");
  }

  if (
    variableGroupName === undefined ||
    variableGroupName === null ||
    variableGroupName === ""
  ) {
    throw new Error("Variable Group Name is not valid");
  }

  const absProjectRoot = path.resolve(rootProjectPath);
  logger.info(`Creating variable group ${variableGroupName}`);

  let bedrockFile: IBedrockFile | undefined;

  // Get bedrock.yaml if it already exists
  try {
    bedrockFile = Bedrock(rootProjectPath);
    bedrockFile.variableGroups = bedrockFile.variableGroups
      ? bedrockFile.variableGroups
      : [];
  } catch (err) {
    logger.info(
      `No bedrock.yaml found at ${absProjectRoot}, creating a new file to add variable group`
    );
  }

  // if fies does not exist, create it
  if (bedrockFile === undefined) {
    bedrockFile = {
      rings: {}, // rings is optional but necessary to create a bedrock file in config.write method
      services: {}, // service property is not optional so set it to null
      variableGroups: []
    };
  }

  // add new variabe group
  bedrockFile.variableGroups!.push(variableGroupName);

  // Write out
  write(bedrockFile, absProjectRoot);
};
