import { SecretClient } from "@azure/keyvault-secrets";
import { logger } from "../../logger";
import { AzureAccessOpts } from "../../types";
import { getCredentials } from "./azurecredentials";

export const validateValues = (
  keyVaultName: string,
  secretName: string,
  secretValue?: string
): void => {
  const errors: string[] = [];
  if (!keyVaultName) {
    errors.push(`Invalid keyVaultName`);
  }
  if (!secretName) {
    errors.push(`Invalid secretName`);
  }
  if (secretValue !== undefined && !secretValue) {
    errors.push(`Invalid secretValue`);
  }
  if (errors.length !== 0) {
    throw Error(`\n${errors.join("\n")}`);
  }
};

export const getClient = async (
  keyVaultName: string,
  opts: AzureAccessOpts
): Promise<SecretClient> => {
  const url = `https://${keyVaultName}.vault.azure.net`;
  const credentials = await getCredentials(opts);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return new SecretClient(url, credentials!);
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
  validateValues(keyVaultName, secretName, secretValue);
  const messageWithNoValue = `secret ${secretName} in key vault ${keyVaultName}`;

  try {
    const client = await getClient(keyVaultName, opts);
    logger.debug(`Setting ${messageWithNoValue}`);
    await client.setSecret(secretName, secretValue);
    logger.debug(`Setting ${messageWithNoValue} is complete`);
  } catch (err) {
    logger.error(`Unable to set ${messageWithNoValue}. \n ${err}`);
    throw err;
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
  validateValues(keyVaultName, secretName);

  const message = `secret ${secretName} from key vault ${keyVaultName}`;
  try {
    const client = await getClient(keyVaultName, opts);
    logger.debug(`Getting ${message}`);
    const latestSecret = await client.getSecret(secretName);
    logger.debug(`Got ${message}`);
    return latestSecret.value;
  } catch (err) {
    if (err.code === "SecretNotFound" && err.statusCode === 404) {
      return undefined;
    }
    logger.error(`Unable to read ${message}. \n ${err}`);
    throw err;
  }
};
