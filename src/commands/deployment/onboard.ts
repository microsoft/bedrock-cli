import commander from "commander";
import { setSecret } from "../../lib/azure/keyvault";
import {
  createStorageAccountIfNotExists,
  getStorageAccountKey
} from "../../lib/azure/storage";
import { logger } from "../../logger";

/**
 * Adds the onboard command to the commander command object
 * @param command Commander command object to decorate
 */
export const onboardCommandDecorator = (command: commander.Command): void => {
  command
    .command("onboard")
    .alias("o")
    .description(
      "Onboard to use the service introspection tool. This will create a storage account in your subscription. "
    )
    .option(
      "-n, --storage-account-name <storage-account-name",
      "Account name for the storage table"
    )
    .option(
      "-l, --storage-location <storage-location>",
      "Azure location for Storage account and resource group when they do not exist"
    )
    .option(
      "-r, --storage-resource-group-name <storage-resource-group-name>",
      "Name of the resource group for the storage account"
    )
    .option(
      "-v, --key-vault-name <key-vault-name>",
      "Name of the Azure key vault"
    )
    .action(async opts => {
      try {
        if (
          opts.storageAccountName &&
          opts.storageResourceGroupName &&
          opts.storageLocation &&
          opts.keyVaultName
        ) {
          createStorageAccount(
            opts.storageResourceGroupName,
            opts.storageAccountName,
            opts.storageLocation,
            opts.keyVaultName
          );
        } else {
          logger.error(
            "You need to specify a resource group name, storage account name, storage location and a keyvault name"
          );
          return;
        }
      } catch (err) {
        logger.error(`Error occurred while onboarding ${err}`);
      }
    });
};

/**
 * Creates the Storage account `accountName` in resource group `resourceGroup`, sets storage account access key in keyvalut, and updates pipelines (acr-hld, hld->manifests)
 *
 * @param resourceGroup Name of Azure reesource group
 * @param accountName The Azure storage account name
 * @param location The Azure storage account location
 */
export const createStorageAccount = async (
  resourceGroup: string,
  accountName: string,
  location: string,
  keyVaultName: string
) => {
  logger.info(
    `init called with ${resourceGroup}, ${accountName}, ${location}, and ${keyVaultName}`
  );
  await createStorageAccountIfNotExists(resourceGroup, accountName, location);
  logger.info(
    `Storage account ${accountName} in ${resourceGroup} initialization is complete.`
  );

  const key = await getStorageAccountKey(resourceGroup, accountName);

  if (key === undefined) {
    const errorMessage: string = `Storage account ${accountName} access keys in resource group ${resourceGroup}is not available`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  logger.debug(
    `Calling setSecret with storage account primary key ${key} and ${keyVaultName}`
  );
  await setSecret(keyVaultName, `${accountName}Key`, key!);

  // TODO: Update acr -> hld pipeline

  // TODO: Update hld -> manifest pipeline
};
