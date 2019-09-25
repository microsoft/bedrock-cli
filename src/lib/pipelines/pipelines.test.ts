import {
  definitionForAzureRepoPipeline,
  definitionForGithubRepoPipeline,
  IAzureRepoPipelineConfig,
  IGithubRepoPipelineConfig,
  RepositoryTypes
} from "./pipelines";

import {
  BuildDefinition,
  BuildRepository,
  YamlProcess
} from "azure-devops-node-api/interfaces/BuildInterfaces";

describe("It builds an azure repo pipeline definition", () => {
  let sampleAzureConfig: IAzureRepoPipelineConfig;

  beforeEach(() => {
    sampleAzureConfig = {
      branchFilters: ["master"],
      maximumConcurrentBuilds: 1,
      pipelineName: "samplePipeline",
      repositoryName: "myRepoName",
      repositoryUrl: "myRepoUrl",
      yamlFileBranch: "master",
      yamlFilePath: "path/to/azure-pipelines.yml"
    };
  });

  test("pipeline definition is well-formed", () => {
    const definition: BuildDefinition = definitionForAzureRepoPipeline(
      sampleAzureConfig
    );
    expect(definition.name).toBe(sampleAzureConfig.pipelineName);

    const repository = definition.repository as BuildRepository;
    expect(repository).toBeDefined();
    expect(repository.defaultBranch).toBe(sampleAzureConfig.yamlFileBranch);
    expect(repository.id).toBe(sampleAzureConfig.repositoryName);
    expect(repository.name).toBe(sampleAzureConfig.repositoryName);
    expect(repository.properties).toBeUndefined();
    expect(repository.type).toBe(RepositoryTypes.Azure);
    expect(repository.url).toBe(sampleAzureConfig.repositoryUrl);

    const process = definition.process as YamlProcess;
    expect(process.yamlFilename).toBe(sampleAzureConfig.yamlFilePath);
  });
});

describe("It builds a github repo pipeline definition", () => {
  let sampleGithubConfig: IGithubRepoPipelineConfig;

  beforeEach(() => {
    sampleGithubConfig = {
      branchFilters: ["master"],
      maximumConcurrentBuilds: 1,
      pipelineName: "samplePipeline",
      repositoryName: "myRepoName",
      repositoryUrl: "myRepoUrl",
      serviceConnectionId: "foobar",
      yamlFileBranch: "master",
      yamlFilePath: "path/to/azure-pipelines.yml"
    };
  });

  test("pipeline definition is well-formed", () => {
    const definition: BuildDefinition = definitionForGithubRepoPipeline(
      sampleGithubConfig
    );
    expect(definition.name).toBe(sampleGithubConfig.pipelineName);

    const repository = definition.repository as BuildRepository;
    expect(repository).toBeDefined();
    expect(repository.defaultBranch).toBe(sampleGithubConfig.yamlFileBranch);
    expect(repository.id).toBe(sampleGithubConfig.repositoryName);
    expect(repository.name).toBe(sampleGithubConfig.repositoryName);
    expect(repository.type).toBe(RepositoryTypes.Github);
    expect(repository.url).toBe(sampleGithubConfig.repositoryUrl);

    const properties = repository.properties!;
    expect(properties.connectedServiceId).toBe(
      sampleGithubConfig.serviceConnectionId
    );

    const process = definition.process as YamlProcess;
    expect(process.yamlFilename).toBe(sampleGithubConfig.yamlFilePath);
  });
});
