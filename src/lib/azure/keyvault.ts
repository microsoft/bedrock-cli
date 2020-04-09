import { SecretClient } from "@azure/keyvault-secrets";
import { logger } from "../../logger";
import { AzureAccessOpts } from "../../types";
import { build as buildError } from "../errorBuilder";
import { errorStatusCode } from "../errorStatusCode";
import { getCredentials } from "./azurecredentials";

export const validateValues = (
  keyVaultName: string,
  secretName: string,
  secretValue?: string
): void => {
  if (!keyVaultName) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "azure-key-vault-missing-name"
    );
  }
  if (!secretName) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "azure-key-vault-missing-secret-name"
    );
  }
  if (secretValue !== undefined && !secretValue) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "azure-key-vault-missing-secret-value"
    );
  }
};

export const getClient = async (
  keyVaultName: string,
  opts: AzureAccessOpts
): Promise<SecretClient> => {
  try {
    const url = `https://${keyVaultName}.vault.azure.net`;
    const credentials = await getCredentials(opts);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return new SecretClient(url, credentials!);
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_KEY_VAULT_ERR,
      "azure-key-vault-client-err",
      err
    );
  }
};

/**
 * Create or update the secret `secretName` with value `secretValue` in Azure Key Vault `keyVaultName`
 *
 * @param keyVaultName The Azure key vault name
 * @param secretName Name of the secret
 * @param secretValue Value of the secret
 * @param opts optionally override spk config with Azure subscription access options
 *
 */
export const setSecret = async (
  keyVaultName: string,
  secretName: string,
  secretValue: string,
  opts: AzureAccessOpts = {}
): Promise<void> => {
  try {
    validateValues(keyVaultName, secretName, secretValue);
    const messageWithNoValue = `secret ${secretName} in key vault ${keyVaultName}`;

    const client = await getClient(keyVaultName, opts);
    logger.debug(`Setting ${messageWithNoValue}`);
    await client.setSecret(secretName, secretValue);
    logger.debug(`Setting ${messageWithNoValue} is complete`);
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_KEY_VAULT_ERR,
      "azure-key-vault-set-secret-err",
      err
    );
  }
};

/**
 * Gets the secret `secretName` value from Azure key vault `keyVaultName` and returns the value `Promise<string>`
 *
 * @param keyVaultName The Azure key vault name
 * @param secretName Name of the secret
 * @param opts optionally override spk config with Azure subscription access options
 *
 */
export const getSecret = async (
  keyVaultName: string,
  secretName: string,
  opts: AzureAccessOpts = {}
): Promise<string | undefined> => {
  try {
    validateValues(keyVaultName, secretName);
    const message = `secret ${secretName} from key vault ${keyVaultName}`;

    const client = await getClient(keyVaultName, opts);
    logger.debug(`Getting ${message}`);
    const latestSecret = await client.getSecret(secretName);
    logger.debug(`Got ${message}`);
    return latestSecret.value;
  } catch (err) {
    if (err.code === "SecretNotFound" && err.statusCode === 404) {
      return undefined;
    }
    throw buildError(
      errorStatusCode.AZURE_KEY_VAULT_ERR,
      "azure-key-vault-get-secret-err",
      err
    );
  }
};
