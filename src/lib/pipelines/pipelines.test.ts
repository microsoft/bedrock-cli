import { disableVerboseLogging, enableVerboseLogging } from "../../logger";

import {
  createPipelineForDefinition,
  definitionForAzureRepoPipeline,
  definitionForGithubRepoPipeline,
  getBuildApiClient,
  GithubRepoPipelineConfig,
  IAzureRepoPipelineConfig,
  queueBuild,
  RepositoryTypes
} from "./pipelines";
import {
  BuildDefinition,
  BuildRepository,
  YamlProcess
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import * as azdoClient from "../azdoClient";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("test getBuildApiClient function", () => {
  it("positive test", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(azdoClient, "getBuildApi").mockResolvedValueOnce({} as any);
    await expect(getBuildApiClient("org", "token")).toBeDefined();
  });
});

describe("It builds an azure repo pipeline definition", () => {
  test("pipeline definition is well-formed", () => {
    const sampleAzureConfig = {
      branchFilters: ["master"],
      maximumConcurrentBuilds: 1,
      pipelineName: "samplePipeline",
      repositoryName: "myRepoName",
      repositoryUrl: "myRepoUrl",
      variables: {
        foo: {
          allowOverride: false,
          isSecret: true,
          value: "bar"
        }
      },
      yamlFileBranch: "master",
      yamlFilePath: "path/to/azure-pipelines.yml"
    } as IAzureRepoPipelineConfig;

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

    const variables = definition.variables;
    expect(variables).toBeDefined();
    if (variables) {
      expect(variables["foo"].value).toBe("bar");
    }
  });
});

describe("It builds a github repo pipeline definition", () => {
  test("pipeline definition is well-formed", () => {
    const sampleGithubConfig = {
      branchFilters: ["master"],
      maximumConcurrentBuilds: 1,
      pipelineName: "samplePipeline",
      repositoryName: "myRepoName",
      repositoryUrl: "myRepoUrl",
      serviceConnectionId: "foo",
      variables: {
        foo: {
          allowOverride: false,
          isSecret: true,
          value: "bar"
        }
      },
      yamlFileBranch: "master",
      yamlFilePath: "path/to/azure-pipelines.yml"
    } as GithubRepoPipelineConfig;

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

    expect(repository.properties).toBeDefined();
    if (repository.properties) {
      expect(repository.properties.connectedServiceId).toBe(
        sampleGithubConfig.serviceConnectionId
      );
    }

    const process = definition.process as YamlProcess;
    expect(process.yamlFilename).toBe(sampleGithubConfig.yamlFilePath);

    const variables = definition.variables;
    expect(variables).toBeDefined();
    if (variables) {
      expect(variables["foo"].value).toBe("bar");
    }
  });
});

describe("test createPipelineForDefinition function", () => {
  it("positive test", async () => {
    const result = await createPipelineForDefinition(
      {
        createDefinition: () => {
          return {};
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      "project",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any
    );
    expect(result).toBeDefined();
  });
  it("negative test", async () => {
    await expect(
      createPipelineForDefinition(
        {
          createDefinition: () => {
            throw Error("fake");
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        "project",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any
      )
    ).rejects.toThrow();
  });
});

describe("test queueBuild function", () => {
  it("positive test", async () => {
    const result = await queueBuild(
      {
        queueBuild: () => {
          return {};
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      "project",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any
    );
    expect(result).toBeDefined();
  });
  it("negative test", async () => {
    await expect(
      queueBuild(
        {
          queueBuild: () => {
            throw Error("fake");
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        "project",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any
      )
    ).rejects.toThrow();
  });
});
