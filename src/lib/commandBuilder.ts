import commander from "commander";
import fs from "fs";
import { Logger, transports } from "winston";
import { logger } from "../logger";
import { hasValue } from "./validator";

/**
 * Command Option
 */
export interface CommandOption {
  arg: string;
  description: string;
  required?: boolean;
  defaultValue?: string | boolean;
}

/**
 * Command Descriptor
 */
export interface CommandBuildElements {
  command: string;
  alias: string;
  description: string;
  disabled?: boolean;
  options?: CommandOption[];
}

interface CommandVariableName2Opt {
  opt: CommandOption;
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
  decorator: CommandBuildElements
): commander.Command => {
  const cmd = command
    .command(decorator.command)
    .alias(decorator.alias)
    .description(decorator.description);

  (decorator.options || []).forEach(opt => {
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
  decorator: CommandBuildElements,
  values: { [key: string]: string | undefined }
): string[] => {
  // gather the required options
  const required = (decorator.options || []).filter(opt => opt.required);

  // no required variables hence return empty error array
  if (required.length === 0) {
    return [];
  }

  // opt name to variable name mapping
  // example --org-name is orgName
  const mapVariableName2Opt: CommandVariableName2Opt[] = required
    .filter(opt => !!opt.arg.match(/\s?--([-\w]+)\s?/))
    .map(opt => {
      const match = opt.arg.match(/\s?--([-\w]+)\s?/);

      // match! cannot be null because it is prefilter
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
  statusCode: number,
  timeout = 10000
): Promise<void> => {
  return new Promise(resolve => {
    const hasFileLogger = log.transports.some(t => {
      if (t instanceof transports.File) {
        // callback will be called once if spk.log
        // already exist.
        // it will be called twice if spk.log
        // do not exist. the one call has size === 0
        fs.watchFile(t.filename, curr => {
          if (curr.size > 0) {
            exitFn(statusCode);
            resolve();
          }
        });
        return true;
      }
      return false;
    });
    // file logger may be not added to logger.
    // then we end the command.
    if (!hasFileLogger) {
      exitFn(statusCode);
      resolve();
    } else {
      // this is to handle the case when nothing to be written to spk.log
      // handle fs.watchFile callback will not be execute.
      setTimeout(() => {
        exitFn(statusCode);
        resolve();
      }, timeout); // 10 seconds should be enough
    }
  });
};
