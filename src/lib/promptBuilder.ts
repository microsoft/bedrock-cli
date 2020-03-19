import { QuestionCollection } from "inquirer";
import i18n from "./i18n.json";
import * as validator from "../lib/validator";

export const azureOrgName = (
  defaultValue?: string | undefined
): QuestionCollection => {
  return {
    default: defaultValue,
    message: `${i18n.prompt.orgName}\n`,
    name: "azdo_org_name",
    type: "input",
    validate: validator.validateOrgName
  };
};

export const azureProjectName = (
  defaultValue?: string | undefined
): QuestionCollection => {
  return {
    default: defaultValue,
    message: `${i18n.prompt.projectName}\n`,
    name: "azdo_project_name",
    type: "input",
    validate: validator.validateProjectName
  };
};

export const azureAccessToken = (
  defaultValue?: string | undefined
): QuestionCollection => {
  return {
    default: defaultValue,
    mask: "*",
    message: `${i18n.prompt.personalAccessToken}\n`,
    name: "azdo_pat",
    type: "password",
    validate: validator.validateAccessToken
  };
};

export const askToSetupIntrospectionConfig = (
  defaultValue = false
): QuestionCollection => {
  return {
    default: defaultValue,
    message: i18n.prompt.setupIntrospectionConfig,
    name: "toSetupIntrospectionConfig",
    type: "confirm"
  };
};

export const askToCreateServicePrincipal = (
  defaultValue = false
): QuestionCollection => {
  return {
    default: defaultValue,
    message: i18n.prompt.createServicePrincipal,
    name: "create_service_principal",
    type: "confirm"
  };
};

export const servicePrincipalId = (
  defaultValue?: string | undefined
): QuestionCollection => {
  return {
    default: defaultValue,
    message: `${i18n.prompt.servicePrincipalId}\n`,
    name: "az_sp_id",
    type: "input",
    validate: validator.validateServicePrincipalId
  };
};

export const servicePrincipalPassword = (
  defaultValue?: string | undefined
): QuestionCollection => {
  return {
    default: defaultValue,
    mask: "*",
    message: `${i18n.prompt.servicePrincipalPassword}\n`,
    name: "az_sp_password",
    type: "password",
    validate: validator.validateServicePrincipalPassword
  };
};

export const servicePrincipalTenantId = (
  defaultValue?: string | undefined
): QuestionCollection => {
  return {
    default: defaultValue,
    message: `${i18n.prompt.servicePrincipalTenantId}\n`,
    name: "az_sp_tenant",
    type: "input",
    validate: validator.validateServicePrincipalTenantId
  };
};

export const servicePrincipal = (
  id?: string | undefined,
  pwd?: string | undefined,
  tenantId?: string | undefined
): QuestionCollection[] => {
  return [
    servicePrincipalId(id),
    servicePrincipalPassword(pwd),
    servicePrincipalTenantId(tenantId)
  ];
};

export const chooseSubscriptionId = (names: string[]): QuestionCollection => {
  return {
    choices: names,
    message: `${i18n.prompt.selectSubscriptionId}\n`,
    name: "az_subscription",
    type: "list"
  };
};

export const azureStorageAccountName = (
  defaultValue?: string | undefined
): QuestionCollection => {
  return {
    default: defaultValue,
    message: `${i18n.prompt.storageAccountName}\n`,
    name: "azdo_storage_account_name",
    type: "input",
    validate: validator.validateStorageAccountName
  };
};

export const azureStorageTableName = (
  defaultValue?: string | undefined
): QuestionCollection => {
  return {
    default: defaultValue,
    message: `${i18n.prompt.storageTableName}\n`,
    name: "azdo_storage_table_name",
    type: "input",
    validate: validator.validateStorageTableName
  };
};

export const azureStoragePartitionKey = (
  defaultValue?: string | undefined
): QuestionCollection => {
  return {
    default: defaultValue,
    message: `${i18n.prompt.storagePartitionKey}\n`,
    name: "azdo_storage_partition_key",
    type: "input",
    validate: validator.validateStoragePartitionKey
  };
};

export const azureKeyVaultName = (
  defaultValue?: string | undefined
): QuestionCollection => {
  return {
    default: defaultValue,
    message: `${i18n.prompt.storageKeVaultName}\n`,
    name: "azdo_storage_key_vault_name",
    type: "input",
    validate: validator.validateStorageKeyVaultName
  };
};

export const azureStorageAccessKey = (
  defaultValue?: string | undefined
): QuestionCollection => {
  return {
    default: defaultValue,
    mask: "*",
    message: `${i18n.prompt.storageAccessKey}\n`,
    name: "azdo_storage_access_key",
    type: "password",
    validate: validator.validateStorageAccessKey
  };
};
