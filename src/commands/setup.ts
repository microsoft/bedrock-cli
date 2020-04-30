import { IBuildApi } from "azure-devops-node-api/BuildApi";
import { ICoreApi } from "azure-devops-node-api/CoreApi";
import { IGitApi } from "azure-devops-node-api/GitApi";
import commander from "commander";
import fs from "fs";
import yaml from "js-yaml";
import { defaultConfigFile } from "../config";
import { getBuildApi, getWebApi } from "../lib/azdoClient";
import { create as createACR } from "../lib/azure/containerRegistryService";
import { create as createResourceGroup } from "../lib/azure/resourceService";
import { build as buildCmd, exit as exitCmd } from "../lib/commandBuilder";
import {
  HLD_REPO,
  MANIFEST_REPO,
  RequestContext,
  RESOURCE_GROUP,
  RESOURCE_GROUP_LOCATION,
  STORAGE_PARTITION_KEY,
  WORKSPACE,
} from "../lib/setup/constants";
import { createDirectory } from "../lib/setup/fsUtil";
import {
  completePullRequest,
  getAzureRepoUrl,
  getGitApi,
} from "../lib/setup/gitService";
import {
  createBuildPipeline,
  createHLDtoManifestPipeline,
  createLifecyclePipeline,
} from "../lib/setup/pipelineService";
import { createProjectIfNotExist } from "../lib/setup/projectService";
import { getAnswerFromFile, prompt } from "../lib/setup/prompt";
import {
  appRepo,
  helmRepo,
  hldRepo,
  manifestRepo,
} from "../lib/setup/scaffold";
import { create as createSetupLog } from "../lib/setup/setupLog";
import { setupVariableGroup } from "../lib/setup/variableGroup";
import { logger } from "../logger";
import decorator from "./setup.decorator.json";
import { createStorage } from "../lib/setup/azureStorage";
import { build as buildError, log as logError } from "../lib/errorBuilder";
import { errorStatusCode } from "../lib/errorStatusCode";
import { exec } from "../lib/shell";
import { ConfigYaml } from "../types";

interface CommandOptions {
  file: string | undefined;
}

interface APIError {
  message: string;
  statusCode: number;
}

interface APIClients {
  coreAPI: ICoreApi;
  gitAPI: IGitApi;
  buildAPI: IBuildApi;
}

export const isAzCLIInstall = async (): Promise<void> => {
  try {
    const result = await exec("az", ["--version"]);
    const ver = result
      .split("\n")
      .find((s) => s.startsWith("azure-cli "))
      ?.split(/\s+/);
    const version = ver && ver.length === 2 ? ver[1] : null;

    if (version) {
      logger.info(`az cli vesion ${version}`);
    } else {
      throw buildError(
        errorStatusCode.ENV_SETTING_ERR,
        "setup-cmd-az-cli-parse-az-version-err"
      );
    }
  } catch (err) {
    throw buildError(
      errorStatusCode.ENV_SETTING_ERR,
      "setup-cmd-az-cli-err",
      err
    );
  }
};

/**
 * Creates Bedrock config file under `user-home/.bedrock` folder
 *
 * @param answers Answers provided to the commander
 */
export const createCLIConfig = (rc: RequestContext): void => {
  const data: ConfigYaml = {
    azure_devops: {
      access_token: rc.accessToken,
      org: rc.orgName,
      project: rc.projectName,
      hld_repository: getAzureRepoUrl(rc.orgName, rc.projectName, HLD_REPO),
      manifest_repository: getAzureRepoUrl(
        rc.orgName,
        rc.projectName,
        MANIFEST_REPO
      ),
    },
  };
  if (!rc.toCreateAppRepo) {
    fs.writeFileSync(defaultConfigFile(), yaml.safeDump(data));
    return;
  }

  data.introspection = {
    dashboard: {
      image: "mcr.microsoft.com/k8s/bedrock/spektate:latest",
      name: "spektate",
    },
    azure: {
      service_principal_id: rc.servicePrincipalId,
      service_principal_secret: rc.servicePrincipalPassword,
      subscription_id: rc.subscriptionId,
      tenant_id: rc.servicePrincipalTenantId,
    },
  };

  if (data.introspection && data.introspection.azure) {
    // to due to eslint error
    const azure = data.introspection.azure;
    if (rc.storageAccountName) {
      azure.account_name = rc.storageAccountName;
    }
    if (rc.storageAccountAccessKey) {
      azure.key = rc.storageAccountAccessKey;
    }
    if (rc.storageTableName) {
      azure.table_name = rc.storageTableName;
    }
    azure.partition_key = STORAGE_PARTITION_KEY;
  }

  fs.writeFileSync(
    defaultConfigFile(),
    yaml.safeDump(data, {
      lineWidth: 5000,
    })
  );
};

export const getErrorMessage = (
  rc: RequestContext | undefined,
  err: Error | APIError
): string => {
  if (rc) {
    if (err.message && err.message.indexOf("VS402392") !== -1) {
      return `Project, ${rc.projectName} might have been deleted less than 28 days ago. Choose a different project name.`;
    }
    if (!(err instanceof Error) && err.statusCode && err.statusCode === 401) {
      return `Authentication Failed. Make sure that the organization name and access token are correct; or your access token may have expired.`;
    }
  }
  return err.toString();
};

export const createAppRepoTasks = async (
  gitAPI: IGitApi,
  buildAPI: IBuildApi,
  rc: RequestContext
): Promise<boolean> => {
  if (
    rc.toCreateAppRepo &&
    rc.servicePrincipalId &&
    rc.servicePrincipalPassword &&
    rc.servicePrincipalTenantId &&
    rc.subscriptionId &&
    rc.acrName
  ) {
    rc.createdResourceGroup = await createResourceGroup(
      rc.servicePrincipalId,
      rc.servicePrincipalPassword,
      rc.servicePrincipalTenantId,
      rc.subscriptionId,
      RESOURCE_GROUP,
      RESOURCE_GROUP_LOCATION
    );
    await createStorage(rc);
    rc.createdACR = await createACR(
      rc.servicePrincipalId,
      rc.servicePrincipalPassword,
      rc.servicePrincipalTenantId,
      rc.subscriptionId,
      RESOURCE_GROUP,
      rc.acrName,
      RESOURCE_GROUP_LOCATION
    );
    await setupVariableGroup(rc);
    await helmRepo(gitAPI, rc);
    await appRepo(gitAPI, rc);
    await createLifecyclePipeline(buildAPI, rc);
    await completePullRequest(gitAPI, rc, HLD_REPO);
    await createBuildPipeline(buildAPI, rc);
    await completePullRequest(gitAPI, rc, HLD_REPO);
    return true;
  } else {
    return false;
  }
};

export const getAPIClients = async (): Promise<APIClients> => {
  const webAPI = await getWebApi();
  let coreAPI: ICoreApi;
  let gitAPI: IGitApi;
  let buildAPI: IBuildApi;

  try {
    coreAPI = await webAPI.getCoreApi();
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_CLIENT,
      "setup-cmd-core-api-err",
      err
    );
  }

  try {
    gitAPI = await getGitApi(webAPI);
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_CLIENT,
      "setup-cmd-git-api-err",
      err
    );
  }

  try {
    buildAPI = await getBuildApi();
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_CLIENT,
      "setup-cmd-build-api-err",
      err
    );
  }

  return {
    coreAPI,
    gitAPI,
    buildAPI,
  };
};

/**
 * Executes the command, can all exit function with 0 or 1
 * when command completed successfully or failed respectively.
 *
 * @param opts option value from commander
 * @param exitFn exit function
 */
export const execute = async (
  opts: CommandOptions,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  let requestContext: RequestContext | undefined = undefined;

  try {
    await isAzCLIInstall();
    requestContext = opts.file ? getAnswerFromFile(opts.file) : await prompt();
    const rc = requestContext;
    createDirectory(WORKSPACE, true);
    createCLIConfig(rc);

    const { coreAPI, gitAPI, buildAPI } = await getAPIClients();

    await createProjectIfNotExist(coreAPI, rc);
    await setupVariableGroup(rc);
    await hldRepo(gitAPI, rc);
    await manifestRepo(gitAPI, rc);
    await createHLDtoManifestPipeline(buildAPI, rc);
    await createAppRepoTasks(gitAPI, buildAPI, rc);

    createCLIConfig(rc); // to write storage account information.
    createSetupLog(rc);
    await exitFn(0);
  } catch (err) {
    logError(buildError(errorStatusCode.CMD_EXE_ERR, "setup-cmd-failed", err));

    const msg = getErrorMessage(requestContext, err);

    // requestContext will not be created if input validation failed
    if (requestContext) {
      requestContext.error = msg;
    }
    createSetupLog(requestContext);
    await exitFn(1);
  }
};

/**
 * Adds the init command to the commander command object
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: CommandOptions) => {
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
