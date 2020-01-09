import { disableVerboseLogging, enableVerboseLogging } from "../../logger";

jest.mock("../../lib/pipelines/pipelines");

import {
  createPipelineForDefinition,
  getBuildApiClient,
  queueBuild
} from "../../lib/pipelines/pipelines";

import { logger } from "@azure/identity";
import {
  installLifecyclePipeline,
  isValidConfig,
  requiredPipelineVariables
} from "./pipeline";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("validate pipeline config", () => {
  const configValues: any[] = [
    "testOrg",
    "testDevopsProject",
    "testPipeline",
    "repoName",
    "https:/repoulr",
    "https://hldurl",
    "https://buildscript",
    "af8e99c1234ef93e8c4365b1dc9bd8d9ba987d3"
  ];

  it("config is valid", () => {
    expect(isValidConfig.apply(undefined, configValues as any)).toBe(true);
  });

  it("undefined values", () => {
    for (const i of configValues.keys()) {
      const configValuesWithInvalidValue = configValues.map((value, j) =>
        i === j ? undefined : value
      );
      expect(
        isValidConfig.apply(undefined, configValuesWithInvalidValue as any)
      ).toBe(false);
    }
  });
});

describe("required pipeline variables", () => {
  it("should use have the proper pipeline vars vars", () => {
    const variables = requiredPipelineVariables(
      "somePAT",
      "buildScriptUrl",
      "hldRepoUrl"
    );

    expect(Object.keys(variables).length).toBe(3);

    expect(variables.PAT.value).toBe("somePAT");
    expect(variables.PAT.isSecret).toBe(true);
    expect(variables.PAT.allowOverride).toBe(true);

    expect(variables.BUILD_SCRIPT_URL.value).toBe("buildScriptUrl");
    expect(variables.BUILD_SCRIPT_URL.isSecret).toBe(false);
    expect(variables.BUILD_SCRIPT_URL.allowOverride).toBe(true);

    expect(variables.HLD_REPO.value).toBe("hldRepoUrl");
    expect(variables.HLD_REPO.isSecret).toBe(false);
    expect(variables.HLD_REPO.allowOverride).toBe(true);
  });
});

describe("create hld to manifest pipeline test", () => {
  it("should create a pipeline", async () => {
    (createPipelineForDefinition as jest.Mock).mockReturnValue({ id: 10 });

    const exitFn = jest.fn();
    await installLifecyclePipeline(
      "orgName",
      "PAT",
      "pipelineName",
      "repoName",
      "repoUrl",
      "hldRepoUrl",
      "azDoProject",
      "buildScriptUrl",
      exitFn
    );

    expect(exitFn).toBeCalledTimes(0);
  });

  it("should fail if the build client cant be instantiated", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue(Promise.reject());

    const exitFn = jest.fn();
    await installLifecyclePipeline(
      "orgName",
      "PAT",
      "pipelineName",
      "repoName",
      "repoUrl",
      "hldRepoUrl",
      "azDoProject",
      "buildScriptUrl",
      exitFn
    );

    expect(exitFn).toBeCalledTimes(1);
  });

  it("should fail if the pipeline definition cannot be created", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue({});
    (createPipelineForDefinition as jest.Mock).mockReturnValue(
      Promise.reject()
    );

    const exitFn = jest.fn();
    await installLifecyclePipeline(
      "orgName",
      "PAT",
      "pipelineName",
      "repoName",
      "repoUrl",
      "hldRepoUrl",
      "azDoProject",
      "buildScriptUrl",
      exitFn
    );

    expect(exitFn).toBeCalledTimes(1);
  });

  it("should fail if a build cannot be queued on the pipeline", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue({});
    (createPipelineForDefinition as jest.Mock).mockReturnValue({ id: 10 });
    (queueBuild as jest.Mock).mockReturnValue(Promise.reject());

    const exitFn = jest.fn();
    await installLifecyclePipeline(
      "orgName",
      "PAT",
      "pipelineName",
      "repoName",
      "repoUrl",
      "hldRepoUrl",
      "azDoProject",
      "buildScriptUrl",
      exitFn
    );

    expect(exitFn).toBeCalledTimes(1);
  });

  it("should fail if a build definition id doesn't exist", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue({});
    (createPipelineForDefinition as jest.Mock).mockReturnValue({
      fakeProperty: "temp"
    });
    (queueBuild as jest.Mock).mockReturnValue(Promise.reject());

    const exitFn = jest.fn();
    let hasError = false;

    try {
      await installLifecyclePipeline(
        "orgName",
        "PAT",
        "pipelineName",
        "repoName",
        "repoUrl",
        "hldRepoUrl",
        "azDoProject",
        "buildScriptUrl",
        exitFn
      );
    } catch (error) {
      const builtDefnString = JSON.stringify({ fakeProperty: "temp" });
      expect(error.message).toBe(
        `Invalid BuildDefinition created, parameter 'id' is missing from ${builtDefnString}`
      );
      hasError = true;
    }
    expect(hasError).toBe(true);
  });
});
