import { DefinitionResourceReference } from "azure-devops-node-api/interfaces/BuildInterfaces";
import { AzureKeyVaultVariableValue } from "azure-devops-node-api/interfaces/ReleaseInterfaces";
import {
  AzureKeyVaultVariableGroupProviderData,
  VariableGroup,
  VariableGroupParameters
} from "azure-devops-node-api/interfaces/TaskAgentInterfaces";
import { ITaskAgentApi } from "azure-devops-node-api/TaskAgentApi";
import { Config } from "../../config";
import { logger } from "../../logger";
import { IVariableGroupData, IVariableGroupDataVariable } from "../../types";
import { getBuildApi, getWebApi } from "../azdoClient";
import { IAzureDevOpsOpts } from "../git";
import { IServiceEndpoint } from "./azdoInterfaces";
import { createServiceEndpointIfNotExists } from "./serviceEndpoint";

let taskApi: ITaskAgentApi | undefined; // keep track of the gitApi so it can be reused

/**
 * Creates AzDo `azure-devops-node-api.WebApi.ITaskAgentApi` with `orgUrl` and
 * `token and returns `ITaskAgentApi`
 *
 * @param opts optionally override spk config with Azure DevOps access options
 * @returns new `ITaskAgentApi` object
 */
export const TaskApi = async (
  opts: IAzureDevOpsOpts = {}
): Promise<ITaskAgentApi> => {
  if (typeof taskApi !== "undefined") {
    return taskApi;
  }

  const api = await getWebApi(opts);
  try {
    taskApi = await api.getTaskAgentApi();
    logger.info(`Successfully connected to Azure DevOps Task API!`);
  } catch (err) {
    logger.error(`Error connecting Azure DevOps Task API\n ${err}`);
    throw err;
  }
  return taskApi;
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
  variableGroupData: IVariableGroupData,
  opts: IAzureDevOpsOpts = {}
): Promise<VariableGroup> => {
  const message: string = `Variable Group ${variableGroupData.name}`;
  try {
    logger.info(`Creating ${message}`);

    if (
      typeof variableGroupData.variables === undefined ||
      typeof variableGroupData.variables === null
    ) {
      throw new Error("Invalid input. Variable are not configured");
    }

    // map variables from configuration
    const variablesMap = await buildVariablesMap(variableGroupData.variables!);

    // create variable group parameters
    const params: VariableGroupParameters = {
      description: variableGroupData.description,
      name: variableGroupData.name,
      type: "Vsts",
      variables: variablesMap
    };

    return doAddVariableGroup(params, true, opts);
  } catch (err) {
    logger.error(`Failed to create ${message}\n ${err}`);
    throw err;
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
  variableGroupData: IVariableGroupData,
  opts: IAzureDevOpsOpts = {}
): Promise<VariableGroup> => {
  const message: string = `Variable Group ${variableGroupData.name}`;

  try {
    logger.info(`Creating ${message}`);
    let serviceEndpoint: IServiceEndpoint;
    if (
      typeof variableGroupData.key_vault_provider === undefined ||
      typeof variableGroupData.key_vault_provider === null ||
      typeof variableGroupData.key_vault_provider!.service_endpoint ===
        undefined ||
      typeof variableGroupData.key_vault_provider!.service_endpoint === null
    ) {
      throw new Error(
        "Invalid input. Azure KeyVault Provider data is not configured"
      );
    }

    // get service endpoint id
    logger.info(`Checking for Service endpoint`);
    serviceEndpoint = await createServiceEndpointIfNotExists(
      variableGroupData.key_vault_provider!.service_endpoint,
      opts
    );

    logger.info(
      `Using Service endpoint id: ${serviceEndpoint.id} for Key Vault`
    );

    // create AzureKeyVaultVariableValue object
    const kvProvideData: AzureKeyVaultVariableGroupProviderData = {
      serviceEndpointId: serviceEndpoint.id,
      vault: variableGroupData.key_vault_provider!.name
    };

    // map variables as secrets from input
    const secretsMap = await buildVariablesMap(variableGroupData.variables!);

    // creating variable group parameters
    const params: VariableGroupParameters = {
      description: variableGroupData.description,
      name: variableGroupData.name,
      providerData: kvProvideData,
      type: "AzureKeyVault",
      variables: secretsMap
    };

    return doAddVariableGroup(params, true, opts);
  } catch (err) {
    logger.error(`Failed to create ${message}\n ${err}`);
    throw err;
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
  opts: IAzureDevOpsOpts = {}
): Promise<VariableGroup> => {
  const message: string = `Variable Group ${variableGroupData.name}`;
  const config = Config();
  const { project = config.azure_devops && config.azure_devops.project } = opts;
  if (typeof project !== "string") {
    throw Error(
      `Azure DevOps Project not defined; ensure that azure_devops.project is set`
    );
  }
  try {
    logger.debug(
      `Creating new Variable Group ${JSON.stringify(variableGroupData)}`
    );
    logger.info(`Attempting to create Variable Group in project '${project}'`);
    const taskClient: ITaskAgentApi = await TaskApi(opts);
    const group: VariableGroup = await taskClient.addVariableGroup(
      variableGroupData,
      project!
    );
    logger.debug(`Created new Variable Group: ${JSON.stringify(group)}`);
    logger.info(`Created ${message} with id: ${group.id!}`);

    if (accessToAllPipelines) {
      await authorizeAccessToAllPipelines(group, opts);
    }

    return group;
  } catch (err) {
    logger.error(`Failed to create ${message}\n ${err}`);
    throw err;
  }
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
  opts: IAzureDevOpsOpts = {}
): Promise<boolean> => {
  const message: string = `Resource definition for all pipelines to access Variable Group ${variableGroup.name}`;

  if (typeof variableGroup === undefined || variableGroup === null) {
    throw new Error("Invalid input");
  }

  try {
    // authorize access to variable group from all pipelines
    logger.info(`Creating ${message}`);
    const config = Config();
    const {
      project = config.azure_devops && config.azure_devops.project
    } = opts;

    const resourceDefinition: DefinitionResourceReference = {
      authorized: true,
      id: variableGroup.id!.toString(),
      name: variableGroup.name,
      type: "variablegroup"
    };

    logger.debug(
      `Creating resource definition: ${JSON.stringify(resourceDefinition)}`
    );

    const buildCleint = await getBuildApi(opts);
    const resourceDefinitionResponse = await buildCleint.authorizeProjectResources(
      [resourceDefinition],
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
    logger.error(`Failed to create ${message}\n ${err}`);
    throw err;
  }
};

/**
 * Key/value interface for variables
 *
 */
export interface IVariablesMap {
  [key: string]: AzureKeyVaultVariableValue;
}

/**
 * Creates `IVariablesMap` object from variables key/value pairs
 *
 * @param variableGroup The Variable group object
 * @returns `IVariablesMap[]` with Varibale Group variables
 */
export const buildVariablesMap = async (
  variables: IVariablesMap[]
): Promise<IVariablesMap> => {
  const variablesMap: IVariablesMap = {};
  logger.debug(`variables: ${JSON.stringify(variables)}`);

  for (const [key, value] of Object.entries(variables)) {
    logger.debug(`variable: ${key}: value: ${JSON.stringify(value)}`);
    variablesMap[key] = value;
  }

  logger.debug(`variablesMap: ${JSON.stringify(variablesMap)}`);
  return variablesMap;
};
