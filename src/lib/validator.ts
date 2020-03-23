import shelljs from "shelljs";
import { Config } from "../config";
import { logger } from "../logger";

export const ORG_NAME_VIOLATION =
  "Organization names must start with a letter or number, followed by letters, numbers or hyphens, and must end with a letter or number.";

/**
 * Values to be validated
 */
export interface ValidationValue {
  value: undefined | null | string;
  error: string;
}

/**
 * Returns true of val is not undefined, not null and not an empty string.
 *
 * @param val Value to inspect
 */
export const hasValue = (val: unknown): val is string => {
  if (typeof val !== "string") {
    return false;
  }
  return val.trim() !== "";
};

/**
 * Returns true of val is not undefined, not null and not an empty string
 * and can be converted to integer.
 *
 * @param val Value to inspect
 */
export const isIntegerString = (val: unknown): val is string => {
  if (!hasValue(val)) {
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
  validValue: ValidationValue
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

/**
 * Returns true if organization name is proper.
 *
 * @param value Organization Name
 */
export const validateOrgName = (value: string): string | boolean => {
  if (!hasValue((value || "").trim())) {
    return "Must enter an organization";
  }
  const pass = value.match(
    /^[0-9a-zA-Z][^\s]*[0-9a-zA-Z]$/ // No Spaces
  );
  if (pass) {
    return true;
  }
  return ORG_NAME_VIOLATION;
};

export const isDashHex = (value: string): boolean => {
  return !!value.match(/^[a-f0-9-]+$/);
};

export const isAlphaNumeric = (value: string): boolean => {
  return !!value.match(/^[a-zA-Z0-9]+$/);
};

export const isDashAlphaNumeric = (value: string): boolean => {
  return !!value.match(/^[a-zA-Z0-9-]+$/);
};

/**
 * Returns true if password is proper. Typical password validation
 *
 * @param value password
 */
export const validatePassword = (value: string): string | boolean => {
  if (!hasValue(value)) {
    return "Must enter a value.";
  }
  if (value.length < 8) {
    return "Must be more than 8 characters long.";
  }
  return true;
};

/**
 * Returns true if project name is proper.
 *
 * @param value Project Name
 */
export const validateProjectName = (value: string): string | boolean => {
  if (!hasValue(value)) {
    return "Must enter a project name";
  }
  if (value.length > 64) {
    return "Project name cannot be longer than 64 characters";
  }
  if (value.startsWith("_")) {
    return "Project name cannot begin with an underscore";
  }
  if (value.startsWith(".") || value.endsWith(".")) {
    return "Project name cannot begin or end with a period";
  }

  const invalidChars = [
    "/",
    ":",
    "\\",
    "~",
    "&",
    "%",
    ";",
    "@",
    "'",
    '"',
    "?",
    "<",
    ">",
    "|",
    "#",
    "$",
    "*",
    "}",
    "{",
    ",",
    "+",
    "=",
    "[",
    "]",
  ];
  if (invalidChars.some((x) => value.indexOf(x) !== -1)) {
    return `Project name can't contain special characters, such as / : \\ ~ & % ; @ ' " ? < > | # $ * } { , + = [ ]`;
  }

  return true;
};

/**
 * Returns true if access token is not empty string
 *
 * @param value Access token
 */
export const validateAccessToken = (value: string): string | boolean => {
  if (!hasValue(value)) {
    return "Must enter a personal access token with read/write/manage permissions";
  }
  return true;
};

export const validateServicePrincipal = (
  value: string,
  property: string
): string | boolean => {
  if (!hasValue(value)) {
    return `Must enter a ${property}.`;
  }
  if (!isDashHex(value)) {
    return `The value for ${property} is invalid.`;
  }
  return true;
};

/**
 * Returns true if service principal id is valid
 *
 * @param value service principal id
 */
export const validateServicePrincipalId = (value: string): string | boolean => {
  return validateServicePrincipal(value, "Service Principal Id");
};

/**
 * Returns true if service principal password is valid
 *
 * @param value service principal password
 */
export const validateServicePrincipalPassword = (
  value: string
): string | boolean => {
  return validateServicePrincipal(value, "Service Principal Password");
};

/**
 * Returns true if service principal tenant identifier is valid
 *
 * @param value service principal tenant identifier.
 */
export const validateServicePrincipalTenantId = (
  value: string
): string | boolean => {
  return validateServicePrincipal(value, "Service Principal Tenant Id");
};

/**
 * Returns true if subscription identifier is valid
 *
 * @param value subscription identifier.
 */
export const validateSubscriptionId = (value: string): string | boolean => {
  if (!hasValue(value)) {
    return "Must enter a subscription identifier.";
  }
  if (!isDashHex(value)) {
    return "The value for subscription identifier is invalid.";
  }
  return true;
};

/**
 * Returns true if storage account name is valid.
 *
 * @param value storage account name .
 */
export const validateStorageAccountName = (value: string): string | boolean => {
  if (!hasValue(value)) {
    return "Must enter a storage account name.";
  }
  if (!value.match(/^[a-z0-9]+$/)) {
    return "The value for storage account name is invalid. Lowercase letters and numbers are allowed.";
  }
  if (value.length < 3 || value.length > 24) {
    return "The value for storage account name is invalid. It has to be between 3 and 24 characters long";
  }
  return true;
};

/**
 * Returns true if storage table name is valid.
 *
 * @param value storage table name.
 */
export const validateStorageTableName = (value: string): string | boolean => {
  if (!hasValue(value)) {
    return "Must enter a storage table name.";
  }
  if (!value.match(/^[A-Za-z][A-Za-z0-9]*$/)) {
    return "The value for storage table name is invalid. It has to be alphanumeric and start with an alphabet.";
  }
  if (value.length < 3 || value.length > 63) {
    return "The value for storage table name is invalid. It has to be between 3 and 63 characters long";
  }
  return true;
};

/**
 * Returns true if storage partition key is valid.
 *
 * @param value storage partition key.
 */
export const validateStoragePartitionKey = (
  value: string
): string | boolean => {
  if (!hasValue(value)) {
    return "Must enter a storage partition key.";
  }
  if (value.match(/[/\\#?]/)) {
    return "The value for storage partition key is invalid. /, \\, # and ? characters are not allowed.";
  }
  return true;
};

/**
 * Returns true if Azure Container Registry Name is valid
 *
 * @param value Azure Container Registry Name.
 */
export const validateACRName = (value: string): string | boolean => {
  if (!hasValue(value)) {
    return "Must enter an Azure Container Registry Name.";
  }
  if (!isAlphaNumeric(value)) {
    return "The value for Azure Container Registry Name is invalid.";
  }
  if (value.length < 5 || value.length > 50) {
    return "The value for Azure Container Registry Name is invalid because it has to be between 5 and 50 characters long.";
  }
  return true;
};

export const validateStorageKeyVaultName = (
  value: string
): string | boolean => {
  if (!hasValue(value)) {
    return true; // optional
  }
  if (!isDashAlphaNumeric(value)) {
    return "The value for Key Value  Name is invalid.";
  }
  if (!value.match(/^[a-zA-Z]/)) {
    return "Key Value Name must start with a letter.";
  }
  if (!value.match(/[a-zA-Z0-9]$/)) {
    return "Key Value Name must end with letter or digit.";
  }
  if (value.indexOf("--") !== -1) {
    return "Key Value Name cannot contain consecutive hyphens.";
  }
  if (value.length < 3 || value.length > 24) {
    return "The value for Key Vault Name is invalid because it has to be between 3 and 24 characters long.";
  }
  return true;
};

export const validateStorageAccessKey = (value: string): string | boolean => {
  if (!hasValue(value)) {
    return "Must enter an Storage Access Key.";
  }
  return true;
};
