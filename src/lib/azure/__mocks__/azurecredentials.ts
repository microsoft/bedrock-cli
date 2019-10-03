import { ClientSecretCredential } from "@azure/identity";
import * as msRestNodeAuth from "@azure/ms-rest-nodeauth";

export const getCredentials = async (): Promise<ClientSecretCredential> => {
  return new ClientSecretCredential(
    "azureTenantId",
    "azureClientId",
    "azureClientSecret"
  );
};

export const getManagementCredentials = async (): Promise<
  msRestNodeAuth.ApplicationTokenCredentials
> => {
  return msRestNodeAuth.loginWithServicePrincipalSecret(
    "azureClientId",
    "azureClientSecret",
    "azureTenantId"
  );
};
