import { generateUuid } from "@azure/core-http";
import { IRestResponse } from "typed-rest-client";
import { Config } from "../../config";
import { logger } from "../../logger";
import { ServiceEndpointData } from "../../types";
import { azdoUrl, getRestClient } from "../azdoClient";
import { build as buildError } from "../errorBuilder";
import { errorStatusCode } from "../errorStatusCode";
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
  if (!serviceEndpointData.name) {
    errors.push(`service end point name`);
  }

  if (!serviceEndpointData.service_principal_id) {
    errors.push(`service prrincipla id`);
  }

  if (!serviceEndpointData.service_principal_secret) {
    errors.push(`service prrincipla secret`);
  }

  if (!serviceEndpointData.subscription_id) {
    errors.push(`subscription id`);
  }

  if (!serviceEndpointData.subscription_name) {
    errors.push(`subscription name`);
  }

  if (!serviceEndpointData.tenant_id) {
    errors.push(`tenant id`);
  }

  if (errors.length !== 0) {
    throw buildError(errorStatusCode.AZURE_SERVICE_ENDPOINT, {
      errorKey: "service-endpoint-err-validation",
      values: [errors.join(", ")],
    });
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
  try {
    validateServiceEndpointInput(serviceEndpointData);
    const endPointParams: ServiceEndpointParams = {
      authorization: {
        parameters: {
          authenticationType: "spnKey",
          serviceprincipalid: serviceEndpointData.service_principal_id,
          serviceprincipalkey: serviceEndpointData.service_principal_secret,
          tenantid: serviceEndpointData.tenant_id,
        },
        scheme: "ServicePrincipal",
      },
      data: {
        subscriptionId: serviceEndpointData.subscription_id,
        subscriptionName: serviceEndpointData.subscription_name,
      },
      id: generateUuid(),
      isReady: false,
      name: serviceEndpointData.name,
      type: "azurerm",
    };

    return endPointParams;
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_SERVICE_ENDPOINT,
      "service-endpoint-err-create-params",
      err
    );
  }
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

  const config = Config();
  const {
    project = config.azure_devops && config.azure_devops.project,
    orgName = config.azure_devops && config.azure_devops.org,
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

    const resp: IRestResponse<ServiceEndpoint> = await client.create(
      resource,
      endPointParams
    );

    if (resp === null || resp.statusCode !== 200 || resp.result === null) {
      throw buildError(
        errorStatusCode.AZURE_SERVICE_ENDPOINT,
        "service-endpoint-err-add"
      );
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
    throw buildError(
      errorStatusCode.AZURE_SERVICE_ENDPOINT,
      "service-endpoint-err-add-endpoint",
      err
    );
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
    orgName = config.azure_devops && config.azure_devops.org,
  } = opts;

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const orgUrl = azdoUrl(orgName!);
  logger.info(`getServiceEndpointByName orgUrl: ${orgUrl}`);

  const uriParameter = `?endpointNames=${serviceEndpointName}`;
  const client = await getRestClient(opts);
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
    throw buildError(errorStatusCode.AZURE_SERVICE_ENDPOINT, {
      errorKey: "service-endpoint-err-get-endpoint-multiple",
      values: [resp.result.count.toString(), serviceEndpointName],
    });
  }

  const endpoints = resp.result.value as ServiceEndpoint[];
  logger.info(
    `Found Service Endpoint by name ${serviceEndpointName} with a id ${endpoints[0].id}`
  );

  return endpoints[0];
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

  if (!serviceEndpointName) {
    throw buildError(
      errorStatusCode.AZURE_SERVICE_ENDPOINT,
      "service-endpoint-err-create-missing-name"
    );
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
    throw buildError(
      errorStatusCode.AZURE_SERVICE_ENDPOINT,
      "service-endpoint-err-create",
      err
    );
  }
};

interface ServiceEndpointByNameResult {
  count: number;
  value: ServiceEndpoint[];
}
