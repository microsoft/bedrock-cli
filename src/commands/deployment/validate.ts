import commander from "commander";
import { Config } from "../../config";
import {
  addSrcToACRPipeline,
  deleteFromTable,
  findMatchingDeployments,
  IDeploymentTable,
  updateACRToHLDPipeline
} from "../../lib/azure/deploymenttable";
import { storageAccountExists } from "../../lib/azure/storage";
import { logger } from "../../logger";
import { IConfigYaml } from "../../types";

const service = "spk-self-test";

/**
 * Adds the validate command to the commander command object
 * @param command Commander command object to decorate
 */
export const validateCommandDecorator = (command: commander.Command): void => {
  command
    .command("validate")
    .alias("v")
    .description("Validate the configuration and storage account are correct.")
    .option(
      "-s, --self-test",
      "Run a test for the configured storage account. This will write test data and delete the test data. For more information on the behavior, please check the online documentation."
    )
    .action(async opts => {
      let isValid = await isValidConfig();

      if (isValid) {
        isValid = await isValidStorageAccount();

        if (isValid && opts.selfTest) {
          const config = Config();
          await runSelfTest(config);
        }
      }
    });
};

/**
 * Validates that the deployment configuration is specified.
 */
export const isValidConfig = (): boolean => {
  const missingConfig = [];
  const config = Config();
  if (!config.introspection) {
    missingConfig.push("introspection");
  } else {
    if (!config.introspection.azure) {
      missingConfig.push("config.introspection.azure");
    } else {
      if (!config.introspection.azure.account_name) {
        missingConfig.push("config.introspection.azure.account_name");
      }
      if (!config.introspection.azure.key) {
        missingConfig.push("config.introspection.azure.key");
      }
      if (!config.introspection.azure.partition_key) {
        missingConfig.push("config.introspection.azure.partition_key");
      }
      if (!config.introspection.azure.table_name) {
        missingConfig.push("config.introspection.azure.table_name");
      }
    }
    if (!config.azure_devops) {
      missingConfig.push("config.azure_devops");
    } else {
      if (!config.azure_devops.org) {
        missingConfig.push("config.azure_devops.org");
      }
      if (!config.azure_devops.project) {
        missingConfig.push("config.azure_devops.project");
      }
    }
  }

  if (missingConfig.length > 0) {
    logger.error(
      "Validation failed. Missing configuration: " + missingConfig.join(" ")
    );
    return false;
  }

  return true;
};

/**
 * Check is the configured storage account is valid
 */
export const isValidStorageAccount = async (): Promise<boolean> => {
  const config = Config();
  const isValid = await storageAccountExists(
    config.introspection!.azure!.resource_group!,
    config.introspection!.azure!.account_name!,
    config.introspection!.azure!.key!
  );

  if (!isValid) {
    logger.error("Storage account validation failed.");
    return false;
  }

  logger.info("Storage account validation passed.");
  return true;
};

/**
 * Run the self-test for introspection
 * @param config spk configuration values
 */
export const runSelfTest = async (config: IConfigYaml): Promise<any> => {
  try {
    logger.info("Writing self-test data for introspection...");
    const buildId = await writeSelfTestData(
      config.introspection!.azure!.key!,
      config.introspection!.azure!.account_name!,
      config.introspection!.azure!.partition_key!,
      config.introspection!.azure!.table_name!
    );

    logger.info("Deleting self-test data...");
    const isVerified = await deleteSelfTestData(
      config.introspection!.azure!.key!,
      config.introspection!.azure!.account_name!,
      config.introspection!.azure!.partition_key!,
      config.introspection!.azure!.table_name!,
      buildId
    );

    const statusMessage =
      "Finished running self-test. Service introspection self-test status: ";

    if (!isVerified) {
      logger.error(statusMessage + "FAILED. Please try again.");
    } else {
      logger.info(statusMessage + "SUCCEEDED.");
    }
  } catch (err) {
    logger.error("Error running self-test.");
    logger.error(err);
  }
};

/**
 * Writes self-test pipeline data to the storage account table.
 * @param accountKey storage account key
 * @param accountName storage account name
 * @param partitionKey storage account table partition key
 * @param tableName storage account table name
 */
export const writeSelfTestData = async (
  accountKey: string,
  accountName: string,
  partitionKey: string,
  tableName: string
): Promise<string> => {
  // call create
  const tableInfo: IDeploymentTable = {
    accountKey,
    accountName,
    partitionKey,
    tableName
  };

  const buildId = Math.floor(Math.random() * 1000).toString();

  try {
    const p1Id = buildId;
    const imageTag = "spk-test-123";
    const commitId = "6nbe" + buildId;
    const env = "SPK-TEST";

    logger.info("Adding src to ACR data to service introspection...");
    await addSrcToACRPipeline(tableInfo, p1Id, imageTag, service, commitId);

    const p2Id = buildId;
    logger.info("Adding ACR to HLD data to service introspection...");
    await updateACRToHLDPipeline(tableInfo, p2Id, imageTag, commitId, env);

    return new Promise<string>(resolve => {
      resolve(buildId);
    });
  } catch (err) {
    logger.error("Error writing data to service introspection.");
    logger.error(err);

    return new Promise<string>(resolve => {
      resolve("");
    });
  }
};

/**
 * Deletes self-test pipeline data from the storage account table.
 * self-test data is identified by the 'self-test' service name.
 * @param accountKey storage account key
 * @param accountName storage account name
 * @param partitionKey storage account table partition key
 * @param tableName storage account table name
 * @param buildId build ID for the test data that was added
 */
export const deleteSelfTestData = async (
  accountKey: string,
  accountName: string,
  partitionKey: string,
  tableName: string,
  buildId: string
): Promise<boolean> => {
  // search by service
  const tableInfo: IDeploymentTable = {
    accountKey,
    accountName,
    partitionKey,
    tableName
  };

  const isDeleted = await findMatchingDeployments(
    tableInfo,
    "service",
    service
  ).then(async entries => {
    let entryToDelete: any;
    logger.info("Deleting test data...");
    let foundEntry = false;

    try {
      for (const entry of entries) {
        entryToDelete = entry;

        if (entry.p1 && entry.p1._ === buildId) {
          foundEntry = true;
        }
        await deleteFromTable(tableInfo, entry);
      }
    } catch (err) {
      logger.error("Error deleting test data.");
      logger.error(err);
      return false;
    }
    return foundEntry;
  });
  return isDeleted;
};
