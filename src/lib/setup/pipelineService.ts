import { IBuildApi } from "azure-devops-node-api/BuildApi";
import {
  Build,
  BuildDefinitionReference,
  BuildStatus
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import path from "path";
import { installHldToManifestPipeline } from "../../commands/hld/pipeline";
import { installLifecyclePipeline } from "../../commands/project/pipeline";
import { installBuildUpdatePipeline } from "../../commands/service/pipeline";
import {
  BUILD_SCRIPT_URL,
  SERVICE_PIPELINE_FILENAME
} from "../../lib/constants";
import { sleep } from "../../lib/util";
import { logger } from "../../logger";
import {
  APP_REPO,
  APP_REPO_BUILD,
  APP_REPO_LIFECYCLE,
  HLD_REPO,
  RequestContext,
  MANIFEST_REPO
} from "./constants";
import { getAzureRepoUrl } from "./gitService";

/**
 * Returns human readable build status.
 *
 * @param status build status
 */
export const getBuildStatusString = (
  status: number | undefined
):
  | "Unknown"
  | "None"
  | "In Progress"
  | "Completed"
  | "Cancelling"
  | "Postponed"
  | "Not Started" => {
  if (status === undefined) {
    return "Unknown";
  }
  if (status === BuildStatus.None) {
    return "None";
  }
  if (status === BuildStatus.InProgress) {
    return "In Progress";
  }
  if (status === BuildStatus.Completed) {
    return "Completed";
  }
  if (status === BuildStatus.Cancelling) {
    return "Cancelling";
  }
  if (status === BuildStatus.Postponed) {
    return "Postponed";
  }
  if (status === BuildStatus.NotStarted) {
    return "Not Started";
  }
  return "Unknown";
};

/**
 * Returns pipeline object with matching name.
 *
 * @param buildApi Build API client
 * @param projectName Project name
 * @param pipelineName pipeline name
 */
export const getPipelineByName = async (
  buildApi: IBuildApi,
  projectName: string,
  pipelineName: string
): Promise<BuildDefinitionReference | undefined> => {
  try {
    logger.info(`Finding pipeline ${pipelineName}`);
    const defs = await buildApi.getDefinitions(projectName);
    return defs.find(d => d.name === pipelineName);
  } catch (e) {
    logger.error(`Error in getting pipelines.`);
    throw e;
  }
};

/**
 * Deletes pipeline object for a given name and identifier.
 *
 * @param buildApi Build API client
 * @param projectName Project name
 * @param pipelineName pipeline name
 * @param pipelineId pipeline identifier
 */
export const deletePipeline = async (
  buildApi: IBuildApi,
  projectName: string,
  pipelineName: string,
  pipelineId: number
): Promise<void> => {
  try {
    logger.info(`Deleting pipeline ${pipelineName}`);
    await buildApi.deleteDefinition(projectName, pipelineId);
  } catch (e) {
    logger.error(`Error in deleting pipeline ${pipelineName}`);
    throw e;
  }
};

/**
 * Returns latest build ststus of pipeline.
 *
 * @param buildApi Build API client
 * @param projectName Project name
 * @param pipelineName pipeline name
 */
export const getPipelineBuild = async (
  buildApi: IBuildApi,
  projectName: string,
  pipelineName: string
): Promise<Build> => {
  try {
    logger.info(`Getting queue ${pipelineName}`);
    return await buildApi.getLatestBuild(projectName, pipelineName);
  } catch (e) {
    logger.error(`Error in getting build ${pipelineName}`);
    throw e;
  }
};

/**
 * Polls build ststus of pipeline.
 *
 * @param buildApi Build API client
 * @param projectName Project name
 * @param pipelineName pipeline name
 * @param waitDuration duration (in millisecond) before each poll
 */
export const pollForPipelineStatus = async (
  buildApi: IBuildApi,
  projectName: string,
  pipelineName: string,
  waitDuration = 15000
): Promise<void> => {
  const oPipeline = await getPipelineByName(
    buildApi,
    projectName,
    pipelineName
  );
  if (!oPipeline) {
    throw new Error(`${pipelineName} is not found`);
  }

  let build: Build;
  do {
    await sleep(waitDuration);
    build = await getPipelineBuild(buildApi, projectName, pipelineName);
    logger.info(
      `Status build of ${pipelineName}: ${getBuildStatusString(build?.status)}`
    );
  } while (!build || build.result === 0);
};

const deletePipelineIfExist = async (
  buildApi: IBuildApi,
  rc: RequestContext,
  pipelineName: string
): Promise<void> => {
  const pipeline = await getPipelineByName(
    buildApi,
    rc.projectName,
    pipelineName
  );
  if (pipeline && pipeline.id) {
    logger.info(`Pipeline ${pipelineName} was found - deleting pipeline`);
    await deletePipeline(buildApi, rc.projectName, pipelineName, pipeline.id);
  }
};

/**
 * Creates HLD to Manifest pipeline
 *
 * @param buildApi Build API client
 * @param rc Request context
 */
export const createHLDtoManifestPipeline = async (
  buildApi: IBuildApi,
  rc: RequestContext
): Promise<void> => {
  const manifestUrl = getAzureRepoUrl(
    rc.orgName,
    rc.projectName,
    MANIFEST_REPO
  );
  const hldUrl = getAzureRepoUrl(rc.orgName, rc.projectName, HLD_REPO);
  const pipelineName = `${HLD_REPO}-to-${MANIFEST_REPO}`;

  try {
    await deletePipelineIfExist(buildApi, rc, pipelineName);
    await installHldToManifestPipeline({
      buildScriptUrl: BUILD_SCRIPT_URL,
      devopsProject: rc.projectName,
      hldName: HLD_REPO,
      hldUrl,
      manifestUrl,
      orgName: rc.orgName,
      personalAccessToken: rc.accessToken,
      pipelineName,
      yamlFileBranch: "master"
    });
    await pollForPipelineStatus(buildApi, rc.projectName, pipelineName);
    rc.createdHLDtoManifestPipeline = true;
  } catch (err) {
    logger.error(`An error occurred in create HLD to Manifest Pipeline`);
    throw err;
  }
};

/**
 * Creates Lifecycle pipeline
 *
 * @param buildApi Build API client
 * @param rc Request context
 */
export const createLifecyclePipeline = async (
  buildApi: IBuildApi,
  rc: RequestContext
): Promise<void> => {
  const pipelineName = APP_REPO_LIFECYCLE;

  try {
    await deletePipelineIfExist(buildApi, rc, pipelineName);

    await installLifecyclePipeline({
      buildScriptUrl: BUILD_SCRIPT_URL,
      devopsProject: rc.projectName,
      orgName: rc.orgName,
      personalAccessToken: rc.accessToken,
      pipelineName,
      repoName: APP_REPO,
      repoUrl: getAzureRepoUrl(rc.orgName, rc.projectName, APP_REPO),
      yamlFileBranch: "master"
    });
    await pollForPipelineStatus(buildApi, rc.projectName, pipelineName);
    rc.createdLifecyclePipeline = true;
  } catch (err) {
    logger.error(`An error occured in create Lifecycle Pipeline`);
    throw err;
  }
};

/**
 * Creates Build pipeline
 *
 * @param buildApi Build API client
 * @param rc Request context
 */
export const createBuildPipeline = async (
  buildApi: IBuildApi,
  rc: RequestContext
): Promise<void> => {
  const pipelineName = APP_REPO_BUILD;

  try {
    await deletePipelineIfExist(buildApi, rc, pipelineName);

    await installBuildUpdatePipeline(
      path.join(".", SERVICE_PIPELINE_FILENAME),
      {
        buildScriptUrl: BUILD_SCRIPT_URL,
        devopsProject: rc.projectName,
        orgName: rc.orgName,
        packagesDir: undefined,
        personalAccessToken: rc.accessToken,
        pipelineName,
        repoName: APP_REPO,
        repoUrl: getAzureRepoUrl(rc.orgName, rc.projectName, APP_REPO),
        yamlFileBranch: "master"
      }
    );
    await pollForPipelineStatus(buildApi, rc.projectName, pipelineName);
    rc.createdBuildPipeline = true;
  } catch (err) {
    logger.error(`An error occured in create Build Pipeline`);
    throw err;
  }
};
