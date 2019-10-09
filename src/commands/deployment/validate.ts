import commander from "commander";
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
    .action(() => {
      isValidConfig();
    });
};

/**
 * Validates that the deployment configuration is specified.
 */
export const isValidConfig = (): boolean => {
  const missingConfig = [];

  if (!config.deployment) {
    missingConfig.push("deployment");
  } else {
    if (!config.deployment.storage) {
      missingConfig.push("config.deployment.storage");
    } else {
      if (!config.deployment.storage.account_name) {
        missingConfig.push("config.deployment.storage.account_name");
      }
      if (!config.deployment.storage.key) {
        missingConfig.push("config.deployment.storage.key");
      }
      if (!config.deployment.storage.partition_key) {
        missingConfig.push("config.deployment.storage.partition_key");
      }
      if (!config.deployment.storage.table_name) {
        missingConfig.push("config.deployment.storage.table_name");
      }
    }
    if (!config.deployment.pipeline) {
      missingConfig.push("config.deployment.pipeline");
    } else {
      if (!config.deployment.pipeline.org) {
        missingConfig.push("config.deployment.pipeline.org");
      }
      if (!config.deployment.pipeline.project) {
        missingConfig.push("config.deployment.pipeline.project");
      }
    }
  }

  if (missingConfig.length > 0) {
    logger.error(
      "Validation failed. Missing configuration: " + missingConfig.join(" ")
    );
    return false;
  }

  logger.info("Validation passed.");
  return true;
};
