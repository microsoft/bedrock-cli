import { disableVerboseLogging, enableVerboseLogging } from "../../logger";

jest.mock("../../lib/pipelines/pipelines");

import {
  createPipelineForDefinition,
  getBuildApiClient,
  queueBuild
} from "../../lib/pipelines/pipelines";

import {
  installBuildUpdatePipeline,
  requiredPipelineVariables
} from "./pipeline";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
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
