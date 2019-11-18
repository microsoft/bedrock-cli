import { SecretClient } from "@azure/keyvault-secrets";
import { logger } from "../../logger";
import { IAzureAccessOpts } from "../../types";
import { getCredentials } from "./azurecredentials";

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
  opts: IAzureAccessOpts = {}
) => {
  // validate input
  const errors: string[] = [];

  if (!keyVaultName) {
    errors.push(`Invalid keyVaultName`);
  }

  if (!secretName) {
    errors.push(`Invalid secretName`);
  }

  if (!secretValue) {
    errors.push(`Invalid secretValue`);
  }

  if (errors.length !== 0) {
    throw new Error(`\n${errors.join("\n")}`);
  }

  const url = `https://${keyVaultName}.vault.azure.net`;
  const message = `secret ${secretName} with a value ${secretValue} in key vault ${keyVaultName}`;
  const messageWithNoValue = `secret ${secretName} in key vault ${keyVaultName}`;
  try {
    const credentials = await getCredentials(opts);
    const client = new SecretClient(url, credentials!);

    // Create a secret
    logger.debug(`Setting ${messageWithNoValue}`);
    logger.verbose(`Setting ${message}`);
    const result = await client.setSecret(secretName, secretValue);
    logger.debug(`Setting ${messageWithNoValue} is complete`);
    logger.verbose(`Set ${message} complete`);
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
  opts: IAzureAccessOpts = {}
): Promise<string | undefined> => {
  // validate input
  const errors: string[] = [];

  if (!keyVaultName) {
    errors.push(`Invalid keyVaultName`);
  }

  if (!secretName) {
    errors.push(`Invalid secretName`);
  }

  if (errors.length !== 0) {
    throw new Error(`\n${errors.join("\n")}`);
  }

  const url = `https://${keyVaultName}.vault.azure.net`;
  const message = `secret ${secretName} from key vault ${keyVaultName}`;
  try {
    const credentials = await getCredentials(opts);
    const client = new SecretClient(url, credentials!);

    // Get the secret
    logger.debug(`Getting ${message}`);
    const latestSecret = await client.getSecret(secretName);
    logger.debug(`Got ${message}`);
    logger.verbose(`Found ${message} and the value is ${latestSecret.value}`);
    return latestSecret.value;
  } catch (err) {
    if (err.code === "SecretNotFound" && err.statusCode === 404) {
      return undefined;
    }
    logger.error(`Unable to read ${message}. \n ${err}`);
    throw err;
  }
};
