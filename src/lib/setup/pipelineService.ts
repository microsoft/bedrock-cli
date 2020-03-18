import { IBuildApi } from "azure-devops-node-api/BuildApi";
import {
  Build,
  BuildDefinitionReference,
  BuildStatus
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import { installHldToManifestPipeline } from "../../commands/hld/pipeline";
import { BUILD_SCRIPT_URL } from "../../lib/constants";
import { sleep } from "../../lib/util";
import { logger } from "../../logger";
import { HLD_REPO, RequestContext, MANIFEST_REPO } from "./constants";
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
    const pipeline = await getPipelineByName(
      buildApi,
      rc.projectName,
      pipelineName
    );
    if (pipeline && pipeline.id !== undefined) {
      logger.info(`${pipelineName} is found, deleting it`);
      await deletePipeline(buildApi, rc.projectName, pipelineName, pipeline.id);
    }
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
