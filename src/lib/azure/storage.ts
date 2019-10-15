import { StorageAccounts, StorageManagementClient } from "@azure/arm-storage";
import {
  Kind,
  SkuName,
  StorageAccountsCheckNameAvailabilityResponse,
  StorageAccountsCreateResponse,
  StorageAccountsListByResourceGroupResponse,
  StorageAccountsListKeysResponse
} from "@azure/arm-storage/esm/models";
import { exec } from "child_process";
import { promisify } from "util";
import { config } from "../../commands/init";
import { logger } from "../../logger";
import { getManagementCredentials } from "./azurecredentials";

/**
 * Creates  Azure storate account `name` in resource group `resourceGroup` in 1ocation `location`
 *
 * @param resourceGroup Name of Azure reesource group
 * @param name The Azure storage account name
 * @param location The Azure storage account location
 */
export const getStorageClient = async (): Promise<StorageManagementClient> => {
  const creds = await getManagementCredentials();
  return new StorageManagementClient(
    creds!,
    config.introspection!.azure!.subscription_id!
  );
};

/**
 * Checks if the given storage account and key exist in Azure storage
 * @param resourceGroup The resource group where the storage account is
 * @param accountName The storage account name
 * @param key The storage account access key
 */
export const storageAccountExists = async (
  resourceGroup: string,
  accountName: string,
  key: string
): Promise<boolean> => {
  try {
    logger.info(`Validating storage account ${accountName}.`);
    const client = await getStorageClient();
    const isNameAvailable = await isStorageAccountNameAvailable(
      accountName,
      client
    );

    if (isNameAvailable) {
      logger.error(`Storage account ${accountName} does not exist.`);
      return false;
    }

    const storageAccountKeys = await getStorageAccountKeys(
      accountName,
      resourceGroup,
      client
    );

    if (typeof storageAccountKeys !== "undefined") {
      for (const storageKey of storageAccountKeys) {
        if (storageKey === key) {
          logger.info(
            `Storage account validation for ${accountName} succeeded.`
          );
          return true;
        }
      }
    }

    logger.error(
      `Storage account ${accountName} access keys is not valid or does not exist.`
    );

    return false;
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

/**
 * Checks if the given storage account name already exists
 * @param accountName The storage account name
 * @param client The Azure storage client
 */
export const isStorageAccountNameAvailable = async (
  accountName: string,
  client: StorageManagementClient
): Promise<boolean> => {
  logger.verbose(`Check if storage account name ${accountName} exists`);

  const nameAvailabilityResult = await client.storageAccounts.checkNameAvailability(
    accountName
  );

  return nameAvailabilityResult.nameAvailable!;
};

/**
 * Gets the access keys for the given storage account
 * @param accountName The storage account name
 * @param resourceGroup The resource group where the storage account is
 * @param client The Azure storage client
 */
export const getStorageAccountKeys = async (
  accountName: string,
  resourceGroup: string,
  client: StorageManagementClient
): Promise<string[]> => {
  const storageAccountKeys: string[] = [];

  logger.verbose(`Get storage account keys for ${accountName}`);
  const keysResponse = await client.storageAccounts.listKeys(
    resourceGroup,
    accountName
  );

  if (typeof keysResponse.keys !== "undefined") {
    for (const storageKey of keysResponse.keys) {
      storageAccountKeys.push(storageKey.value!);
    }
  }

  return storageAccountKeys;
};

/**
 * Creates Azure storate account `name` in resource group `resourceGroup` in 1ocation `location` if it is not exist
 *
 * @param resourceGroup Name of Azure reesource group
 * @param accountName The Azure storage account name
 * @param location The Azure storage account location
 */
export const createStorageAccountIfNotExists = async (
  resourceGroup: string,
  accountName: string,
  location: string
) => {
  const message = `Azure storage account ${accountName} in resource group ${resourceGroup}`;
  try {
    logger.info(`Finding ${message}`);
    const client = await getStorageClient();
    const accounts: StorageAccountsListByResourceGroupResponse = await client.storageAccounts.listByResourceGroup(
      resourceGroup
    );

    let exists = false;

    if (accounts === undefined || accounts === null) {
      logger.debug(`No storage accounts found in ${resourceGroup}`);
    } else {
      logger.debug(
        `${accounts.length} storage accounts found in ${resourceGroup}`
      );
      for (const account of accounts) {
        logger.debug(`Found ${account.name} so far`);
        if (account.name === accountName) {
          exists = true;
          break;
        }
      }
    }

    // Storage account exists so exit the method.
    if (exists) {
      logger.info(`Found ${message}`);
      return;
    }
    logger.info(`${message} does not exist`);
    // Storage account does not exist so create it.
    await createStorageAccount(resourceGroup, accountName, location);
  } catch (err) {
    logger.error(`Error occurred while checking and creating ${message}`);
    logger.error(err);
    throw err;
  }
};

/**
 * Creates Azure storate account `name` in resource group `resourceGroup` in 1ocation `location`
 *
 * @param resourceGroup Name of Azure reesource group
 * @param accountName The Azure storage account name
 * @param location The Azure storage account location
 */
export const createStorageAccount = async (
  resourceGroup: string,
  accountName: string,
  location: string
) => {
  const message = `Azure storage account ${accountName} in resource group ${resourceGroup} in ${location} location.`;
  try {
    logger.verbose(`Create storage client object.`);
    const client = await getStorageClient();
    logger.verbose(
      `Checking for storage account name ${accountName} availability`
    );
    const response: StorageAccountsCheckNameAvailabilityResponse = await client.storageAccounts.checkNameAvailability(
      accountName
    );

    if (response.nameAvailable === false) {
      const nameErrorMessage: string = `Storage account name ${accountName} is not available. Please choose a different name.`;
      logger.error(nameErrorMessage);
      throw new Error(nameErrorMessage);
    }

    logger.verbose(`Storage account name ${accountName} is availabile`);

    // Proceed to create a storage account
    const createParameters = {
      kind: "Storage" as Kind,
      location,
      sku: {
        name: "Standard_LRS" as SkuName
      }
    };

    logger.info(`Creating ${message}`);
    const resp: StorageAccountsCreateResponse = await client.storageAccounts.create(
      resourceGroup,
      accountName,
      createParameters
    );

    logger.info(`Created ${message}`);
  } catch (err) {
    logger.error(`Error occurred while creating ${message}`);
    logger.error(err);
    throw err;
  }
};

/**
 * Get storage account `accountName` primary key in resource group `resourceGroup` nd returns the primary key `Promise<string>`
 *
 * @param resourceGroup Name of Azure reesource group
 * @param accountName The Azure storage account name
 *
 */
export const getStorageAccountKey = async (
  resourceGroup: string,
  accountName: string
): Promise<string | undefined> => {
  try {
    const client = await getStorageClient();
    logger.verbose(`Reading storage account ${accountName} access keys`);

    const keyResults: StorageAccountsListKeysResponse = await client.storageAccounts.listKeys(
      resourceGroup,
      accountName
    );
    if (keyResults.keys === undefined) {
      logger.verbose(`Storage account ${accountName} access keys do not exist`);
      return undefined;
    }

    logger.verbose(
      `${keyResults.keys.length} Storage account access keys exist`
    );
    const key = keyResults.keys![0].value;
    logger.verbose(`Returning key: ${key}`);
    return key;
  } catch (err) {
    logger.error(
      `Error occurred while getting the access keys for storage account ${accountName}`
    );
    logger.error(err);
    throw err;
  }
};

/**
 * Creates Azure resource group `name` in 1ocation `location` if not exist already
 *
 * @param name The Azure resource group name
 * @param location The Azure resource group location
 */
export const createResourceGroupIfNotExists = async (
  name: string,
  location: string
) => {
  const message = `Azure resource group ${name} in ${location} location`;
  try {
    logger.info(
      `Checking weather resource group ${name} exists in ${location} location.`
    );
    const response = await promisify(exec)(`az group exists -n ${name}`);
    if (response.stdout === "true") {
      logger.info(`${message} already exists.`);
    } else {
      logger.info(`Creating ${message}`);
      const stdout = await promisify(exec)(
        `az group create -n ${name} -l ${location}`
      );
      logger.info(`Created ${message}`);
    }
  } catch (err) {
    logger.error(`Error occurred while creating ${message}`);
    logger.error(err);
    throw err;
  }
};
