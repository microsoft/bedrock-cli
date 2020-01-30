import commander from "commander";
import { Logger } from "winston";
import { logger } from "../logger";
import { hasValue } from "./validator";

/**
 * Command Option
 */
export interface ICommandOption {
  arg: string;
  description: string;
  required?: boolean;
  defaultValue?: string | boolean;
}

/**
 * Command Descriptor
 */
export interface ICommandBuildElements {
  command: string;
  alias: string;
  description: string;
  options: ICommandOption[];
}

interface ICommandVariableName2Opt {
  opt: ICommandOption;
  variableName: string;
}

/**
 * Builds a command
 *
 * @param command Commander instance
 * @param decorator Decorator object that influence how command is built.
 * @return new command object;
 */
export const build = (
  command: commander.Command,
  decorator: ICommandBuildElements
): commander.Command => {
  const cmd = command
    .command(decorator.command)
    .alias(decorator.alias)
    .description(decorator.description);

  decorator.options.forEach(opt => {
    if (opt.defaultValue !== undefined) {
      cmd.option(opt.arg, opt.description, opt.defaultValue);
    } else {
      cmd.option(opt.arg, opt.description);
    }
  });

  return cmd;
};

/**
 * Returns error messages if there are missing values for the
 * mandatory options.
 *
 * @param decorator Descriptor for command building
 * @param values Values to be inspected.
 * @return error messages.
 */
export const validateForRequiredValues = (
  decorator: ICommandBuildElements,
  values: { [key: string]: string | undefined }
): string[] => {
  // gather the required options
  const requireds = decorator.options.filter(opt => opt.required === true);

  // opt name to variable name mapping
  // example --org-name is orgName
  const mapVariableName2Opt: ICommandVariableName2Opt[] = requireds
    .filter(opt => !!opt.arg.match(/\s?--([-\w]+)\s?/))
    .map(opt => {
      const match = opt.arg.match(/\s?--([-\w]+)\s?/);

      // match! cannot be null because it is prefilter
      const variableName = match![1]
        .replace(/\.?(-[a-z])/g, (_, y) => {
          return y.toUpperCase();
        })
        .replace(/-/g, "");
      return {
        opt,
        variableName
      };
    });

  // figure out which variables have missing values
  const missingItems = mapVariableName2Opt.filter(
    item => !hasValue(values[item.variableName!])
  );

  // gather the option flags (args) for the missing one
  const errors = missingItems.map(item => item.opt.arg);

  if (errors.length !== 0) {
    logger.error(`the following arguments are required: ${errors.join("\n ")}`);
  }
  return errors;
};

/**
 * Flushs the log, ready to exit the command.
 * In future there may be other housekeeper tasks.
 *
 * @param log Logger instance
 * @param exitFn exit function
 * @param statusCode Exit status code
 */

export const exit = (
  log: Logger,
  exitFn: (status: number) => void,
  statusCode: number
): Promise<void> => {
  return new Promise(resolve => {
    log.info(`--end log: ${statusCode} --`, () => {
      exitFn(statusCode);
      resolve();
    });
  });
};
