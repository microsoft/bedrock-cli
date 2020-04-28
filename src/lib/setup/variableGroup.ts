import { AzureDevOpsOpts } from "../../lib/git";
import { deleteVariableGroup } from "../../lib/pipelines/variableGroup";
import { logger } from "../../logger";
import { VariableGroupDataVariable } from "../../types";
import { build as buildError } from "../errorBuilder";
import { errorStatusCode } from "../errorStatusCode";
import { addVariableGroup } from "../pipelines/variableGroup";
import {
  HLD_REPO,
  RequestContext,
  STORAGE_PARTITION_KEY,
  VARIABLE_GROUP,
} from "./constants";
import { getAzureRepoUrl } from "./gitService";

const validateData = (rc: RequestContext): void => {
  // during the first iteration service principal
  // and storage account are not setup.
  if (!rc.accessToken) {
    throw buildError(
      errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
      "setup-cmd-create-variable-group-missing-pat"
    );
  }
  if (rc.storageAccountAccessKey) {
    if (!rc.acrName) {
      throw buildError(
        errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
        "setup-cmd-create-variable-group-missing-acr-name"
      );
    }
    if (!rc.servicePrincipalId) {
      throw buildError(
        errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
        "setup-cmd-create-variable-group-missing-sp-id"
      );
    }
    if (!rc.servicePrincipalPassword) {
      throw buildError(
        errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
        "setup-cmd-create-variable-group-missing-sp-pwd"
      );
    }
    if (!rc.servicePrincipalTenantId) {
      throw buildError(
        errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
        "setup-cmd-create-variable-group-missing-tenant-id"
      );
    }
    if (!rc.storageAccountAccessKey) {
      throw buildError(
        errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
        "setup-cmd-create-variable-group-missing-storage-access-key"
      );
    }
    if (!rc.storageAccountName) {
      throw buildError(
        errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
        "setup-cmd-create-variable-group-missing-storage-account-name"
      );
    }
    if (!rc.storageTableName) {
      throw buildError(
        errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
        "setup-cmd-create-variable-group-missing-storage-table-name"
      );
    }
  }
};

export const createVariableData = (
  rc: RequestContext
): VariableGroupDataVariable => {
  try {
    validateData(rc);

    // during the first iteration service principal
    // and storage account are not setup.
    if (!rc.storageAccountAccessKey) {
      return {
        HLD_REPO: {
          value: getAzureRepoUrl(rc.orgName, rc.projectName, HLD_REPO),
        },
        PAT: {
          isSecret: true,
          value: rc.accessToken,
        },
      };
    }
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
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_VARIABLE_GROUP_ERR,
      "var-group-create-data-err",
      err
    );
  }
};

export const create = async (
  rc: RequestContext,
  name: string
): Promise<void> => {
  logger.info(`Creating Variable Group from group definition '${name}'`);

  await addVariableGroup({
    description: "Created by bedrock quick start command",
    name,
    type: "Vsts",
    variables: createVariableData(rc),
  });
};

export const setupVariableGroup = async (rc: RequestContext): Promise<void> => {
  const accessOpts: AzureDevOpsOpts = {
    orgName: rc.orgName,
    personalAccessToken: rc.accessToken,
    project: rc.projectName,
  };

  await deleteVariableGroup(accessOpts, VARIABLE_GROUP);
  await create(rc, VARIABLE_GROUP);
  logger.info(`Successfully created variable group, ${VARIABLE_GROUP}`);
};
