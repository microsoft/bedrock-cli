/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { StorageManagementClient } from "@azure/arm-storage";
import {
  Kind,
  SkuName,
  StorageAccount,
  StorageAccountsCreateResponse,
  StorageAccountsListKeysResponse
} from "@azure/arm-storage/esm/models";
import * as storage from "azure-storage";
import { exec } from "child_process";
import { promisify } from "util";
import { Config } from "../../config";
import { logger } from "../../logger";
import { AzureAccessOpts } from "../../types";
import { getManagementCredentials } from "./azurecredentials";

let storageManagementClient: StorageManagementClient | undefined; // singleton Storage Management Client so it can be reused

/**
 * Creates  Azure storage management client
 *
 * @param opts optionally override spk config with Azure subscription access options
 *
 */
export const getStorageManagementClient = async (
  opts: AzureAccessOpts = {}
): Promise<StorageManagementClient> => {
  if (storageManagementClient !== undefined) {
    logger.debug(`Returing singleton storageManagementClient object`);
    return storageManagementClient;
  }

  const creds = await getManagementCredentials(opts);

  // Load config from opts and fallback to spk config
  const { azure } = Config().introspection!;
  const { subscriptionId = azure && azure.subscription_id } = opts;

  storageManagementClient = new StorageManagementClient(
    creds!,
    subscriptionId!
  );

  logger.debug(`created storageManagementClient object`);
  return storageManagementClient;
};

/**
 * Checks if the given storage account and key exist in Azure storage
 * @param resourceGroup The resource group where the storage account is
 * @param accountName The storage account name
 * @param key The storage account access key
 *
 */
export const validateStorageAccount = async (
  resourceGroup: string,
  accountName: string,
  key: string
): Promise<boolean> => {
  try {
    logger.info(`Validating storage account ${accountName}.`);
    const isNameAvailable = await isStorageAccountNameAvailable(accountName);

    if (isNameAvailable) {
      logger.error(`Storage account ${accountName} does not exist.`);
      return false;
    }

    const storageAccountKeys = await getStorageAccountKeys(
      accountName,
      resourceGroup
    );

    const found = (storageAccountKeys || []).find(k => k === key);
    if (found) {
      logger.info(`Storage account validation for ${accountName} succeeded.`);
      return true;
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
 *
 */
export const isStorageAccountNameAvailable = async (
  accountName: string
): Promise<boolean> => {
  logger.verbose(`Check if storage account name ${accountName} exists`);

  const client = await getStorageManagementClient();
  const nameAvailabilityResult = await client.storageAccounts.checkNameAvailability(
    accountName
  );

  return nameAvailabilityResult.nameAvailable!;
};

/**
 * Gets the access keys for the given storage account
 * @param accountName The storage account name
 * @param resourceGroup The resource group where the storage account is
 * @param opts optionally override spk config with Azure subscription access options
 *
 */
export const getStorageAccountKeys = async (
  accountName: string,
  resourceGroup: string,
  opts: AzureAccessOpts = {}
): Promise<string[]> => {
  // validate input
  const errors: string[] = [];

  if (!resourceGroup) {
    errors.push(`Invalid resourceGroup`);
  }

  if (!accountName) {
    errors.push(`Invalid accountName`);
  }

  if (errors.length !== 0) {
    throw new Error(`\n${errors.join("\n")}`);
  }

  const storageAccountKeys: string[] = [];

  logger.verbose(`Get storage account keys for ${accountName}`);
  const client = await getStorageManagementClient(opts);
  const keysResponse = await client.storageAccounts.listKeys(
    resourceGroup,
    accountName
  );

  if (typeof keysResponse.keys !== "undefined") {
    for (const storageKey of keysResponse.keys!) {
      storageAccountKeys.push(storageKey.value!);
    }
  }

  return storageAccountKeys;
};

/**
 * Checks whether Azure storage account exists in specified resource group `resourceGroup` or not
 *
 * @param resourceGroup Name of Azure resource group
 * @param accountName The Azure storage account name
 * @param opts optionally override spk config with Azure subscription access options
 *
 */
export const isStorageAccountExist = async (
  resourceGroup: string,
  accountName: string,
  opts: AzureAccessOpts = {}
): Promise<boolean> => {
  // validate input
  const errors: string[] = [];

  if (!resourceGroup) {
    errors.push(`Invalid resourceGroup`);
  }

  if (!accountName) {
    errors.push(`Invalid accountName`);
  }

  if (errors.length !== 0) {
    throw new Error(`\n${errors.join("\n")}`);
  }

  const message = `Azure storage account ${accountName} in resource group ${resourceGroup}`;
  try {
    const account = await getStorageAccount(resourceGroup, accountName, opts);
    return account !== undefined;
  } catch (err) {
    logger.error(`Error occurred while finding ${message} \n ${err}`);
    throw err;
  }
};

/**
 * Checks whether Azure storage account exists in specified resource group `resourceGroup` or not
 *
 * @param resourceGroup Name of Azure resource group
 * @param accountName The Azure storage account name
 * @param opts optionally override spk config with Azure subscription access options
 *
 */
export const getStorageAccount = async (
  resourceGroup: string,
  accountName: string,
  opts: AzureAccessOpts = {}
): Promise<StorageAccount | undefined> => {
  // validate input
  const errors: string[] = [];

  if (!resourceGroup) {
    errors.push(`Invalid resourceGroup`);
  }

  if (!accountName) {
    errors.push(`Invalid accountName`);
  }

  if (errors.length !== 0) {
    throw new Error(`\n${errors.join("\n")}`);
  }

  const message = `Azure storage account ${accountName} in resource group ${resourceGroup}`;
  try {
    logger.debug(`Finding ${message}`);

    const client = await getStorageManagementClient(opts);
    const accounts = await client.storageAccounts.listByResourceGroup(
      resourceGroup
    );

    if (accounts === undefined || accounts === null || accounts.length === 0) {
      logger.debug(`No storage accounts found in ${resourceGroup}`);
      return undefined;
    }

    logger.debug(
      `${accounts.length} storage accounts found in ${resourceGroup}`
    );

    const found = accounts.find(acc => acc.name === accountName);
    if (found) {
      logger.debug(`Found ${message}`);
    }
    return found;
  } catch (err) {
    logger.error(`Error occurred while getting ${message} \n ${err}`);
    throw err;
  }
};

/**
 * Validates all the values are available for creating a storage
 * account.
 *
 * @param resourceGroup Name of Azure resource group
 * @param accountName The Azure storage account name
 * @param location The Azure storage account location
 */
const validateInputsForCreateAccount = (
  resourceGroup: string,
  accountName: string,
  location: string
): void => {
  // validate input
  const errors: string[] = [];

  if (!resourceGroup) {
    errors.push(`Invalid resourceGroup`);
  }
  if (!accountName) {
    errors.push(`Invalid accountName`);
  }
  if (!location) {
    errors.push(`Invalid location`);
  }
  if (errors.length !== 0) {
    throw new Error(`\n${errors.join("\n")}`);
  }
};

/**
 * Creates Azure storage account `name` in resource group `resourceGroup` in location `location`
 *
 * @param resourceGroup Name of Azure resource group
 * @param accountName The Azure storage account name
 * @param location The Azure storage account location
 * @param opts optionally override spk config with Azure subscription access options
 *
 */
export const createStorageAccount = async (
  resourceGroup: string,
  accountName: string,
  location: string,
  opts: AzureAccessOpts = {}
): Promise<StorageAccount> => {
  const message = `Azure storage account ${accountName} in resource group ${resourceGroup} in ${location} location.`;

  try {
    validateInputsForCreateAccount(resourceGroup, accountName, location);

    logger.verbose(`Create storage client object.`);
    const client = await getStorageManagementClient(opts);
    logger.verbose(
      `Checking for storage account name ${accountName} availability`
    );
    const response = await client.storageAccounts.checkNameAvailability(
      accountName
    );

    if (response.nameAvailable === false) {
      const nameErrorMessage = `Storage account name ${accountName} is not available. Please choose a different name.`;
      logger.error(nameErrorMessage);
      throw new Error(nameErrorMessage);
    }

    logger.verbose(`Storage account name ${accountName} is available`);

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
    return resp;
  } catch (err) {
    logger.error(`Error occurred while creating ${message}. \n ${err}`);
    throw err;
  }
};

/**
 * Get storage account `accountName` primary key in resource group `resourceGroup`
 *
 * @param resourceGroup Name of Azure resource group
 * @param accountName The Azure storage account name
 * @param opts optionally override spk config with Azure subscription access options
 * @returns the storage account primary access key `Promise<string>`
 *
 */
export const getStorageAccountKey = async (
  resourceGroup: string,
  accountName: string,
  opts: AzureAccessOpts = {}
): Promise<string | undefined> => {
  // validate input
  const errors: string[] = [];

  if (!resourceGroup) {
    errors.push(`Invalid resourceGroup`);
  }

  if (!accountName) {
    errors.push(`Invalid accountName`);
  }

  if (errors.length !== 0) {
    throw new Error(`\n${errors.join("\n")}`);
  }

  try {
    const client = await getStorageManagementClient(opts);
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
 * Validates input values for creating storage table.
 *
 * @param accountName The storage account name
 * @param tableName The table name
 * @param accessKey The storage account access key
 */
const validateValuesForCreateStorageTable = (
  accountName: string,
  tableName: string
): void => {
  const errors: string[] = [];

  if (!accountName) {
    errors.push(`Invalid accountName`);
  }
  if (!tableName) {
    errors.push(`Invalid tableName`);
  }

  if (errors.length !== 0) {
    throw new Error(`\n${errors.join("\n")}`);
  }
};

/**
 * Creates table in storage account if not exists
 *
 * @param accountName The storage account name
 * @param tableName The table name
 * @param accessKey The storage account access key
 */
export const createTableIfNotExists = (
  accountName: string,
  tableName: string,
  accessKey: string
): Promise<boolean | undefined> => {
  return new Promise<boolean | undefined>((resolve, reject) => {
    try {
      validateValuesForCreateStorageTable(accountName, tableName);
      const createTblService = storage.createTableService(
        accountName,
        accessKey
      );

      createTblService.createTableIfNotExists(tableName, (err, result) => {
        if (err) {
          logger.error(
            `Unable to create table in storage account ${accountName} \n ${err}`
          );
          reject(err);
        }
        logger.debug(`table result: ${JSON.stringify(result)}`);
        resolve(result.created);
      });
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Creates Azure resource group `name` in location `location` if not exist already
 *
 * @param name The Azure resource group name
 * @param location The Azure resource group location
 *
 */
export const createResourceGroupIfNotExists = async (
  name: string,
  location: string
): Promise<void> => {
  // validate input
  const errors: string[] = [];

  if (!name) {
    errors.push(`Invalid name`);
  }

  if (!location) {
    errors.push(`Invalid location`);
  }

  if (errors.length !== 0) {
    throw new Error(`\n${errors.join("\n")}`);
  }

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
      await promisify(exec)(`az group create -n ${name} -l ${location}`);
      logger.info(`Created ${message}`);
    }
  } catch (err) {
    logger.error(`Error occurred while creating ${message}. \n ${err}`);
    throw err;
  }
};
