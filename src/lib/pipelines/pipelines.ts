import { getPersonalAccessTokenHandler, WebApi } from "azure-devops-node-api";
import { IBuildApi } from "azure-devops-node-api/BuildApi";
import {
  AgentPoolQueue,
  BuildDefinition,
  BuildRepository,
  ContinuousIntegrationTrigger,
  DefinitionQuality,
  DefinitionQueueStatus,
  DefinitionTriggerType,
  DefinitionType,
  YamlProcess
} from "azure-devops-node-api/interfaces/BuildInterfaces";

const hostedUbuntuPool = "Hosted Ubuntu 1604";
const hostedUbuntuPoolId = 224;

export enum RepositoryTypes {
  Github = "github",
  Azure = "tfsgit"
}

export const getBuildApiClient = async (
  orgUrl: string,
  token: string
): Promise<IBuildApi> => {
  return initBuildApiClient(
    getPersonalAccessTokenHandler,
    WebApi,
    orgUrl,
    token
  );
};

const initBuildApiClient = async (
  tokenHandler: (n: string) => any,
  webapi: typeof WebApi,
  orgUrl: string,
  token: string
): Promise<IBuildApi> => {
  const authHandler = tokenHandler(token);
  const connection = new webapi(orgUrl, authHandler);

  return connection.getBuildApi();
};

interface IPipeline {
  pipelineName: string;
  repositoryUrl: string;
  repositoryName: string;
  yamlFileBranch: string;
  yamlFilePath: string;
  branchFilters: string[];
  maximumConcurrentBuilds: number;
}

export interface IAzureRepoPipelineConfig extends IPipeline {}

export interface IGithubRepoPipelineConfig extends IPipeline {
  serviceConnectionId: string;
}

export const definitionForAzureRepoPipeline = (
  pipelineConfig: IAzureRepoPipelineConfig
): BuildDefinition => {
  const pipelineDefinition: BuildDefinition = {} as BuildDefinition;

  pipelineDefinition.badgeEnabled = true;
  pipelineDefinition.triggers = [
    {
      batchChanges: false,
      branchFilters: pipelineConfig.branchFilters,
      maxConcurrentBuildsPerBranch: pipelineConfig.maximumConcurrentBuilds,
      type: DefinitionTriggerType.ContinuousIntegration
    } as ContinuousIntegrationTrigger
  ];

  pipelineDefinition.queue = {
    name: hostedUbuntuPool,
    pool: {
      id: hostedUbuntuPoolId,
      name: hostedUbuntuPool
    }
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
    url: pipelineConfig.repositoryUrl
  } as BuildRepository;

  pipelineDefinition.process = {
    yamlFilename: pipelineConfig.yamlFilePath
  } as YamlProcess;

  return pipelineDefinition;
};

export const definitionForGithubRepoPipeline = (
  pipelineConfig: IGithubRepoPipelineConfig
): BuildDefinition => {
  const pipelineDefinition: BuildDefinition = {} as BuildDefinition;

  pipelineDefinition.badgeEnabled = true;
  pipelineDefinition.triggers = [
    {
      batchChanges: false,
      branchFilters: pipelineConfig.branchFilters,
      maxConcurrentBuildsPerBranch: pipelineConfig.maximumConcurrentBuilds,
      type: DefinitionTriggerType.ContinuousIntegration
    } as ContinuousIntegrationTrigger
  ];

  pipelineDefinition.queue = {
    name: hostedUbuntuPool,
    pool: {
      id: hostedUbuntuPoolId,
      name: hostedUbuntuPool
    }
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
      connectedServiceId: pipelineConfig.serviceConnectionId
    },
    type: RepositoryTypes.Github,
    url: pipelineConfig.repositoryUrl
  } as BuildRepository;

  pipelineDefinition.process = {
    yamlFilename: pipelineConfig.yamlFilePath
  } as YamlProcess;

  return pipelineDefinition;
};

export const createPipelineForDefinition = async (
  buildApi: IBuildApi,
  azdoProject: string,
  definition: BuildDefinition
): Promise<BuildDefinition> => {
  return buildApi.createDefinition(definition, azdoProject);
};
