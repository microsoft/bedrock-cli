import child_process from "child_process";
import commander from "commander";
import emoji from "node-emoji";
import shelljs from "shelljs";
import { promisify } from "util";
import { Config } from "../../config";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { logger } from "../../logger";
import { IConfigYaml } from "../../types";
import decorator from "./validate.decorator.json";

const binaries: string[] = ["terraform", "git", "az", "helm"];
const envVar: string[] = [
  "ARM_SUBSCRIPTION_ID",
  "ARM_CLIENT_ID",
  "ARM_CLIENT_SECRET",
  "ARM_TENANT_ID"
];

export const execute = async (exitFn: (status: number) => Promise<void>) => {
  try {
    if (validatePrereqs(binaries, false)) {
      logger.info(
        emoji.emojify(
          "Installation of Prerequisites verified: :white_check_mark:"
        )
      );
      if (await validateAzure(false)) {
        logger.info(
          emoji.emojify("Azure account verified: :white_check_mark:")
        );
        if (validateEnvVariables(envVar, false)) {
          logger.info(
            emoji.emojify("Environment variables verified: :white_check_mark:")
          );
        }
      }
    }
    await exitFn(0);
  } catch (err) {
    logger.error(`Error validating init prerequisites`);
    logger.error(err);
    await exitFn(1);
  }
};

export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async () => {
    execute(async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};

/**
 * Validates that prerequisites are installed
 *
 * @param executables Array of exectuables to check for in PATH
 */
export const validatePrereqs = (
  executables: string[],
  globalInit: boolean
): boolean => {
  const config = Config();
  config.infra = config.infra || {};
  config.infra.checks = config.infra.checks || {};

  // Validate executables in PATH
  for (const i of executables) {
    if (!shelljs.which(i)) {
      config.infra.checks[i] = false;
      if (globalInit === true) {
        logger.warn(i + " not installed.");
      } else {
        logger.error(
          emoji.emojify(":no_entry_sign: '" + i + "'" + " not installed")
        );
        return false;
      }
    } else {
      config.infra.checks[i] = true;
    }
  }
  return true;
};

/**
 * Validates that user is logged into Azure CLI
 */
export const validateAzure = async (globalInit: boolean): Promise<boolean> => {
  const config = Config();
  config.infra = config.infra || {};
  config.infra.checks = config.infra.checks || {};

  try {
    await promisify(child_process.exec)("az account show -o none");
  } catch (err) {
    if (globalInit === true) {
      logger.warn(
        "Unable to authenticate with Azure CLI. Please run 'az login'."
      );
    } else {
      logger.error(emoji.emojify(":no_entry_sign: " + err));
    }
    config.infra.checks.az_login_check = false;
    return false;
  }
  config.infra.checks.az_login_check = true;
  return true;
};

/**
 * Validates that environment variables are set and not null
 *
 * @param variables Array of environment vairables to check for
 */
export const validateEnvVariables = (
  variables: string[],
  globalInit: boolean
): boolean => {
  const config = Config();
  config.infra = config.infra || {};
  config.infra.checks = config.infra.checks || {};

  // Validate environment variables
  for (const i of variables) {
    if (!process.env[i]) {
      if (globalInit === true) {
        logger.warn(i + " not set as an environment variable");
      } else {
        logger.error(
          emoji.emojify(
            ":no_entry_sign: " + i + " not set as an environment variable."
          )
        );
      }
      config.infra.checks.env_var_check = false;
      return false;
    } else if (process.env[i] && process.env[i] === "") {
      if (globalInit === true) {
        logger.warn(i + " cannot be null.");
      } else {
        logger.error(
          emoji.emojify(":no_entry_sign: " + i + " cannot be null.")
        );
      }
      config.infra.checks.env_var_check = false;
      return false;
    }
  }
  config.infra.checks.env_var_check = true;
  return true;
};
