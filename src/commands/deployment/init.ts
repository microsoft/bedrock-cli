import commander from "commander";
import { logger } from "../../logger";
import { config, Helper } from "./helper";

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
    .action(async opts => {
      try {
        if (
          opts.azureOrg &&
          opts.azureProject &&
          opts.manifest &&
          opts.githubManifestUsername &&
          opts.storageAccountKey &&
          opts.storageAccountName &&
          opts.storagePartitionKey &&
          opts.storageTableName
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
          Helper.writeConfigToFile(config);
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
