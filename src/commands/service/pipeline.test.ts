import { disableVerboseLogging, enableVerboseLogging } from "../../logger";

jest.mock("../../lib/pipelines/pipelines");

import {
  createPipelineForDefinition,
  getBuildApiClient,
  queueBuild
} from "../../lib/pipelines/pipelines";

import {
  installBuildUpdatePipeline,
  isValidConfig,
  requiredPipelineVariables
} from "./pipeline";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

/**
 * Validates the pipeline configuration
 * @param pipelineName Name of pipeline
 * @param personalAccessToken Personal access token
 * @param orgName Name of organization
 * @param repoName Name of repository
 * @param repoUrl URL of repository
 * @param devopsProject DevOps project
 * @param buildScriptUrl URL of build script
 */

describe("validate pipeline config", () => {
  it("config is valid", () => {
    expect(
      isValidConfig(
        "testPipeline",
        "KD93U3KFJKD039932",
        "testOrg",
        "testRepo",
        "http://test/repo",
        "testProject",
        "http://build/script.sh"
      )
    ).toBe(true);
  });

  it("invalid pipelineName", () => {
    expect(
      isValidConfig(
        undefined,
        "KD93U3KFJKD039932",
        "testOrg",
        "testRepo",
        "http://test/repo",
        "testProject",
        "http://build/script.sh"
      )
    ).toBe(false);
  });

  it("invalid personalAccessToken", () => {
    expect(
      isValidConfig(
        "testPipeline",
        undefined,
        "testOrg",
        "testRepo",
        "http://test/repo",
        "testProject",
        "http://build/script.sh"
      )
    ).toBe(false);
  });

  it("invalid orgName", () => {
    expect(
      isValidConfig(
        "testPipeline",
        "KD93U3KFJKD039932",
        undefined,
        "testRepo",
        "http://test/repo",
        "testProject",
        "http://build/script.sh"
      )
    ).toBe(false);
  });

  it("invalid repoName", () => {
    expect(
      isValidConfig(
        "testPipeline",
        "KD93U3KFJKD039932",
        "testOrg",
        undefined,
        "http://test/repo",
        "testProject",
        "http://build/script.sh"
      )
    ).toBe(false);
  });

  it("invalid repoUrl", () => {
    expect(
      isValidConfig(
        "testPipeline",
        "KD93U3KFJKD039932",
        "testOrg",
        "testRepo",
        undefined,
        "testProject",
        "http://build/script.sh"
      )
    ).toBe(false);
  });

  it("invalid devOpsProject", () => {
    expect(
      isValidConfig(
        "testPipeline",
        "KD93U3KFJKD039932",
        "testOrg",
        "testRepo",
        "http://test/repo",
        undefined,
        "http://build/script.sh"
      )
    ).toBe(false);
  });

  it("invalid buildScriptUrl", () => {
    expect(
      isValidConfig(
        "testPipeline",
        "KD93U3KFJKD039932",
        "testOrg",
        "testRepo",
        "http://test/repo",
        "testProject",
        undefined
      )
    ).toBe(false);
  });
});

describe("required pipeline variables", () => {
  it("should use have the proper pipeline vars vars", () => {
    const variables = requiredPipelineVariables("buildScriptUrl");

    expect(Object.keys(variables).length).toBe(1);

    expect(variables.BUILD_SCRIPT_URL.value).toBe("buildScriptUrl");
    expect(variables.BUILD_SCRIPT_URL.isSecret).toBe(false);
    expect(variables.BUILD_SCRIPT_URL.allowOverride).toBe(true);
  });
});

describe("create pipeline tests", () => {
  it("should create a pipeline", async () => {
    (createPipelineForDefinition as jest.Mock).mockReturnValue({ id: 10 });

    const exitFn = jest.fn();
    await installBuildUpdatePipeline(
      "serviceName",
      "orgName",
      "personalAccessToken",
      "pipelineName",
      "repositoryName",
      "repositoryUrl",
      "project",
      "packagesDir",
      "buildScriptUrl",
      exitFn
    );

    expect(exitFn).toBeCalledTimes(0);
  });

  it("should fail if the build client cant be instantiated", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue(Promise.reject());

    const exitFn = jest.fn();
    await installBuildUpdatePipeline(
      "serviceName",
      "orgName",
      "personalAccessToken",
      "pipelineName",
      "repositoryName",
      "repositoryUrl",
      "project",
      "packagesDir",
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
    await installBuildUpdatePipeline(
      "serviceName",
      "orgName",
      "personalAccessToken",
      "pipelineName",
      "repositoryName",
      "repositoryUrl",
      "project",
      "packagesDir",
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
    await installBuildUpdatePipeline(
      "serviceName",
      "orgName",
      "personalAccessToken",
      "pipelineName",
      "repositoryName",
      "repositoryUrl",
      "project",
      "packagesDir",
      "buildScriptUrl",
      exitFn
    );

    expect(exitFn).toBeCalledTimes(1);
  });
});
