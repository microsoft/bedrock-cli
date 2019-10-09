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
const getStorageClient = async (): Promise<StorageManagementClient> => {
  const creds = await getManagementCredentials();
  return new StorageManagementClient(
    creds,
    config.introspection!.azure!.subscription_id!
  );
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

    // Storage account exists so exit the method.
    if (exists) {
      logger.info(`Found ${message}`);
      return;
    }
    logger.info(`${message} does not exist`);
    // Storage account does not exist so create it.
    await createStorageAccount(resourceGroup, accountName, location);
  } catch (err) {
    logger.error(err);
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
    throw new Error(err);
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
    throw new Error(err);
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
    throw new Error(err);
  }
};
