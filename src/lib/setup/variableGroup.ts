import { VariableGroupDataVariable } from "../../types";
import { logger } from "../../logger";
import { addVariableGroup } from "../pipelines/variableGroup";
import { HLD_REPO, RequestContext, STORAGE_PARTITION_KEY } from "./constants";
import { getAzureRepoUrl } from "./gitService";

const validateData = (rc: RequestContext): void => {
  if (!rc.acrName) throw Error("Missing Azure Container Registry Name.");
  if (!rc.orgName) throw Error("Missing Organization Name.");
  if (!rc.projectName) throw Error("Missing Project Name.");
  if (!rc.accessToken) throw Error("Missing Personal Access Token.");
  if (!rc.servicePrincipalId) throw Error("Missing Service Principal Id.");
  if (!rc.servicePrincipalPassword)
    throw Error("Missing Service Principal Secret.");
  if (!rc.servicePrincipalTenantId)
    throw Error("Missing Service Principal Tenant Id.");
  if (!rc.storageAccountAccessKey)
    throw Error("Missing Storage Account Access Key.");
  if (!rc.storageAccountName) throw Error("Missing Storage Account Name.");
  if (!rc.storageTableName) throw Error("Missing Storage Table Name.");
};

export const createVariableData = (
  rc: RequestContext
): VariableGroupDataVariable => {
  validateData(rc);
  return {
    ACR_NAME: {
      value: rc.acrName,
    },
    HLD_REPO: {
      value: getAzureRepoUrl(rc.orgName, rc.projectName, HLD_REPO),
    },
    PAT: {
      isSecret: true,
      value: rc.accessToken,
    },
    SP_APP_ID: {
      isSecret: true,
      value: rc.servicePrincipalId,
    },
    SP_PASS: {
      isSecret: true,
      value: rc.servicePrincipalPassword,
    },
    SP_TENANT: {
      isSecret: true,
      value: rc.servicePrincipalTenantId,
    },
    INTROSPECTION_ACCOUNT_KEY: {
      isSecret: true,
      value: rc.storageAccountAccessKey,
    },
    INTROSPECTION_ACCOUNT_NAME: {
      value: rc.storageAccountName,
    },
    INTROSPECTION_PARTITION_KEY: {
      value: STORAGE_PARTITION_KEY,
    },
    INTROSPECTION_TABLE_NAME: {
      value: rc.storageTableName,
    },
  };
};

export const create = async (
  rc: RequestContext,
  name: string
): Promise<void> => {
  logger.info(`Creating Variable Group from group definition '${name}'`);

  await addVariableGroup({
    description: "Created by spk quick start command",
    name,
    type: "Vsts",
    variables: createVariableData(rc),
  });
};
