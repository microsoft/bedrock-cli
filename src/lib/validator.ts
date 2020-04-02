import shelljs from "shelljs";
import { Config } from "../config";
import { logger } from "../logger";
import { build as buildError, getErrorMessage } from "./errorBuilder";
import { errorStatusCode } from "./errorStatusCode";

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
    return getErrorMessage("validation-err-org-name-missing");
  }
  const pass = value.match(
    /^[0-9a-zA-Z][^\s]*[0-9a-zA-Z]$/ // No Spaces
  );
  if (pass) {
    return true;
  }
  return getErrorMessage("validation-err-org-name");
};

export const validateOrgNameThrowable = (value: string): void => {
  const err = validateOrgName(value);
  if (typeof err == "string") {
    throw buildError(errorStatusCode.VALIDATION_ERR, err);
  }
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
    return getErrorMessage("validation-err-password-missing");
  }
  if (value.length < 8) {
    return getErrorMessage("validation-err-password-too-short");
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
    return getErrorMessage("validation-err-project-name-missing");
  }
  if (value.length > 64) {
    return getErrorMessage("validation-err-project-name-too-long");
  }
  if (value.startsWith("_")) {
    return getErrorMessage("validation-err-project-name-begin-underscore");
  }
  if (value.startsWith(".") || value.endsWith(".")) {
    return getErrorMessage("validation-err-project-name-period");
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
    return getErrorMessage("validation-err-project-name-special-char");
  }

  return true;
};

export const validateProjectNameThrowable = (value: string): void => {
  const err = validateProjectName(value);
  if (typeof err == "string") {
    throw buildError(errorStatusCode.VALIDATION_ERR, err);
  }
};

/**
 * Returns true if access token is not empty string
 *
 * @param value Access token
 */
export const validateAccessToken = (value: string): string | boolean => {
  if (!hasValue(value)) {
    return getErrorMessage("validation-err-personal-access-token-missing");
  }
  return true;
};

export const validateAccessTokenThrowable = (value: string): void => {
  const err = validateAccessToken(value);
  if (typeof err == "string") {
    throw buildError(errorStatusCode.VALIDATION_ERR, err);
  }
};

export const validateServicePrincipal = (
  value: string,
  missing: string,
  invalid: string
): string | boolean => {
  if (!hasValue(value)) {
    return getErrorMessage(missing);
  }
  if (!isDashHex(value)) {
    return getErrorMessage(invalid);
  }
  return true;
};

/**
 * Returns true if service principal id is valid
 *
 * @param value service principal id
 */
export const validateServicePrincipalId = (value: string): string | boolean => {
  return validateServicePrincipal(
    value,
    "validation-err-service-principal-id-missing",
    "validation-err-service-principal-id-invalid"
  );
};

/**
 * Validate service principal id
 *
 * @param value service principal id
 */
export const validateServicePrincipalIdThrowable = (value: string): void => {
  const msg = validateServicePrincipalId(value);
  if (typeof msg === "string") {
    throw buildError(errorStatusCode.VALIDATION_ERR, msg);
  }
};

/**
 * Returns true if service principal password is valid
 *
 * @param value service principal password
 */
export const validateServicePrincipalPassword = (
  value: string
): string | boolean => {
  return validateServicePrincipal(
    value,
    "validation-err-service-principal-pwd-missing",
    "validation-err-service-principal-pwd-invalid"
  );
};

/**
 * Validate service principal password
 *
 * @param value service principal password
 */
export const validateServicePrincipalPasswordThrowable = (
  value: string
): void => {
  const msg = validateServicePrincipalPassword(value);
  if (typeof msg === "string") {
    throw buildError(errorStatusCode.VALIDATION_ERR, msg);
  }
};

/**
 * Returns true if service principal tenant identifier is valid
 *
 * @param value service principal tenant identifier.
 */
export const validateServicePrincipalTenantId = (
  value: string
): string | boolean => {
  return validateServicePrincipal(
    value,
    "validation-err-service-principal-tenant-id-missing",
    "validation-err-service-principal-tenant-id-invalid"
  );
};

/**
 * Validate service principal tenant Id
 *
 * @param value service principal tenant Id
 */
export const validateServicePrincipalTenantIdThrowable = (
  value: string
): void => {
  const msg = validateServicePrincipalTenantId(value);
  if (typeof msg === "string") {
    throw buildError(errorStatusCode.VALIDATION_ERR, msg);
  }
};

/**
 * Returns true if subscription identifier is valid
 *
 * @param value subscription identifier.
 */
export const validateSubscriptionId = (value: string): string | boolean => {
  if (!hasValue(value)) {
    return getErrorMessage("validation-err-subscription-id-missing");
  }
  if (!isDashHex(value)) {
    return getErrorMessage("validation-err-subscription-id-invalid");
  }
  return true;
};

/**
 * Validate subscription identifier
 *
 * @param value subscription identifier
 */
export const validateSubscriptionIdThrowable = (value: string): void => {
  const msg = validateSubscriptionId(value);
  if (typeof msg === "string") {
    throw buildError(errorStatusCode.VALIDATION_ERR, msg);
  }
};

/**
 * Returns true if storage account name is valid.
 *
 * @param value storage account name .
 */
export const validateStorageAccountName = (value: string): string | boolean => {
  if (!hasValue(value)) {
    return getErrorMessage("validation-err-storage-account-name-missing");
  }
  if (!value.match(/^[a-z0-9]+$/)) {
    return getErrorMessage("validation-err-storage-account-name-invalid");
  }
  if (value.length < 3 || value.length > 24) {
    return getErrorMessage("validation-err-storage-account-name-length");
  }
  return true;
};

/**
 * Throw exeception if storage account name is invalid.
 *
 * @param value storage account name .
 */
export const validateStorageAccountNameThrowable = (value: string): void => {
  const msg = validateStorageAccountName(value);
  if (typeof msg === "string") {
    throw buildError(errorStatusCode.VALIDATION_ERR, msg);
  }
};

/**
 * Returns true if storage table name is valid.
 *
 * @param value storage table name.
 */
export const validateStorageTableName = (value: string): string | boolean => {
  if (!hasValue(value)) {
    return getErrorMessage("validation-err-storage-table-name-missing");
  }
  if (!value.match(/^[A-Za-z][A-Za-z0-9]*$/)) {
    return getErrorMessage("validation-err-storage-table-name-invalid");
  }
  if (value.length < 3 || value.length > 63) {
    return getErrorMessage("validation-err-storage-table-name-length");
  }
  return true;
};

/**
 * Throw exeception if storage table name is invalid.
 *
 * @param value storage table name .
 */
export const validateStorageTableNameThrowable = (value: string): void => {
  const msg = validateStorageTableName(value);
  if (typeof msg === "string") {
    throw buildError(errorStatusCode.VALIDATION_ERR, msg);
  }
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
    return getErrorMessage("validation-err-storage-partition-key-missing");
  }
  if (value.match(/[/\\#?]/)) {
    return getErrorMessage("validation-err-storage-partition-key-invalid");
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
    return getErrorMessage("validation-err-acr-missing");
  }
  if (!isAlphaNumeric(value)) {
    return getErrorMessage("validation-err-acr-invalid");
  }
  if (value.length < 5 || value.length > 50) {
    return getErrorMessage("validation-err-acr-length");
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
    return getErrorMessage("validation-err-storage-key-vault-invalid");
  }
  if (!value.match(/^[a-zA-Z]/)) {
    return getErrorMessage("validation-err-storage-key-vault-start-letter");
  }
  if (!value.match(/[a-zA-Z0-9]$/)) {
    return getErrorMessage("validation-err-storage-key-vault-end-char");
  }
  if (value.indexOf("--") !== -1) {
    return getErrorMessage("validation-err-storage-key-vault-hyphen");
  }
  if (value.length < 3 || value.length > 24) {
    return getErrorMessage("validation-err-storage-key-vault-length");
  }
  return true;
};

export const validateStorageAccessKey = (value: string): string | boolean => {
  if (!hasValue(value)) {
    return getErrorMessage("validation-err-storage-access-key-missing");
  }
  return true;
};
