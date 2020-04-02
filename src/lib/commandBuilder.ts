import commander from "commander";
import fs from "fs";
import { Logger, transports } from "winston";
import { logger } from "../logger";
import { ConfigYaml } from "../types";
import { hasValue } from "./validator";

/**
 * Command Option
 */
export interface CommandOption {
  arg: string;
  description: string;
  inherit?: string;
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
 * Returns variable name associated with an option name.
 * e.g. servicePrincipalId for --service-principal-id
 *
 * @param opt Command option
 */
export const argToVariableName = (opt: CommandOption): string => {
  const match = opt.arg.match(/\s?--([-\w]+)\s?/);
  if (match) {
    return match[1]
      .replace(/\.?(-[a-z])/g, (_, y) => {
        return y.toUpperCase();
      })
      .replace(/-/g, "");
  }
  throw Error(`Could locate option name ${opt.arg}`);
};

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

  (decorator.options || []).forEach((opt) => {
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
 * @param toThrow Throw exception if there are validation error.
 * @return error messages.
 */
export const validateForRequiredValues = (
  decorator: CommandBuildElements,
  opts: unknown,
  toThrow = false
): string[] => {
  // gather the required options
  const required = (decorator.options || []).filter((opt) => opt.required);

  // no required variables hence return empty error array
  if (required.length === 0) {
    return [];
  }

  const values = opts as CommandValues;

  // opt name to variable name mapping
  // example --org-name is orgName
  const mapVariableName2Opt: CommandVariableName2Opt[] = [];
  required.forEach((opt) => {
    mapVariableName2Opt.push({
      opt,
      variableName: argToVariableName(opt),
    });
  });

  // figure out which variables have missing values
  const missingItems = mapVariableName2Opt.filter(
    (item) => !hasValue(values[item.variableName])
  );

  // gather the option flags (args) for the missing one
  const errors = missingItems.map((item) => item.opt.arg);

  if (toThrow && errors.length !== 0) {
    throw `The following arguments are required: ${errors.join("\n ")}`;
  }

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
  return new Promise((resolve) => {
    const hasFileLogger = log.transports.some((t) => {
      if (t instanceof transports.File) {
        // callback will be called once if spk.log
        // already exist.
        // it will be called twice if spk.log
        // do not exist. the one call has size === 0
        fs.watchFile(t.filename, (curr) => {
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

/**
 * Returns the command option that match an variable name.
 * e.g. servicePrincipalId, the option that has name
 * --service-principal-id shall be returned
 *
 * @param decorator command decorator
 * @param name variable name
 */
export const getOption = (
  decorator: CommandBuildElements,
  name: string
): CommandOption | undefined => {
  return decorator.options?.find((opt) => {
    const match = opt.arg.match(/\s?--([-\w]+)\s?/);
    return match && match[1] === name;
  });
};

interface ConfigValues {
  [key: string]: string | ConfigValues | undefined;
}

interface CommandValues {
  [key: string]: string | undefined;
}

/**
 * Populates (inherit) values from config.yaml of user does
 * not provide values to inheritable options.
 *
 * @param decorator command decorator
 * @param config config YAML
 * @param opts option values provided by user.
 */
export const populateInheritValueFromConfig = (
  decorator: CommandBuildElements,
  config: ConfigYaml,
  opts: unknown
): void => {
  if (config && decorator.options) {
    const mapOpts = opts as CommandValues;
    decorator.options
      .filter((o) => !!o.inherit)
      .forEach((option) => {
        const name = argToVariableName(option);

        // skip if the option already has value provided.
        // that's do not need to inherit from config.yaml
        if (!hasValue(mapOpts[name])) {
          let cfg: ConfigValues | string | undefined = config as ConfigValues;

          // .filter((o) => !!o.inherit) already check that option.inherit is
          // defined
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const arr = option.inherit!.split(".");

          // search for value in config.yaml
          while (cfg && typeof config === "object" && arr.length > 0) {
            const k = arr.shift();
            if (k) {
              cfg = (cfg as ConfigValues)[k];
            }
          }
          if (typeof cfg === "string") {
            mapOpts[name] = cfg;
          }
        }
      });
  }
};
