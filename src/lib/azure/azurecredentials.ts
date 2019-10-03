import { ClientSecretCredential } from "@azure/identity";
import * as msRestNodeAuth from "@azure/ms-rest-nodeauth";
import { azureClientId, azureClientSecret, azureTenantId } from "../../config";

/**
 * Create an instance of `ClientSecretCredential` and returns for Azure data plane activities
 */
export const getCredentials = async (): Promise<ClientSecretCredential> => {
  return new ClientSecretCredential(
    azureTenantId,
    azureClientId,
    azureClientSecret
  );
};

/**
 * Create an instance of `ApplicationTokenCredentials` and returns for Azure Control/Management plane activities
 */
export const getManagementCredentials = async (): Promise<
  msRestNodeAuth.ApplicationTokenCredentials
> => {
  return msRestNodeAuth.loginWithServicePrincipalSecret(
    azureClientId,
    azureClientSecret,
    azureTenantId
  );
};
