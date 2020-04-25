import { StorageAccount } from "@azure/arm-storage/esm/models";
import commander from "commander";
import fs from "fs";
import yaml from "js-yaml";
import { Config, defaultConfigFile, readYaml } from "../../config";
import {
  createStorageAccount,
  createTableIfNotExists,
  getStorageAccountKey,
  isStorageAccountExist,
} from "../../lib/azure/storage";
import {
  build as buildCmd,
  exit as exitCmd,
  populateInheritValueFromConfig,
  validateForRequiredValues,
} from "../../lib/commandBuilder";
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";
import { logger } from "../../logger";
import { AzureAccessOpts, ConfigYaml } from "../../types";
import decorator from "./onboard.decorator.json";
import {
  validateStorageAccountNameThrowable,
  validateStorageTableNameThrowable,
} from "../../lib/validator";

export interface CommandOptions {
  storageAccountName: string | undefined;
  storageTableName: string | undefined;
  storageLocation: string | undefined;
  storageResourceGroupName: string | undefined;
  servicePrincipalId: string | undefined;
  servicePrincipalPassword: string | undefined;
  tenantId: string | undefined;
  subscriptionId: string | undefined;
}

export interface OnBoardConfig {
  storageResourceGroupName: string;
  storageAccountName: string;
  storageTableName: string;
  servicePrincipalId: string;
  servicePrincipalPassword: string;
  subscriptionId: string;
  tenantId: string;
  storageLocation?: string;
}

/**
 * Populates command values (if needed) to values from Bedrock config.
 *
 * @param opts values from commander
 */
export const populateValues = (opts: CommandOptions): CommandOptions => {
  populateInheritValueFromConfig(decorator, Config(), opts);
  return opts;
};

/**
 * Validates the values from commander.
 *
 * @param opts values from commander (including populated values from bedrock config)
 */
export const validateValues = (opts: CommandOptions): OnBoardConfig => {
  validateForRequiredValues(decorator, opts, true);

  // validateForRequiredValues already check
  // opts.storageAccountName and opts.storageTableName are not empty string
  // or undefined.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  validateStorageAccountNameThrowable(opts.storageAccountName!);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  validateStorageTableNameThrowable(opts.storageTableName!);

  // validateForRequiredValues already check these options values
  // are valid `|| ""` is to avoid eslint errors.
  return {
    storageResourceGroupName: opts.storageResourceGroupName || "",
    storageAccountName: opts.storageAccountName || "",
    storageTableName: opts.storageTableName || "",
    servicePrincipalId: opts.servicePrincipalId || "",
    servicePrincipalPassword: opts.servicePrincipalPassword || "",
    subscriptionId: opts.subscriptionId || "",
    tenantId: opts.tenantId || "",
    storageLocation: opts.storageLocation,
  };
};

/**
 * Set storage account and table names in the configuration file at default location
 *
 * @param storageAccountName The Azure storage account name
 * @param storageTableName The Azure storage table name
 */
export const setConfiguration = (
  storageAccountName: string,
  storageTableName: string
): boolean => {
  try {
    const data = readYaml<ConfigYaml>(defaultConfigFile());
    if (!data.introspection) {
      data.introspection = {};
    }
    data.introspection.azure = data.introspection.azure || {};

    data.introspection.azure.account_name = storageAccountName;
    data.introspection.azure.table_name = storageTableName;
    const jsonData = yaml.safeDump(data);
    logger.verbose(jsonData);
    fs.writeFileSync(defaultConfigFile(), jsonData);
    return true;
  } catch (err) {
    // TOFIX: write some comments on why this error can be ignore
    logger.error(
      `Unable to set storage account and table names in configuration file. \n ${err}`
    );
    return false;
  }
};

/**
 * Creates storage account if it does not exist
 *
 * @param values values from commander
 * @param accessOpts Azure Access Opts
 */
export const validateAndCreateStorageAccount = async (
  values: OnBoardConfig,
  accessOpts: AzureAccessOpts
): Promise<StorageAccount | undefined> => {
  const isExist = await isStorageAccountExist(
    values.storageResourceGroupName,
    values.storageAccountName,
    accessOpts
  );

  // Storage account does not exist so create it.
  if (isExist === false) {
    if (!values.storageLocation) {
      throw buildError(
        errorStatusCode.VALIDATION_ERR,
        "introspect-onboard-cmd-location-missing"
      );
    }
    const storageAccount = await createStorageAccount(
      values.storageResourceGroupName,
      values.storageAccountName,
      values.storageLocation,
      accessOpts
    );
    logger.debug(`Storage Account: ${JSON.stringify(storageAccount, null, 2)}`);
    return storageAccount;
  }
  return undefined;
};

/**
 * Returns storage access key.
 *
 * @param values values from commander
 * @param accessOpts Azure Access Opts
 * @throws Error if access key cannot be obtained.
 */
export const getStorageAccessKey = async (
  values: OnBoardConfig,
  accessOpts: AzureAccessOpts
): Promise<string> => {
  const accessKey = await getStorageAccountKey(
    values.storageResourceGroupName,
    values.storageAccountName,
    accessOpts
  );

  if (accessKey === undefined) {
    throw buildError(errorStatusCode.ENV_SETTING_ERR, {
      errorKey: "introspect-onboard-cmd-get-storage-access-key-err",
      values: [values.storageAccountName, values.storageResourceGroupName],
    });
  }
  return accessKey;
};

/**
 * Creates the Storage account `accountName` in resource group `resourceGroup`,
 * and updates pipelines (acr-hld, hld->manifests)
 *
 * @param values Values from commander.
 */
export const onboard = async (
  values: OnBoardConfig
): Promise<StorageAccount | undefined> => {
  logger.debug(
    `onboard called with ${values.storageAccountName}, ${values.storageTableName},
    ${values.storageResourceGroupName} and ${values.storageLocation}`
  );

  const accessOpts: AzureAccessOpts = {
    servicePrincipalId: values.servicePrincipalId,
    servicePrincipalPassword: values.servicePrincipalPassword,
    subscriptionId: values.subscriptionId,
    tenantId: values.tenantId,
  };

  const storageAccount = await validateAndCreateStorageAccount(
    values,
    accessOpts
  );
  const accessKey = await getStorageAccessKey(values, accessOpts);

  const tableCreated = await createTableIfNotExists(
    values.storageAccountName,
    values.storageTableName,
    accessKey
  );
  if (tableCreated) {
    if (storageAccount !== undefined) {
      logger.info(`Storage account ${values.storageAccountName} and
        table ${values.storageTableName} are created.`);
    } else {
      logger.info(`Table ${values.storageTableName} is created in
        existing storage account ${values.storageAccountName}.`);
    }
  } else if (storageAccount !== undefined) {
    logger.info(`Both storage account ${values.storageAccountName} and
      table ${values.storageTableName} exist.`);
  }

  // save storage account and table names in configuration
  setConfiguration(values.storageAccountName, values.storageTableName);
  return storageAccount;
};

/**
 * Executes the command, can all exit function with 0 or 1
 * when command completed successfully or failed respectively.
 *
 * @param opts validated option values
 * @param exitFn exit function
 */
export const execute = async (
  opts: CommandOptions,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  try {
    populateValues(opts);
    const values = validateValues(opts);
    const storageAccount = await onboard(values);
    logger.debug(
      `Service introspection deployment onboarding is complete. \n ${JSON.stringify(
        storageAccount
      )}`
    );
    await exitFn(0);
  } catch (err) {
    logError(
      buildError(
        errorStatusCode.CMD_EXE_ERR,
        "introspect-onboard-cmd-failed",
        err
      )
    );
    await exitFn(1);
  }
};

/**
 * Adds the onboard command to the commander command object
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: CommandOptions) => {
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
