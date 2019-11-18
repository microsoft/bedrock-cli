import { StorageAccount } from "@azure/arm-storage/esm/models";
import commander from "commander";
import fs from "fs";
import yaml from "js-yaml";
import { Config, defaultConfigFile, readYaml } from "../../config";
import { setSecret } from "../../lib/azure/keyvault";
import {
  createStorageAccount,
  createTableIfNotExists,
  getStorageAccountKey,
  isStorageAccountExist
} from "../../lib/azure/storage";
import { logger } from "../../logger";
import { IAzureAccessOpts, IConfigYaml } from "../../types";

/**
 * Adds the onboard command to the commander command object
 * @param command Commander command object to decorate
 */
export const onboardCommandDecorator = (command: commander.Command): void => {
  command
    .command("onboard")
    .alias("o")
    .description(
      "Onboard to use the service introspection tool. This will create a storage account if it does not exist in your Azure subscription in the give resource group."
    )
    .option(
      "-s, --storage-account-name <storage-account-name>",
      "Azure storage account name"
    )
    .option(
      "-t, --storage-table-name <storage-table-name>",
      "Azure storage table name"
    )
    .option(
      "-l, --storage-location <storage-location>",
      "Azure location to create new storage account when it does not exist"
    )
    .option(
      "-r, --storage-resource-group-name <storage-resource-group-name>",
      "Name of the resource group to create new storage account when it does not exist"
    )
    .option(
      "-k, --key-vault-name <key-vault-name>",
      "Name of the Azure key vault"
    )
    .option(
      "--service-principal-id <service-principal-id>",
      "Azure service principal id with `contributor` role in Azure Resource Group"
    )
    .option(
      "--service-principal-password <service-principal-password>",
      "The Azure service principal password"
    )
    .option(
      "--tenant-id <tenant-id>",
      "The Azure AD tenant id of service principal"
    )
    .option("--subscription-id <subscription-id>", "The Azure subscription id")
    .action(async opts => {
      try {
        const { azure } = Config().introspection!;
        const {
          storageAccountName = azure && azure.account_name,
          storageTableName = azure && azure.table_name,
          storageLocation,
          storageResourceGroupName,
          keyVaultName = azure && Config().key_vault_name,
          servicePrincipalId = azure && azure.service_principal_id,
          servicePrincipalPassword = azure && azure.service_principal_secret,
          tenantId = azure && azure.tenant_id,
          subscriptionId = azure && azure.subscription_id
        } = opts;

        const accessOpts: IAzureAccessOpts = {
          servicePrincipalId,
          servicePrincipalPassword,
          subscriptionId,
          tenantId
        };

        // required parameters check
        const errors: string[] = await validateRequiredArguments(
          storageAccountName,
          storageTableName,
          storageResourceGroupName,
          accessOpts
        );

        if (errors.length !== 0) {
          logger.error(
            `the following arguments are either required or invalid: \n${errors.join(
              "\n"
            )}`
          );
          return;
        }

        const storageAccount = await onboard(
          storageAccountName,
          storageTableName,
          storageResourceGroupName,
          storageLocation,
          keyVaultName,
          accessOpts
        );
        logger.debug(
          `Service introspection deployment onboarding is complete. \n ${JSON.stringify(
            storageAccount
          )}`
        );
      } catch (err) {
        logger.error(err);
      }
    });
};

/**
 * Creates the Storage account `accountName` in resource group `resourceGroup`, sets storage account access key in keyvalut, and updates pipelines (acr-hld, hld->manifests)
 *
 * @param accountName The Azure storage account name
 * @param tableName The Azure storage table name
 * @param resourceGroup Name of Azure reesource group
 * @param location The Azure storage account location
 * @param keyVaultName Name of Azure key vault
 * @param opts optionally override spk config with Azure subscription access options
 */
export const onboard = async (
  accountName: string,
  tableName: string,
  resourceGroup: string,
  location: string,
  keyVaultName: string,
  opts: IAzureAccessOpts = {}
): Promise<StorageAccount> => {
  logger.debug(
    `onboard called with ${accountName}, ${tableName}, ${resourceGroup}, ${location}, and ${keyVaultName}`
  );

  let storageAccount: StorageAccount | undefined;

  const isExist = await isStorageAccountExist(resourceGroup, accountName, opts);

  // Storage account does not exist so create it.
  if (isExist === false) {
    if (!location) {
      throw new Error(
        "the following argument is required: \n -l / --storage-location"
      );
    }

    storageAccount = await createStorageAccount(
      resourceGroup,
      accountName,
      location,
      opts
    );
    logger.debug(`Storage Account: ${JSON.stringify(storageAccount)}`);
  }

  const accessKey = await getStorageAccountKey(
    resourceGroup,
    accountName,
    opts
  );

  if (accessKey === undefined) {
    throw new Error(
      `Storage account ${accountName} access keys in resource group ${resourceGroup}is not defined`
    );
  }

  const tableCreated = await createTableIfNotExists(
    accountName,
    tableName,
    accessKey!
  );

  logger.debug(`tabled created: ${tableCreated}`);

  // print newly created storage account
  if (storageAccount !== undefined) {
    logger.info(`${JSON.stringify(storageAccount, null, 2)}`);
  }

  if (storageAccount !== undefined && tableCreated === true) {
    logger.info(
      `Storage account ${accountName} and table ${tableName} are created.`
    );
  } else if (storageAccount === undefined && tableCreated === true) {
    logger.info(
      `Table ${tableName} is created in existing storage account ${accountName}.`
    );
  } else if (storageAccount === undefined && tableCreated === false) {
    logger.info(
      `Both storage account ${accountName} and table ${tableName} exist.`
    );
  }

  // if key vault is not specified, exit without reading storage account key and setting it in the key vault
  if (keyVaultName) {
    logger.debug(
      `Calling setSecret with storage account primary key ${accessKey} and ${keyVaultName}`
    );

    await setSecret(keyVaultName, `${accountName}Key`, accessKey!, opts);
  } else {
    // notify the user to set the environment variable with storage access key
    logger.info(
      `Please set the storage account access key in environment variable INTROSPECTION_STORAGE_ACCESS_KEY before issuing any deployment commands.`
    );

    logger.info(`Storage account ${accountName} access key: ${accessKey}`);
  }

  // save storage account and table names in configuration
  await setConfiguration(accountName, tableName);

  return storageAccount!;
};

/**
 * Set storage account and table names in the configuration file at default location
 *
 * @param storageAccountName The Azure storage account name
 * @param storageTableName The Azure storage table name
 */
export const setConfiguration = async (
  storageAccountName: string,
  storageTableName: string
): Promise<boolean> => {
  try {
    const data = readYaml<IConfigYaml>(defaultConfigFile());
    data.introspection!.azure!.account_name = storageAccountName;
    data.introspection!.azure!.table_name = storageTableName;
    const jsonData = yaml.safeDump(data);
    logger.verbose(jsonData);
    fs.writeFileSync(defaultConfigFile(), jsonData);
    return true;
  } catch (err) {
    logger.error(
      `Unable to set storage account and table names in configuration file. \n ${err}`
    );
    throw err;
  }
};

/**
 * Checks arguments for undefined or null and returns errors
 *
 * @param storageAccountName The Azure storage account name
 * @param storageTableName The Azure storage table name
 * @param storageResourceGroup Name of Azure reesource group
 * @param accessOpts The Azure subscription access options
 */
export const validateRequiredArguments = async (
  storageAccountName: any,
  storageTableName: any,
  storageResourceGroup: any,
  accessOpts: IAzureAccessOpts
): Promise<string[]> => {
  const errors: string[] = [];

  if (!storageAccountName) {
    errors.push("\n -s / --storage-account-name");
  }

  if (
    storageAccountName &&
    (await validateStorageName(storageAccountName)) === false
  ) {
    errors.push(
      "The `-s, / --storage-account-name` argument is not valid. Account names contain only alphanumeric characters in lowercase and must be from 3 to 24 characters long."
    );
  }

  if (!storageTableName) {
    errors.push("\n -t / --storage-table-name");
  }

  if (
    storageTableName &&
    (await validateTableName(storageTableName)) === false
  ) {
    errors.push(
      "The `t, / --storage-table-name` argument is not valid. Table names contain only alphanumeric characters, cannot begin with a numeric character, case-insensitive, and must be from 3 to 63 characters long."
    );
  }

  if (!storageResourceGroup) {
    errors.push("\n -r / --storage-resource-group-name");
  }

  if (!accessOpts.servicePrincipalId) {
    errors.push("\n --service-principal-id");
  }

  if (!accessOpts.servicePrincipalPassword) {
    errors.push("\n --service-principal-password");
  }

  if (!accessOpts.tenantId) {
    errors.push("\n --tenant-id");
  }

  if (!accessOpts.subscriptionId) {
    errors.push("\n --subscription-id");
  }

  return errors;
};

export const validateTableName = async (name: string): Promise<boolean> => {
  const regExpression = /^[A-Za-z][A-Za-z0-9]{2,62}$/;
  return regExpression.test(name);
};

export const validateStorageName = async (name: string): Promise<boolean> => {
  const regExpression = /^[0-9a-z][a-z0-9]{2,23}$/;
  return regExpression.test(name);
};
