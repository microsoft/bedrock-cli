import { ClientSecretCredential } from "@azure/identity";
import * as msRestNodeAuth from "@azure/ms-rest-nodeauth";
import { Config } from "../../config";
import { logger } from "../../logger";
import { AzureAccessOpts } from "../../types";
import { build as buildError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../errorStatusCode";

const verifyConfigDefined = (
  servicePrincipalId?: string,
  servicePrincipalPassword?: string,
  tenantId?: string
): boolean => {
  if (servicePrincipalId && servicePrincipalPassword && tenantId) {
    return true;
  }
  logger.error(
    `Configuration is missing required fields tenant_id, service_principal_id and service_principal_secret. Please run the init command`
  );
  return false;
};

/**
 * Create an instance of `ClientSecretCredential` and returns for Azure data plane activities
 * @param opts optionally override bedrock config with Azure subscription access options
 */
export const getCredentials = async (
  opts: AzureAccessOpts = {}
): Promise<ClientSecretCredential | undefined> => {
  let servicePrincipalId = opts.servicePrincipalId;
  let servicePrincipalPassword = opts.servicePrincipalPassword;
  let tenantId = opts.tenantId;

  // Load config from opts and fallback to bedrock config
  const config = Config();
  const azure =
    config && config.introspection ? config.introspection.azure : undefined;

  if (azure) {
    servicePrincipalId = servicePrincipalId || azure.service_principal_id;
    servicePrincipalPassword =
      servicePrincipalPassword || azure.service_principal_secret;
    tenantId = tenantId || azure.tenant_id;
  }

  if (
    !verifyConfigDefined(servicePrincipalId, servicePrincipalPassword, tenantId)
  ) {
    return undefined;
  }

  // verifyConfigDefined has confirmed that these values are defined.
  return new ClientSecretCredential(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    tenantId!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    servicePrincipalId!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    servicePrincipalPassword!
  );
};

/**
 * Create an instance of `ApplicationTokenCredentials` and returns for Azure Control/Management plane activities
 * @param opts optionally override bedrock config with Azure subscription access options
 */
export const getManagementCredentials = async (
  opts: AzureAccessOpts = {}
): Promise<msRestNodeAuth.ApplicationTokenCredentials | undefined> => {
  // Load config from opts and fallback to bedrock config
  const conf = Config();
  let servicePrincipalId = opts.servicePrincipalId;
  let servicePrincipalPassword = opts.servicePrincipalPassword;
  let tenantId = opts.tenantId;

  if (conf && conf.introspection && conf.introspection.azure) {
    const azure = conf.introspection.azure;
    servicePrincipalId = servicePrincipalId || azure.service_principal_id;
    servicePrincipalPassword =
      servicePrincipalPassword || azure.service_principal_secret;
    tenantId = tenantId || azure.tenant_id;
  }

  if (
    !verifyConfigDefined(servicePrincipalId, servicePrincipalPassword, tenantId)
  ) {
    return undefined;
  }

  try {
    // verifyConfigDefined has confirmed that these values are defined.
    return await msRestNodeAuth.loginWithServicePrincipalSecret(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      servicePrincipalId!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      servicePrincipalPassword!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      tenantId!
    );
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_CLIENT,
      "azure-client-auth-sp-err",
      err
    );
  }
};
