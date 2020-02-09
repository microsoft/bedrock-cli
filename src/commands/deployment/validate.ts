import commander from "commander";
import { Config } from "../../config";
import {
  addSrcToACRPipeline,
  deleteFromTable,
  findMatchingDeployments,
  IDeploymentTable,
  updateACRToHLDPipeline
} from "../../lib/azure/deploymenttable";
import { validateStorageAccount } from "../../lib/azure/storage";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { logger } from "../../logger";
import { IConfigYaml } from "../../types";
import decorator from "./validator.decorator.json";

const service = "spk-self-test";

export interface ICommandOptions {
  selfTest: boolean;
}

/**
 * Executes the command, can all exit function with 0 or 1
 * when command completed successfully or failed respectively.
 *
 * @param opts validated option values
 * @param exitFn exit function
 */
export const execute = async (
  opts: ICommandOptions,
  exitFn: (status: number) => Promise<void>
) => {
  try {
    const config = Config();
    await isValidConfig(config);
    await isValidStorageAccount(config);

    if (opts.selfTest) {
      await runSelfTest(config);
    }
    await exitFn(0);
  } catch (err) {
    logger.error(err);
    await exitFn(1);
  }
};

/**
 * Adds the validate command to the commander command object
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: ICommandOptions) => {
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};

/**
 * Validates that the deployment configuration is specified.
 */
export const isValidConfig = async (config: IConfigYaml) => {
  const missingConfig = [];

  if (!config.introspection) {
    missingConfig.push("introspection");
  } else {
    if (!config.introspection.azure) {
      missingConfig.push("config.introspection.azure");
    } else {
      if (!config.introspection.azure.account_name) {
        missingConfig.push("config.introspection.azure.account_name");
      }
      const key = await config.introspection.azure.key;

      if (!key) {
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
    throw new Error("missing configuration in spk configuration");
  }
};

/**
 * Check is the configured storage account is valid
 */
export const isValidStorageAccount = async (config: IConfigYaml) => {
  const key = await config.introspection!.azure!.key;
  const isValid = await validateStorageAccount(
    config.introspection!.azure!.resource_group!,
    config.introspection!.azure!.account_name!,
    key!
  );

  if (!isValid) {
    throw new Error("Storage account validation failed.");
  }

  logger.info("Storage account validation passed.");
};

/**
 * Run the self-test for introspection
 *
 * @param config spk configuration values
 */
export const runSelfTest = async (config: IConfigYaml) => {
  try {
    logger.info("Writing self-test data for introspection...");
    const key = await config.introspection!.azure!.key;
    const buildId = await writeSelfTestData(
      key!,
      config.introspection!.azure!.account_name!,
      config.introspection!.azure!.partition_key!,
      config.introspection!.azure!.table_name!
    );

    logger.info("Deleting self-test data...");
    const isVerified = await deleteSelfTestData(
      key!,
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
    throw err;
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

    return buildId;
  } catch (err) {
    logger.error(err);
    throw new Error("Error writing data to service introspection.");
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
    logger.info("Deleting test data...");
    let foundEntry = false;

    try {
      for (const entry of entries) {
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
