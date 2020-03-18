import commander from "commander";
import fs from "fs";
import yaml from "js-yaml";
import { defaultConfigFile } from "../config";
import { getBuildApi, getWebApi } from "../lib/azdoClient";
import { create as createACR } from "../lib/azure/containerRegistryService";
import { create as createResourceGroup } from "../lib/azure/resourceService";
import { build as buildCmd, exit as exitCmd } from "../lib/commandBuilder";
import {
  RequestContext,
  RESOURCE_GROUP,
  RESOURCE_GROUP_LOCATION,
  WORKSPACE
} from "../lib/setup/constants";
import { createDirectory } from "../lib/setup/fsUtil";
import { getGitApi } from "../lib/setup/gitService";
import { createHLDtoManifestPipeline } from "../lib/setup/pipelineService";
import { createProjectIfNotExist } from "../lib/setup/projectService";
import { getAnswerFromFile, prompt } from "../lib/setup/prompt";
import {
  appRepo,
  helmRepo,
  hldRepo,
  manifestRepo
} from "../lib/setup/scaffold";
import { create as createSetupLog } from "../lib/setup/setupLog";
import { logger } from "../logger";
import decorator from "./setup.decorator.json";
import { IGitApi } from "azure-devops-node-api/GitApi";

interface CommandOptions {
  file: string | undefined;
}

interface APIError {
  message: string;
  statusCode: number;
}

/**
 * Creates SPK config file under `user-home/.spk` folder
 *
 * @param answers Answers provided to the commander
 */
export const createSPKConfig = (rc: RequestContext): void => {
  const data = rc.toCreateAppRepo
    ? {
        "azure_devops": {
          "access_token": rc.accessToken,
          org: rc.orgName,
          project: rc.projectName
        },
        introspection: {
          azure: {
            "service_principal_id": rc.servicePrincipalId,
            "service_principal_secret": rc.servicePrincipalPassword,
            "subscription_id": rc.subscriptionId,
            "tenant_id": rc.servicePrincipalTenantId
          }
        }
      }
    : {
        "azure_devops": {
          "access_token": rc.accessToken,
          org: rc.orgName,
          project: rc.projectName
        }
      };
  fs.writeFileSync(defaultConfigFile(), yaml.safeDump(data));
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
  rc: RequestContext
): Promise<void> => {
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
    rc.createdACR = await createACR(
      rc.servicePrincipalId,
      rc.servicePrincipalPassword,
      rc.servicePrincipalTenantId,
      rc.subscriptionId,
      RESOURCE_GROUP,
      rc.acrName,
      RESOURCE_GROUP_LOCATION
    );
    await helmRepo(gitAPI, rc);
    await appRepo(gitAPI, rc);
  }
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
    requestContext = opts.file ? getAnswerFromFile(opts.file) : await prompt();
    createDirectory(WORKSPACE, true);
    createSPKConfig(requestContext);

    const webAPI = await getWebApi();
    const coreAPI = await webAPI.getCoreApi();
    const gitAPI = await getGitApi(webAPI);
    const buildAPI = await getBuildApi();

    await createProjectIfNotExist(coreAPI, requestContext);
    await hldRepo(gitAPI, requestContext);
    await manifestRepo(gitAPI, requestContext);
    await createHLDtoManifestPipeline(buildAPI, requestContext);
    await createAppRepoTasks(gitAPI, requestContext);

    createSetupLog(requestContext);
    await exitFn(0);
  } catch (err) {
    const msg = getErrorMessage(requestContext, err);

    // requestContext will not be created if input validation failed
    if (requestContext) {
      requestContext.error = msg;
    }
    createSetupLog(requestContext);

    logger.error(msg);
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
