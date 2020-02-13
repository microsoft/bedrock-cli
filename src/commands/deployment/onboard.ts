import { StorageAccount } from "@azure/arm-storage/esm/models";
import commander from "commander";
import fs from "fs";
import yaml from "js-yaml";
import { Config, defaultConfigFile, readYaml } from "../../config";
import { setSecret } from "../../lib/azure/keyvault";
import {
  createStorageAccount,
  createTableIfNotExists,
  getStorageAccountKey,
  isStorageAccountExist
} from "../../lib/azure/storage";
import {
  build as buildCmd,
  exit as exitCmd,
  validateForRequiredValues
} from "../../lib/commandBuilder";
import { logger } from "../../logger";
import { IAzureAccessOpts, IConfigYaml } from "../../types";
import decorator from "./onboard.decorator.json";

export interface ICommandOptions {
  storageAccountName: string | undefined;
  storageTableName: string | undefined;
  storageLocation: string | undefined;
  storageResourceGroupName: string | undefined;
  keyVaultName: string | undefined;
  servicePrincipalId: string | undefined;
  servicePrincipalPassword: string | undefined;
  tenantId: string | undefined;
  subscriptionId: string | undefined;
}

/**
 * Populates command values (if needed) to values from SPK config.
 *
 * @param opts values from commander
 */
export const populateValues = (opts: ICommandOptions) => {
  const config = Config();
  const { azure } = config.introspection!;

  opts.storageAccountName =
    opts.storageAccountName || azure?.account_name || undefined;
  opts.storageTableName =
    opts.storageTableName || azure?.table_name || undefined;
  opts.keyVaultName = opts.keyVaultName || config.key_vault_name || undefined;
  opts.servicePrincipalId =
    opts.servicePrincipalId || azure?.service_principal_id || undefined;
  opts.servicePrincipalPassword =
    opts.servicePrincipalPassword ||
    azure?.service_principal_secret ||
    undefined;
  opts.tenantId = opts.tenantId || azure?.tenant_id || undefined;
  opts.subscriptionId =
    opts.subscriptionId || azure?.subscription_id || undefined;
  return opts;
};

/**
 * Validates Account table name.
 *
 * @param name table name
 */
export const validateTableName = (name: string): boolean => {
  const regExpression = /^[A-Za-z][A-Za-z0-9]{2,62}$/;
  return regExpression.test(name);
};

/**
 * Validates storage account name
 *
 * @param name Storage account name
 */
export const validateStorageName = (name: string): boolean => {
  const regExpression = /^[0-9a-z][a-z0-9]{2,23}$/;
  return regExpression.test(name);
};

/**
 * Validates the values from commander.
 *
 * @param opts values from commander (including populated values from spk config)
 */
export const validateValues = (opts: ICommandOptions) => {
  const errors = validateForRequiredValues(decorator, {
    servicePrincipalId: opts.servicePrincipalId,
    servicePrincipalPassword: opts.servicePrincipalPassword,
    storageAccountName: opts.storageAccountName,
    storageResourceGroupName: opts.storageResourceGroupName,
    storageTableName: opts.storageTableName,
    subscriptionId: opts.subscriptionId,
    tenantId: opts.tenantId
  });
  if (errors.length > 0) {
    throw new Error("Required values are missing");
  }
  if (!validateStorageName(opts.storageAccountName!)) {
    throw new Error(
      "Storage account name must be only alphanumeric characters in lowercase and must be from 3 to 24 characters long."
    );
  }
  if (!validateTableName(opts.storageTableName!)) {
    throw new Error(
      "Table names must be only alphanumeric characters, cannot begin with a numeric character, case-insensitive, and must be from 3 to 63 characters long."
    );
  }
};

/**
 * Executes the command, can all exit function with 0 or 1
 * when command completed successfully or failed respectively.
 *
 * @param opts validated option values
 * @param exitFn exit function
 */
export const execute = async (
  opts: ICommandOptions,
  exitFn: (status: number) => Promise<void>
) => {
  try {
    populateValues(opts);
    validateValues(opts);
    const storageAccount = await onboard(opts);
    logger.debug(
      `Service introspection deployment onboarding is complete. \n ${JSON.stringify(
        storageAccount
      )}`
    );
    await exitFn(0);
  } catch (err) {
    logger.error(err);
    await exitFn(1);
  }
};

/**
 * Adds the onboard command to the commander command object
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: ICommandOptions) => {
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};

/**
 * Creates storage account if it does not exist
 *
 * @param values values from commander
 * @param accessOpts Azure Access Opts
 */
export const validateAndCreateStorageAccount = async (
  values: ICommandOptions,
  accessOpts: IAzureAccessOpts
): Promise<StorageAccount | undefined> => {
  const isExist = await isStorageAccountExist(
    values.storageResourceGroupName!,
    values.storageAccountName!,
    accessOpts
  );

  // Storage account does not exist so create it.
  if (isExist === false) {
    if (!values.storageLocation) {
      throw new Error(
        "the following argument is required: \n -l / --storage-location"
      );
    }
    const storageAccount = await createStorageAccount(
      values.storageResourceGroupName!,
      values.storageAccountName!,
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
  values: ICommandOptions,
  accessOpts: IAzureAccessOpts
): Promise<string> => {
  const accessKey = await getStorageAccountKey(
    values.storageResourceGroupName!,
    values.storageAccountName!,
    accessOpts
  );

  if (accessKey === undefined) {
    throw new Error(
      `Storage account ${values.storageAccountName} access keys in resource group ${values.storageResourceGroupName} is not defined`
    );
  }
  return accessKey;
};

/**
 * Creates Key Vault if value from commander has value for `keyVaultName`
 *
 * @param values values from commander
 * @param accessOpts Azure Access Opts
 * @param accessKey Access Key
 */
export const createKeyVault = async (
  values: ICommandOptions,
  accessOpts: IAzureAccessOpts,
  accessKey: string
) => {
  // if key vault is not specified, exit without reading storage account
  // key and setting it in the key vault
  if (values.keyVaultName) {
    logger.debug(
      `Calling setSecret with storage account primary key ***
        and ${values.keyVaultName}`
    );
    await setSecret(
      values.keyVaultName,
      `${values.storageAccountName}Key`,
      accessKey,
      accessOpts
    );
  } else {
    // notify the user to set the environment variable with storage access key
    logger.info(
      `Please set the storage account access key in environment variable
      INTROSPECTION_STORAGE_ACCESS_KEY before issuing any deployment commands.`
    );
    logger.info(`Storage account ${values.storageAccountName} access key: ***`);
  }
};

/**
 * Creates the Storage account `accountName` in resource group `resourceGroup`,
 * sets storage account access key in keyvalut, and updates pipelines
 * (acr-hld, hld->manifests)
 *
 * @param values Values from commander.
 */
export const onboard = async (
  values: ICommandOptions
): Promise<StorageAccount | undefined> => {
  logger.debug(
    `onboard called with ${values.storageTableName}, ${values.storageTableName},
    ${values.storageResourceGroupName}, ${values.storageLocation}, and ${values.keyVaultName}`
  );

  const accessOpts: IAzureAccessOpts = {
    servicePrincipalId: values.servicePrincipalId,
    servicePrincipalPassword: values.servicePrincipalPassword,
    subscriptionId: values.subscriptionId,
    tenantId: values.tenantId
  };

  const storageAccount = await validateAndCreateStorageAccount(
    values,
    accessOpts
  );
  const accessKey = await getStorageAccessKey(values, accessOpts);

  const tableCreated = await createTableIfNotExists(
    values.storageAccountName!,
    values.storageTableName!,
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

  await createKeyVault(values, accessOpts, accessKey);

  // save storage account and table names in configuration
  setConfiguration(values.storageAccountName!, values.storageTableName!);
  return storageAccount;
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
    const data = readYaml<IConfigYaml>(defaultConfigFile());
    data.introspection!.azure!.account_name = storageAccountName;
    data.introspection!.azure!.table_name = storageTableName;
    const jsonData = yaml.safeDump(data);
    logger.verbose(jsonData);
    fs.writeFileSync(defaultConfigFile(), jsonData);
    return true;
  } catch (err) {
    logger.error(
      `Unable to set storage account and table names in configuration file. \n ${err}`
    );
    return false;
  }
};
