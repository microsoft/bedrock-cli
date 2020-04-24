import { DefinitionResourceReference } from "azure-devops-node-api/interfaces/BuildInterfaces";
import {
  AzureKeyVaultVariableGroupProviderData,
  VariableGroup,
  VariableGroupParameters,
} from "azure-devops-node-api/interfaces/TaskAgentInterfaces";
import { Config } from "../../config";
import { logger } from "../../logger";
import { VariableGroupData, VariableGroupDataVariable } from "../../types";
import { getBuildApi, getTaskAgentApi } from "../azdoClient";
import { AzureDevOpsOpts } from "../git";
import { createServiceEndpointIfNotExists } from "./serviceEndpoint";
import { build as buildError } from "../errorBuilder";
import { errorStatusCode } from "../errorStatusCode";

/**
 * Creates `IVariablesMap` object from variables key/value pairs
 *
 * @param variableGroup The Variable group object
 * @returns `IVariablesMap[]` with Varibale Group variables
 */
export const buildVariablesMap = (
  variables: VariableGroupDataVariable
): VariableGroupDataVariable => {
  const variablesMap: VariableGroupDataVariable = {};
  logger.debug(`variables: ${JSON.stringify(variables)}`);

  for (const [key, value] of Object.entries(variables)) {
    logger.debug(`variable: ${key}: value: ${JSON.stringify(value)}`);
    variablesMap[key] = value;
  }

  logger.debug(`variablesMap: ${JSON.stringify(variablesMap)}`);
  return variablesMap;
};

/**
 * Enables authorization for all pipelines to access Variable group with
 * `variableGroup` data and returns `true` if successful
 *
 * @param variableGroup The Variable group object
 * @param opts optionally override spk config with Azure DevOps access options
 * @returns `true` if successful; otherwise `false`
 */
export const authorizeAccessToAllPipelines = async (
  variableGroup: VariableGroup,
  opts: AzureDevOpsOpts = {}
): Promise<boolean> => {
  const message = `Resource definition for all pipelines to access Variable Group ${variableGroup.name}`;

  if (!variableGroup.id) {
    throw buildError(
      errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
      "var-group-authorize-all-pipelines-err-missing-id"
    );
  }

  try {
    // authorize access to variable group from all pipelines
    logger.info(`Creating ${message}`);
    const config = Config();
    const {
      project = config.azure_devops && config.azure_devops.project,
    } = opts;

    const resourceDefinition: DefinitionResourceReference = {
      authorized: true,
      id: variableGroup.id.toString(),
      name: variableGroup.name,
      type: "variablegroup",
    };

    logger.debug(
      `Creating resource definition: ${JSON.stringify(resourceDefinition)}`
    );

    const buildClient = await getBuildApi(opts);
    const resourceDefinitionResponse = await buildClient.authorizeProjectResources(
      [resourceDefinition],
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      project!
    );

    logger.debug(
      `Created resource definition: ${JSON.stringify(
        resourceDefinitionResponse
      )}`
    );
    logger.info(
      `Authorized access ${message} authorized flag set to ${resourceDefinitionResponse[0].authorized}`
    );

    return true;
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
      {
        errorKey: "var-group-authorize-all-pipelines-err",
        values: [variableGroup.name || ""],
      },
      err
    );
  }
};

/**
 * Adds Variable group with `VariableGroupParameters` data and returns
 * `VariableGroup` object.
 *
 * @param variableGroupData The Variable group data
 * @param accessToAllPipelines Whether the variable group should be accessible by all pipelines
 * @param opts optionally override spk config with Azure DevOps access options
 * @returns newly created `VariableGroup` object
 */
export const doAddVariableGroup = async (
  variableGroupData: VariableGroupParameters,
  accessToAllPipelines: boolean,
  opts: AzureDevOpsOpts = {}
): Promise<VariableGroup> => {
  const message = `Variable Group ${variableGroupData.name}`;
  const config = Config();
  const { project = config.azure_devops && config.azure_devops.project } = opts;

  if (typeof project !== "string") {
    // can be just !project
    throw buildError(
      errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
      "var-group-add-err-project-missing"
    );
  }

  logger.debug(
    `Creating new Variable Group ${JSON.stringify(variableGroupData)}`
  );
  logger.info(`Attempting to create Variable Group in project '${project}'`);
  const taskClient = await getTaskAgentApi(opts);
  const group = await taskClient.addVariableGroup(variableGroupData, project);
  logger.debug(`Created new Variable Group: ${JSON.stringify(group)}`);
  logger.info(`Created ${message} with id: ${group.id}`);

  if (accessToAllPipelines) {
    await authorizeAccessToAllPipelines(group, opts);
  }

  return group;
};

/**
 * Adds Variable group `groupConfig` in Azure DevOps project and returns
 * `VariableGroup` object
 *
 * @param variableGroupData with required variables
 * @param opts optionally override spk config with Azure DevOps access options
 * @returns newly created `VariableGroup` object
 */
export const addVariableGroup = async (
  variableGroupData: VariableGroupData,
  opts: AzureDevOpsOpts = {}
): Promise<VariableGroup> => {
  const message = `Variable Group ${variableGroupData.name}`;
  logger.info(`Creating ${message}`);

  if (!variableGroupData.variables) {
    throw buildError(
      errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
      "var-group-add-err-vars-missing"
    );
  }

  try {
    // map variables from configuration
    const variablesMap = buildVariablesMap(variableGroupData.variables);

    // create variable group parameters
    const params: VariableGroupParameters = {
      description: variableGroupData.description,
      name: variableGroupData.name,
      type: "Vsts",
      variables: variablesMap,
    };

    return doAddVariableGroup(params, true, opts);
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
      {
        errorKey: "var-group-add-err",
        values: [variableGroupData.name || ""],
      },
      err
    );
  }
};

/**
 * Adds Variable group `groupConfig` with Key Value mapping in Azure DevOps
 * project and returns `VariableGroup` object
 *
 * @param variableGroupData with required variables
 * @param opts optionally override spk config with Azure DevOps access options
 * @returns newly created `VariableGroup` object
 */
export const addVariableGroupWithKeyVaultMap = async (
  variableGroupData: VariableGroupData,
  opts: AzureDevOpsOpts = {}
): Promise<VariableGroup> => {
  const message = `Variable Group ${variableGroupData.name}`;

  try {
    logger.info(`Creating ${message}`);
    if (
      variableGroupData.key_vault_provider === undefined ||
      variableGroupData.key_vault_provider === null ||
      variableGroupData.key_vault_provider.service_endpoint === undefined ||
      typeof variableGroupData.key_vault_provider.service_endpoint === null
    ) {
      throw buildError(
        errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
        "var-group-add-with-key-vault-err-missing-provider"
      );
    }

    // get service endpoint id
    logger.info(`Checking for Service endpoint`);
    const serviceEndpoint = await createServiceEndpointIfNotExists(
      variableGroupData.key_vault_provider.service_endpoint,
      opts
    );

    logger.info(
      `Using Service endpoint id: ${serviceEndpoint.id} for Key Vault`
    );

    // create AzureKeyVaultVariableValue object
    const kvProvideData: AzureKeyVaultVariableGroupProviderData = {
      serviceEndpointId: serviceEndpoint.id,
      vault: variableGroupData.key_vault_provider.name,
    };

    // map variables as secrets from input
    const secretsMap = buildVariablesMap(variableGroupData.variables);

    // creating variable group parameters
    const params: VariableGroupParameters = {
      description: variableGroupData.description,
      name: variableGroupData.name,
      providerData: kvProvideData,
      type: "AzureKeyVault",
      variables: secretsMap,
    };

    return doAddVariableGroup(params, true, opts);
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
      {
        errorKey: "var-group-add-with-key-vault-err",
        values: [variableGroupData.name || ""],
      },
      err
    );
  }
};

/**
 * Deletes variable group
 *
 * @param opts optionally override spk config with Azure DevOps access options
 * @param name Name of group to be deleted.
 * @returns true if group exists and deleted.
 */
export const deleteVariableGroup = async (
  opts: AzureDevOpsOpts,
  name: string
): Promise<boolean> => {
  try {
    const taskClient = await getTaskAgentApi(opts);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const project = opts.project!;

    const groups = await taskClient.getVariableGroups(project, name);
    if (groups?.[0]?.id) {
      await taskClient.deleteVariableGroup(project, groups[0].id);
      return true;
    }
    return false;
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
      {
        errorKey: "var-group-delete-var-group-err",
        values: [opts.project!, name],
      },
      err
    );
  }
};

/**
 * Checks if a variable group exists
 *
 * @param opts optionally override spk config with Azure DevOps access options
 * @param name Name of the variable group
 * @returns true if the variable group exists
 */
export const hasVariableGroup = async (
  opts: AzureDevOpsOpts,
  name: string
): Promise<boolean> => {
  try {
    const taskClient = await getTaskAgentApi(opts);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const project = opts.project!;

    const groups = await taskClient.getVariableGroups(project, name);
    return groups?.[0]?.name === name;
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
      {
        errorKey: "var-group-has-var-group-err",
        values: [opts.project!, name],
      },
      err
    );
  }
};
