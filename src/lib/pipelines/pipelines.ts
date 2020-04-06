import { IBuildApi } from "azure-devops-node-api/BuildApi";
import {
  AgentPoolQueue,
  Build,
  BuildDefinition,
  BuildDefinitionVariable,
  BuildRepository,
  ContinuousIntegrationTrigger,
  DefinitionQuality,
  DefinitionQueueStatus,
  DefinitionTriggerType,
  DefinitionType,
  YamlProcess,
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import { logger } from "../../logger";
import { getBuildApi } from "../azdoClient";
import { build as buildError } from "../errorBuilder";
import { errorStatusCode } from "../errorStatusCode";

const hostedUbuntuPool = "Hosted Ubuntu 1604";
const hostedUbuntuPoolId = 224;

/**
 * Enum of Repository Provider types.
 */
export enum RepositoryTypes {
  Github = "github",
  Azure = "tfsgit",
}

/**
 * Get an Azure DevOps Build API Client
 * @param org An Azure DevOps Organization Name
 * @param token A Personal Access Token (PAT) used to authenticate against DevOps.
 * @returns BuildApi Client for Azure Devops
 */
export const getBuildApiClient = async (
  orgName: string,
  personalAccessToken: string
): Promise<IBuildApi> => {
  return await getBuildApi({
    orgName,
    personalAccessToken,
  });
};

interface Pipeline {
  pipelineName: string;
  repositoryUrl: string;
  repositoryName: string;
  yamlFileBranch: string;
  yamlFilePath: string;
  branchFilters: string[];
  maximumConcurrentBuilds: number;
  variables?: {
    [key: string]: BuildDefinitionVariable;
  };
}

/**
 * Interface that describes a Pipeline Configuration for an Azure DevOps
 * backed git repository.
 */
export type IAzureRepoPipelineConfig = Pipeline;

/**
 * Interface that describes a Pipeline Configuration for a GitHub backed
 * git repository.
 */
export interface GithubRepoPipelineConfig extends Pipeline {
  serviceConnectionId: string;
}

/**
 * Generate a Build Definition given an Azure Repo Pipeline Configuration
 * @param pipelineConfig Object conforming to IAzureRepoPipelineConfig that describes a high level pipeline configuration for repositories backed on Azure Repos
 * @returns A BuildDefinition that can be consumed by a Build API Client
 */
export const definitionForAzureRepoPipeline = (
  pipelineConfig: IAzureRepoPipelineConfig
): BuildDefinition => {
  try {
    const pipelineDefinition: BuildDefinition = {};

    pipelineDefinition.badgeEnabled = true;
    pipelineDefinition.triggers = [
      {
        batchChanges: false,
        branchFilters: pipelineConfig.branchFilters,
        maxConcurrentBuildsPerBranch: pipelineConfig.maximumConcurrentBuilds,
        settingsSourceType: 2,
        triggerType: DefinitionTriggerType.ContinuousIntegration,
      } as ContinuousIntegrationTrigger,
    ];

    pipelineDefinition.queue = {
      name: hostedUbuntuPool,
      pool: {
        id: hostedUbuntuPoolId,
        name: hostedUbuntuPool,
      },
    } as AgentPoolQueue;

    pipelineDefinition.queueStatus = DefinitionQueueStatus.Enabled;

    pipelineDefinition.name = pipelineConfig.pipelineName;
    pipelineDefinition.type = DefinitionType.Build;
    pipelineDefinition.quality = DefinitionQuality.Definition;

    pipelineDefinition.repository = {
      defaultBranch: pipelineConfig.yamlFileBranch,
      id: pipelineConfig.repositoryName,
      name: pipelineConfig.repositoryName,
      type: RepositoryTypes.Azure,
      url: pipelineConfig.repositoryUrl,
    } as BuildRepository;

    pipelineDefinition.process = {
      yamlFilename: pipelineConfig.yamlFilePath,
    } as YamlProcess;

    if (pipelineConfig.variables) {
      pipelineDefinition.variables = pipelineConfig.variables;
    }

    return pipelineDefinition;
  } catch (err) {
    throw buildError(
      errorStatusCode.PIPELINE_ERR,
      "pipeline-err-create-def-azure-repo-pipeline",
      err
    );
  }
};

/**
 * Generate a Build Definition given a GitHub Repo Pipeline Configuration
 * @param pipelineConfig Object conforming to IGithubRepoPipelineConfig that describes a high level pipeline configuration for repositories backed on Github
 * @returns A BuildDefinition that can be consumed by a Build API Client
 */
export const definitionForGithubRepoPipeline = (
  pipelineConfig: GithubRepoPipelineConfig
): BuildDefinition => {
  try {
    const pipelineDefinition: BuildDefinition = {} as BuildDefinition;

    pipelineDefinition.badgeEnabled = true;
    pipelineDefinition.triggers = [
      {
        batchChanges: false,
        branchFilters: pipelineConfig.branchFilters,
        maxConcurrentBuildsPerBranch: pipelineConfig.maximumConcurrentBuilds,
        settingsSourceType: 2,
        triggerType: DefinitionTriggerType.ContinuousIntegration,
      } as ContinuousIntegrationTrigger,
    ];

    pipelineDefinition.queue = {
      name: hostedUbuntuPool,
      pool: {
        id: hostedUbuntuPoolId,
        name: hostedUbuntuPool,
      },
    } as AgentPoolQueue;

    pipelineDefinition.queueStatus = DefinitionQueueStatus.Enabled;

    pipelineDefinition.name = pipelineConfig.pipelineName;
    pipelineDefinition.type = DefinitionType.Build;
    pipelineDefinition.quality = DefinitionQuality.Definition;

    pipelineDefinition.repository = {
      defaultBranch: pipelineConfig.yamlFileBranch,
      id: pipelineConfig.repositoryName,
      name: pipelineConfig.repositoryName,
      properties: {
        connectedServiceId: pipelineConfig.serviceConnectionId,
      },
      type: RepositoryTypes.Github,
      url: pipelineConfig.repositoryUrl,
    } as BuildRepository;

    pipelineDefinition.process = {
      yamlFilename: pipelineConfig.yamlFilePath,
    } as YamlProcess;

    if (pipelineConfig.variables) {
      pipelineDefinition.variables = pipelineConfig.variables;
    }

    return pipelineDefinition;
  } catch (err) {
    throw buildError(
      errorStatusCode.PIPELINE_ERR,
      "pipeline-err-create-def-githib-pipeline",
      err
    );
  }
};

/**
 * Create a Pipeline with on Azure Devops.
 * @param buildApi BuildApi Client for Azure Devops.
 * @param azdoProject Azure DevOps Project within the authenticated Organization.
 * @param definition A BuildDefinition that can be consumed by a Build API Client
 * @returns The BuildDefinition that was created by the Build API Client
 */
export const createPipelineForDefinition = async (
  buildApi: IBuildApi,
  azdoProject: string,
  definition: BuildDefinition
): Promise<BuildDefinition> => {
  logger.info("Creating pipeline for definition");
  try {
    const createdDefn = await buildApi.createDefinition(
      definition,
      azdoProject
    );
    return createdDefn;
  } catch (err) {
    throw buildError(
      errorStatusCode.PIPELINE_ERR,
      "pipeline-err-create-pipeline-for-defn",
      err
    );
  }
};

/**
 * Queue a build on a pipeline.
 * @param buildApi BuildApi Client for Azure Devops
 * @param azdoProject Azure DevOps Project within the authenticated Organization.
 * @param definitionId A Build Definition ID.
 * @returns Build object that was created by the Build API Clients
 */
export const queueBuild = async (
  buildApi: IBuildApi,
  azdoProject: string,
  definitionId: number
): Promise<Build> => {
  const buildReference: Build = {
    definition: {
      id: definitionId,
    },
  };

  try {
    return await buildApi.queueBuild(buildReference, azdoProject);
  } catch (err) {
    throw buildError(
      errorStatusCode.PIPELINE_ERR,
      "pipeline-queue-build-err",
      err
    );
  }
};
