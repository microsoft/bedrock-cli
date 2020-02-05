import commander from "commander";
import shelljs from "shelljs";
import { Config, loadConfiguration, saveConfiguration } from "../config";
import { logger } from "../logger";

/**
 * Adds the init command to the commander command object
 * @param command Commander command object to decorate
 */
export const initCommandDecorator = (command: commander.Command): void => {
  command
    .command("init")
    .alias("i")
    .description("Initialize the spk tool for the first time.")
    .option("-f, --file <config-file-path>", "Path to the config file.")
    .action(async opts => {
      try {
        if (!opts.file) {
          logger.error(
            "You need to specify a file that stores configuration. "
          );
          return;
        }
        loadConfiguration(opts.file);
        await saveConfiguration(opts.file);
        logger.info("Successfully initialized the spk tool!");
      } catch (err) {
        logger.error(`Error occurred while initializing`);
        logger.error(err);
      }
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
        logger.error(":no_entry_sign: '" + i + "'" + " not installed");
        return false;
      }
    } else {
      config.infra.checks[i] = true;
    }
  }
  return true;
};
