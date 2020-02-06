import shelljs from "shelljs";
import { Config } from "../config";
import { logger } from "../logger";

/**
 * Values to be validated
 */
export interface IValidationValue {
  value: undefined | null | string;
  error: string;
}

/**
 * Returns true of val is not undefined, not null and not an empty string.
 *
 * @param val Value to inspect
 */
export const hasValue = (val: undefined | null | string): val is string => {
  return val !== undefined && val !== null && val !== "";
};

/**
 * Returns true of val is not undefined, not null and not an empty string
 * and can be converted to integer.
 *
 * @param val Value to inspect
 */
export const isIntegerString = (val: unknown): val is string => {
  if (typeof val !== "string") {
    return false;
  }
  if (val === undefined || val === null || val === "") {
    return false;
  }
  return /^[1-9]\d*$/.test(val);
};

/**
 * Returns true of val is a port number.
 *
 * @param val Value to inspect
 */
export const isPortNumberString = (val: unknown): val is string => {
  if (!isIntegerString(val)) {
    return false;
  }
  const port = parseInt(val, 10);
  return port > 0 && port <= 65535;
};

/**
 * Returns err if val is undefined, null or empty string. Returns
 * otherwise empty string.
 *
 * @param val Value to inspect
 * @param err Error message
 */
export const validateForNonEmptyValue = (
  validValue: IValidationValue
): string => {
  return hasValue(validValue.value) ? "" : validValue.error;
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
