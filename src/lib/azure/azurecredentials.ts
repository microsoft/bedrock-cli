/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ClientSecretCredential } from "@azure/identity";
import * as msRestNodeAuth from "@azure/ms-rest-nodeauth";
import { Config } from "../../config";
import { logger } from "../../logger";
import { AzureAccessOpts } from "../../types";

/**
 * Create an instance of `ClientSecretCredential` and returns for Azure data plane activities
 * @param opts optionally override spk config with Azure subscription access options
 */
export const getCredentials = async (
  opts: AzureAccessOpts = {}
): Promise<ClientSecretCredential | undefined> => {
  // Load config from opts and fallback to spk config
  const { azure } = Config().introspection!;

  const {
    servicePrincipalId = azure && azure.service_principal_id,
    servicePrincipalPassword = azure && azure.service_principal_secret,
    tenantId = azure && azure.tenant_id
  } = opts;

  if (
    !verifyConfigDefined(servicePrincipalId, servicePrincipalPassword, tenantId)
  ) {
    return undefined;
  }
  return new ClientSecretCredential(
    tenantId!,
    servicePrincipalId!,
    servicePrincipalPassword!
  );
};

/**
 * Create an instance of `ApplicationTokenCredentials` and returns for Azure Control/Management plane activities
 * @param opts optionally override spk config with Azure subscription access options
 */
export const getManagementCredentials = async (
  opts: AzureAccessOpts = {}
): Promise<msRestNodeAuth.ApplicationTokenCredentials | undefined> => {
  // Load config from opts and fallback to spk config
  const { azure } = Config().introspection!;

  const {
    servicePrincipalId = azure && azure.service_principal_id,
    servicePrincipalPassword = azure && azure.service_principal_secret,
    tenantId = azure && azure.tenant_id
  } = opts;

  if (
    !verifyConfigDefined(servicePrincipalId, servicePrincipalPassword, tenantId)
  ) {
    return undefined;
  }

  return msRestNodeAuth.loginWithServicePrincipalSecret(
    servicePrincipalId!,
    servicePrincipalPassword!,
    tenantId!
  );
};

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
