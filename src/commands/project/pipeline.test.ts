/* eslint-disable @typescript-eslint/camelcase */
import * as azdo from "../../lib/azdoClient";
import { create as createBedrockYaml } from "../../lib/bedrockYaml";
import { createTempDir } from "../../lib/ioUtil";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
jest.mock("../../lib/pipelines/pipelines");

import {
  createPipelineForDefinition,
  getBuildApiClient,
  queueBuild
} from "../../lib/pipelines/pipelines";

import {
  checkDependencies,
  execute,
  fetchValidateValues,
  CommandOptions,
  installLifecyclePipeline
} from "./pipeline";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

const gitUrl = "https://github.com/CatalystCode/spk.git";

const mockValues: CommandOptions = {
  buildScriptUrl: "buildScriptUrl",
  devopsProject: "azDoProject",
  orgName: "orgName",
  personalAccessToken: "PAT",
  pipelineName: "pipelineName",
  repoName: "repoName",
  repoUrl: "repoUrl",
  yamlFileBranch: "master"
};

jest.spyOn(azdo, "repositoryHasFile").mockReturnValue(Promise.resolve());

const mockMissingValues: CommandOptions = {
  buildScriptUrl: undefined,
  devopsProject: undefined,
  orgName: undefined,
  personalAccessToken: undefined,
  pipelineName: "pipelineName",
  repoName: "repoName",
  repoUrl: "",
  yamlFileBranch: ""
};

const nullValues: CommandOptions = {
  buildScriptUrl: undefined,
  devopsProject: undefined,
  orgName: undefined,
  personalAccessToken: undefined,
  pipelineName: "pipelineName",
  repoName: "repoName",
  repoUrl: "https://github.com",
  yamlFileBranch: ""
};

describe("test valid function", () => {
  it("negative test", async () => {
    try {
      const tmpDir = createBedrockYaml();
      await checkDependencies(tmpDir);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).not.toBeNull();
    }
  });
});

describe("test fetchValidateValues function", () => {
  it("negative test: SPK Config is missing", () => {
    try {
      fetchValidateValues(mockValues, gitUrl, undefined);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).not.toBeNull();
    }
  });
  it("SPK Config's azure_devops do not have value", () => {
    expect(() => {
      fetchValidateValues(mockMissingValues, gitUrl, {
        azure_devops: {}
      });
    }).toThrow(`Repo url not defined`);
  });
  it("SPK Config's azure_devops do not have value and command line does not have values", () => {
    const values = fetchValidateValues(nullValues, gitUrl, {
      azure_devops: {}
    });
    expect(values).toBeNull();
  });
});

describe("installLifecyclePipeline and execute tests", () => {
  it("test execute function: missing project path", async () => {
    const exitFn = jest.fn();
    await execute(mockValues, "", exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("test execute function: positive test", async () => {
    const exitFn = jest.fn();
    (createPipelineForDefinition as jest.Mock).mockReturnValue({ id: 10 });

    const tmpDir = createTempDir();
    createBedrockYaml(tmpDir, {
      rings: {},
      services: {},
      variableGroups: ["test"]
    });
    await execute(mockValues, tmpDir, exitFn);

    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
  it("test execute function: missing repo url and pipeline name", async () => {
    const exitFn = jest.fn();
    await execute(mockMissingValues, "", exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("test execute function: github repos not supported", async () => {
    const exitFn = jest.fn();
    await execute(nullValues, "", exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("test execute function: missing repo url and pipeline name", async () => {
    const exitFn = jest.fn();
    await execute(mockMissingValues, "", exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("test execute function: github repos not supported", async () => {
    const exitFn = jest.fn();
    await execute(nullValues, "", exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("should create a pipeline", async () => {
    (createPipelineForDefinition as jest.Mock).mockReturnValue({ id: 10 });
    try {
      await installLifecyclePipeline(mockValues);
    } catch (_) {
      expect(true).toBe(false);
    }
  });

  it("should fail if the build client cant be instantiated", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue(Promise.reject());

    try {
      await installLifecyclePipeline(mockValues);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).not.toBeNull();
    }
  });

  it("should fail if the pipeline definition cannot be created", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue({});
    (createPipelineForDefinition as jest.Mock).mockReturnValue(
      Promise.reject()
    );

    try {
      await installLifecyclePipeline(mockValues);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).not.toBeNull();
    }
  });

  it("should fail if a build cannot be queued on the pipeline", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue({});
    (createPipelineForDefinition as jest.Mock).mockReturnValue({ id: 10 });
    (queueBuild as jest.Mock).mockReturnValue(Promise.reject());

    try {
      await installLifecyclePipeline(mockValues);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).not.toBeNull();
    }
  });

  it("should fail if a build definition id doesn't exist", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue({});
    (createPipelineForDefinition as jest.Mock).mockReturnValue({
      fakeProperty: "temp"
    });
    (queueBuild as jest.Mock).mockReturnValue(Promise.reject());

    try {
      await installLifecyclePipeline(mockValues);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeDefined();
      const builtDefnString = JSON.stringify({ fakeProperty: "temp" });
      expect(e.message).toBe(
        `Invalid BuildDefinition created, parameter 'id' is missing from ${builtDefnString}`
      );
    }
  });
});
