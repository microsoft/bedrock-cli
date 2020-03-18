import { generateUuid } from "@azure/core-http";
import { IRestResponse, RestClient } from "typed-rest-client";
import { Config } from "../../config";
import { logger } from "../../logger";
import { ServiceEndpointData } from "../../types";
import { azdoUrl, getRestClient } from "../azdoClient";
import { AzureDevOpsOpts } from "../git";
import { ServiceEndpoint, ServiceEndpointParams } from "./azdoInterfaces";

const apiUrl = "_apis/serviceendpoint/endpoints";
const apiVersion = "api-version=5.1-preview.2";

/**
 * Check for `null` or `undefined` variables in `IServiceEndpointData`
 *
 * @param serviceEndpointData The service endpoint request data
 * @throws `Error` object when required variables is specified
 */
const validateServiceEndpointInput = (
  serviceEndpointData: ServiceEndpointData
): void => {
  const errors: string[] = [];

  // name is required
  if (typeof serviceEndpointData.name === "undefined") {
    errors.push(`Invalid Service end point name.`);
  }

  if (typeof serviceEndpointData.service_principal_id === "undefined") {
    errors.push(`Invalid service prrincipla id.`);
  }

  if (typeof serviceEndpointData.service_principal_secret === "undefined") {
    errors.push(`Invalid service prrincipla secret.`);
  }

  if (typeof serviceEndpointData.subscription_id === "undefined") {
    errors.push(`Invalid subscription id.`);
  }

  if (typeof serviceEndpointData.subscription_name === "undefined") {
    errors.push(`Invalid subscription name.`);
  }

  if (typeof serviceEndpointData.tenant_id === "undefined") {
    errors.push(`Invalid tenant id.`);
  }

  if (errors.length !== 0) {
    throw new Error(errors.join(""));
  }
};

/**
 * Created `IServiceEndPointParams` from the argument `serviceEndpointData` received
 *
 * @param serviceEndpointData The service endpoint request data
 * @returns `IServiceEndpointParams` object
 */
export const createServiceEndPointParams = (
  serviceEndpointData: ServiceEndpointData
): ServiceEndpointParams => {
  validateServiceEndpointInput(serviceEndpointData);
  const endPointParams: ServiceEndpointParams = {
    authorization: {
      parameters: {
        authenticationType: "spnKey",
        serviceprincipalid: serviceEndpointData.service_principal_id,
        serviceprincipalkey: serviceEndpointData.service_principal_secret,
        tenantid: serviceEndpointData.tenant_id
      },
      scheme: "ServicePrincipal"
    },
    data: {
      subscriptionId: serviceEndpointData.subscription_id,
      subscriptionName: serviceEndpointData.subscription_name
    },
    id: generateUuid(),
    isReady: false,
    name: serviceEndpointData.name,
    type: "azurerm"
  };

  return endPointParams;
};

/**
 * Creates a new Service Endpoint in Azure DevOps project
 *
 * @param serviceEndpointData The service endpoint input data,
 * @param opts optionally override spk config with Azure DevOps access options
 * @returns newly created `IServiceEndpoint` object
 */
export const addServiceEndpoint = async (
  serviceEndpointData: ServiceEndpointData,
  opts: AzureDevOpsOpts = {}
): Promise<ServiceEndpoint> => {
  const message = `service endpoint ${serviceEndpointData.name}`;
  logger.info(`addServiceEndpoint method called with ${message}`);

  let resp: IRestResponse<ServiceEndpoint>;

  const config = Config();
  const {
    project = config.azure_devops && config.azure_devops.project,
    orgName = config.azure_devops && config.azure_devops.org
  } = opts;

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const orgUrl = azdoUrl(orgName!);

  try {
    const endPointParams: ServiceEndpointParams = createServiceEndPointParams(
      serviceEndpointData
    );

    logger.debug(
      `Creating Service Endpoint with: ${JSON.stringify(endPointParams)}`
    );
    logger.info(`Creating ${message}`);

    const client = await getRestClient(opts);
    const resource = `${orgUrl}/${project}/${apiUrl}?${apiVersion}`;
    logger.debug(` addServiceEndpoint:Resource: ${resource}`);

    resp = await client.create(resource, endPointParams);

    if (resp === null || resp.statusCode !== 200 || resp.result === null) {
      const errMessage = "Creating Service Endpoint failed.";
      logger.error(`${errMessage}`);
      throw new Error(`${errMessage}`);
    }

    logger.debug(
      `Service Endpoint Response status code: status code: ${resp.statusCode}}`
    );
    logger.debug(
      `Service Endpoint Response results: ${JSON.stringify(resp.result)}`
    );
    logger.info(`Created Service Endpoint with id: ${resp.result.id}`);

    return resp.result;
  } catch (err) {
    logger.error(err);
    throw err;
  }
};

/**
 * Get Service Endpoint by name from Azure DevOps project
 *
 * @param serviceEndpointName The service endpoint name to find existing service endpoint by name
 * @param opts optionally override spk config with Azure DevOps access options
 * @returns `IServiceEndpoint` if found by the name; otherwise `null`
 */
export const getServiceEndpointByName = async (
  serviceEndpointName: string,
  opts: AzureDevOpsOpts = {}
): Promise<ServiceEndpoint | null> => {
  logger.info(`getServiceEndpointByName called with ${serviceEndpointName}`);

  const config = Config();
  const {
    project = config.azure_devops && config.azure_devops.project,
    orgName = config.azure_devops && config.azure_devops.org
  } = opts;

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const orgUrl = azdoUrl(orgName!);
  logger.info(`getServiceEndpointByName orgUrl: ${orgUrl}`);

  const uriParameter = `?endpointNames=${serviceEndpointName}`;
  const client: RestClient = await getRestClient(opts);
  const resource = `${orgUrl}/${project}/${apiUrl}${uriParameter}&${apiVersion}`;
  logger.info(`getServiceEndpointByName:Resource: ${resource}`);

  // TODO: Figure out what the actual return type from client.get is
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resp: any = await client.get(resource);

  logger.debug(
    `getServiceEndpointByName: Service Endpoint Response results: ${JSON.stringify(
      resp.result
    )}`
  );

  // check for response conditions
  if (resp === null || resp.result === null || resp.result.count === 0) {
    logger.info(
      `Service Endpoint was not found by name: ${serviceEndpointName}`
    );
    return null;
  }

  if (resp.result.count > 1) {
    const errMessage = `Found ${resp.result.count} service endpoints by name ${serviceEndpointName}`;
    throw new Error(errMessage);
  }

  const endpoints = resp.result.value as ServiceEndpoint[];
  logger.info(
    `Found Service Endpoint by name ${serviceEndpointName} with a id ${endpoints[0].id}`
  );

  return resp.result.count === 0 ? null : endpoints[0];
};

/**
 * Check for Azdo Service Endpoint by name `serviceEndpointConfig.name` and creates `serviceEndpoint` if it does not exist
 *
 * @param serviceEndpointData The service endpoint inout data
 * @param opts optionally override spk config with Azure DevOps access options
 * @returns newly created `IServiceEndpoint` object
 */
export const createServiceEndpointIfNotExists = async (
  serviceEndpointData: ServiceEndpointData,
  opts: AzureDevOpsOpts = {}
): Promise<ServiceEndpoint> => {
  const serviceEndpointName = serviceEndpointData.name;
  const message = `service endpoint ${serviceEndpointName}`;

  if (serviceEndpointName === null || serviceEndpointName === undefined) {
    throw new Error("Service Endpoint name is null");
  }

  try {
    // get service endpoint by name that is configured in the config file
    let serviceEndpoint = await getServiceEndpointByName(
      serviceEndpointName,
      opts
    );

    // Service endpoint is not found so create a new service endpoint
    if (serviceEndpoint === null || serviceEndpoint === undefined) {
      serviceEndpoint = await addServiceEndpoint(serviceEndpointData, opts);
    }

    // addServiceEndpoint always return a value of type, IServiceEndpoint
    // it will never return null or undefined.
    // it does throw exception
    return serviceEndpoint;
  } catch (err) {
    logger.error(
      `Error occurred while checking and creating ${message}\n ${err}`
    );
    throw err;
  }
};

interface ServiceEndpointByNameResult {
  count: number;
  value: ServiceEndpoint[];
}
