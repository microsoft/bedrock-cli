import commander from "commander";
import * as fs from "fs";
import * as os from "os";
import { resolve } from "path";
import AzureDevOpsPipeline from "spektate/lib/pipeline/AzureDevOpsPipeline";
import IPipeline from "spektate/lib/pipeline/Pipeline";
import { setSecret } from "../../lib/azure/keyvault";
import {
  createStorageAccountIfNotExists,
  getStorageAccountKey
} from "../../lib/azure/storage";
import { logger } from "../../logger";

export let config: { [id: string]: string } = {};
const fileLocation = os.homedir() + "/.Spektate";
export let hldPipeline: IPipeline;
export let clusterPipeline: IPipeline;
export let srcPipeline: IPipeline;

/**
 * Adds the init command to the commander command object
 * @param command Commander command object to decorate
 */
export const initCommandDecorator = (command: commander.Command): void => {
  command
    .command("init")
    .alias("i")
    .description("Initialize the deployment tool for the first time")
    .option(
      "-o, --azure-org <azure-org>",
      "Organization under which the project lives in Azure"
    )
    .option(
      "--azure-pipeline-access-token <azure-pipeline-access-token>",
      "Access token for the pipeline (if private)"
    )
    .option(
      "-p, --azure-project <azure-project>",
      "Project under which pipeline lives in Azure"
    )
    .option("-m, --manifest <manifest>", "Name of the Manifest repository")
    .option(
      "--manifest-access-token <manifest-access-token>",
      "Access token for the manifest repository (if private)"
    )
    .option(
      "-u, --github-manifest-username <github-manifest-username>",
      "Username of the Github account who owns manifest repository"
    )
    .option(
      "-k, --storage-account-key <storage-account-key>",
      "Account Key for the storage table"
    )
    .option(
      "-n, --storage-account-name <storage-account-name",
      "Account name for the storage table"
    )
    .option(
      "-s, --storage-partition-key <storage-partition-key>",
      "Partition key in the storage table"
    )
    .option(
      "-t, --storage-table-name <storage-table-name>",
      "Name of the table in storage"
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
          opts.azureOrg &&
          opts.azureProject &&
          opts.storageAccountKey &&
          opts.storageAccountName &&
          opts.storagePartitionKey &&
          opts.storageTableName &&
          opts.storageResourceGroupName &&
          opts.storageLocation &&
          opts.keyVaultName
        ) {
          config.AZURE_ORG = opts.azureOrg;
          config.AZURE_PROJECT = opts.azureProject;
          config.MANIFEST = opts.manifest;
          config.GITHUB_MANIFEST_USERNAME = opts.githubManifestUsername;
          config.STORAGE_ACCOUNT_KEY = opts.storageAccountKey;
          config.STORAGE_ACCOUNT_NAME = opts.storageAccountName;
          config.STORAGE_PARTITION_KEY = opts.storagePartitionKey;
          config.STORAGE_TABLE_NAME = opts.storageTableName;
          config.AZURE_PIPELINE_ACCESS_TOKEN = opts.azurePipelineAccessToken;
          config.MANIFEST_ACCESS_TOKEN = opts.manifestAccessToken;
          config.STORAGE_LOCATION = opts.storageLocation;
          config.STORAGE_RESOURCE_GROUP_NAME = opts.storageResourceGroupName;
          config.KEY_VAULT_NAME = opts.keyVaultName;
          writeConfigToFile(config);
          await initialize(
            config.STORAGE_RESOURCE_GROUP_NAME,
            config.STORAGE_ACCOUNT_NAME,
            config.STORAGE_LOCATION,
            config.KEY_VAULT_NAME
          );
        } else {
          logger.info(
            "You need to specify each of the config settings in order to run any command."
          );
        }
      } catch (err) {
        logger.error(`Error occurred while initializing`);
        logger.error(err);
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
export const initialize = async (
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

/**
 * Initializes the pipelines assuming that the configuration has been loaded
 */
export const initializePipelines = () => {
  srcPipeline = new AzureDevOpsPipeline(
    config.AZURE_ORG,
    config.AZURE_PROJECT,
    false,
    config.AZURE_PIPELINE_ACCESS_TOKEN
  );
  hldPipeline = new AzureDevOpsPipeline(
    config.AZURE_ORG,
    config.AZURE_PROJECT,
    true,
    config.AZURE_PIPELINE_ACCESS_TOKEN
  );
  clusterPipeline = new AzureDevOpsPipeline(
    config.AZURE_ORG,
    config.AZURE_PROJECT,
    false,
    config.AZURE_PIPELINE_ACCESS_TOKEN
  );
};

/**
 * Performs verification of config values to make sure subsequent commands can be run
 */
export const verifyAppConfiguration = async (): Promise<void> => {
  if (
    config.STORAGE_TABLE_NAME === "" ||
    config.STORAGE_TABLE_NAME === undefined ||
    config.STORAGE_PARTITION_KEY === "" ||
    config.STORAGE_PARTITION_KEY === undefined ||
    config.STORAGE_ACCOUNT_NAME === "" ||
    config.STORAGE_ACCOUNT_NAME === undefined ||
    config.STORAGE_ACCOUNT_KEY === "" ||
    config.STORAGE_ACCOUNT_KEY === undefined ||
    config.AZURE_PROJECT === "" ||
    config.AZURE_PROJECT === undefined ||
    config.AZURE_ORG === "" ||
    config.AZURE_ORG === undefined ||
    config.STORAGE_LOCATION === "" ||
    config.STORAGE_LOCATION === undefined ||
    config.STORAGE_RESOURCE_GROUP_NAME === "" ||
    config.STORAGE_RESOURCE_GROUP_NAME === undefined ||
    config.KEY_VAULT_NAME === "" ||
    config.KEY_VAULT_NAME === undefined
  ) {
    return new Promise(async resolvePromise => {
      await configureAppFromFile();
      resolvePromise();
    });
  } else {
    initializePipelines();
  }
};

/**
 * Loads configuration from a file
 */
export const configureAppFromFile = async (): Promise<void> => {
  return new Promise(async (resolvePromise, reject) => {
    await fs.readFile(fileLocation, "utf8", (error, data) => {
      if (error) {
        logger.error(error);
        reject();
        throw error;
      }
      const array = data.split(/\r?\n/);
      array.forEach((row: string) => {
        const key = row.split(/=(.+)/)[0];
        const value = row.split(/=(.+)/)[1];
        config[key] = value;
      });
      initializePipelines();
      resolvePromise();
    });
  });
};

/**
 * Writes configuration to a file
 */
export const writeConfigToFile = async (configMap: any) => {
  let data = "";
  Object.keys(configMap).forEach(key => {
    data += "\n" + key + "=" + configMap[key];
  });
  await fs.writeFile(fileLocation, data, (error: any) => {
    if (error) {
      logger.error(error);
    }
  });
};
