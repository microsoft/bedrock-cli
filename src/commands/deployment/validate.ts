import commander from "commander";
import { storageAccountExists } from "../../lib/azure/storage";
import { logger } from "../../logger";
import { config } from "../init";

/**
 * Adds the validate command to the commander command object
 * @param command Commander command object to decorate
 */
export const validateCommandDecorator = (command: commander.Command): void => {
  command
    .command("validate")
    .alias("v")
    .description(
      "Validate deployment(s) for a service, release environment, build Id, commit Id, or image tag."
    )
    .action(async () => {
      await isValidConfig();
      await isValidStorageAccount();
    });
};

/**
 * Validates that the deployment configuration is specified.
 */
export const isValidConfig = (): boolean => {
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
