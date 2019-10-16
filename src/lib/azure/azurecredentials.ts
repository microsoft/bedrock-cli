import { ClientSecretCredential } from "@azure/identity";
import * as msRestNodeAuth from "@azure/ms-rest-nodeauth";
import { Config } from "../../config";
import { logger } from "../../logger";

/**
 * Create an instance of `ClientSecretCredential` and returns for Azure data plane activities
 */
export const getCredentials = async (): Promise<
  ClientSecretCredential | undefined
> => {
  if (!verifyConfigDefined()) {
    return undefined;
  }
  const config = Config();

  return new ClientSecretCredential(
    config.introspection!.azure!.tenant_id!,
    config.introspection!.azure!.service_principal_id!,
    config.introspection!.azure!.service_principal_secret!
  );
};

/**
 * Create an instance of `ApplicationTokenCredentials` and returns for Azure Control/Management plane activities
 */
export const getManagementCredentials = async (): Promise<
  msRestNodeAuth.ApplicationTokenCredentials | undefined
> => {
  if (!verifyConfigDefined()) {
    return undefined;
  }
  const config = Config();

  return msRestNodeAuth.loginWithServicePrincipalSecret(
    config.introspection!.azure!.service_principal_id!,
    config.introspection!.azure!.service_principal_secret!,
    config.introspection!.azure!.tenant_id!
  );
};

const verifyConfigDefined = (): boolean => {
  const config = Config();
  if (
    config.introspection &&
    config.introspection.azure &&
    config.introspection.azure.service_principal_id &&
    config.introspection.azure.tenant_id &&
    config.introspection.azure.service_principal_secret
  ) {
    return true;
  }
  logger.error(
    `Configuration is missing required fields tenant_id, service_principal_id and service_principal_secret. Please run the init command`
  );
  return false;
};
