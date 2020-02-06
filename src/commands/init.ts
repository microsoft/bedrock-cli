import commander from "commander";
import { loadConfiguration, saveConfiguration } from "../config";
import { build as buildCmd, exit as exitCmd } from "../lib/commandBuilder";
import { hasValue } from "../lib/validator";
import { logger } from "../logger";
import decorator from "./init.decorator.json";

interface ICommandOptions {
  file: string | undefined;
}

/**
 * Executes the command, can all exit function with 0 or 1
 * when command completed successfully or failed respectively.
 *
 * @param opts option value from commander
 * @param exitFn exit function
 */
export const execute = async (
  opts: ICommandOptions,
  exitFn: (status: number) => Promise<void>
) => {
  try {
    if (!hasValue(opts.file)) {
      throw new Error("File that stores configuration is not provided.");
    }
    loadConfiguration(opts.file);
    await saveConfiguration(opts.file);
    logger.info("Successfully initialized the spk tool!");
    await exitFn(0);
  } catch (err) {
    logger.error(`Error occurred while initializing`);
    logger.error(err);
    await exitFn(1);
  }
};

/**
 * Adds the init command to the commander command object
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: ICommandOptions) => {
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
