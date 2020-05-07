import * as azdoGit from "../../lib/git/azure";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { create as createBedrockYaml } from "../../lib/bedrockYaml";
jest.mock("../../lib/pipelines/pipelines");

import {
  createPipelineForDefinition,
  getBuildApiClient,
  queueBuild,
} from "../../lib/pipelines/pipelines";
import { deepClone } from "../../lib/util";
import {
  execute,
  fetchValues,
  CommandOptions,
  installBuildUpdatePipeline,
  requiredPipelineVariables,
} from "./pipeline";
import * as pipeline from "./pipeline";
import { createTempDir } from "../../lib/ioUtil";

const MOCKED_VALUES: CommandOptions = {
  buildScriptUrl: "buildScriptUrl",
  devopsProject: "project",
  orgName: "orgName",
  packagesDir: "packagesDir",
  personalAccessToken: "personalAccessToken",
  pipelineName: "pipelineName",
  repoName: "repositoryName",
  repoUrl: "https://dev.azure.com/test/fabrikam/_git/app",
  yamlFileBranch: "master",
};

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

beforeEach(() => {
  jest.clearAllMocks();
});

const getMockedValues = (): CommandOptions => {
  return deepClone(MOCKED_VALUES);
};

jest.spyOn(azdoGit, "validateRepository").mockReturnValue(Promise.resolve());

describe("test fetchValues function", () => {
  it("with all values set", async () => {
    const mockedVals = getMockedValues();
    const values = await fetchValues("serviceName", mockedVals);
    expect(values).toEqual(mockedVals);
  });
  it("missing packagesDir value", async () => {
    const mockedVals = getMockedValues();
    mockedVals.packagesDir = undefined;
    const values = await fetchValues("serviceName", mockedVals);
    expect(values).toEqual(mockedVals);
  });
  it("check that pipelineName is set when it is not provided ", async () => {
    const mockedVals = getMockedValues();
    mockedVals.pipelineName = "";
    const serviceName = "AAAService";
    const values = await fetchValues(serviceName, mockedVals);
    expect(values.pipelineName).toBe(`${serviceName}-pipeline`);
  });
  it("invalid org name", async () => {
    const mockedVals = getMockedValues();
    mockedVals.orgName = "abc def";
    await expect(fetchValues("serviceName", mockedVals)).rejects.toThrow();
  });
  it("invalid project name", async () => {
    const mockedVals = getMockedValues();
    mockedVals.devopsProject = "some\\thing";
    await expect(fetchValues("serviceName", mockedVals)).rejects.toThrow();
  });
});

describe("test execute function", () => {
  const tmpDir = createTempDir();
  createBedrockYaml(tmpDir, {
    rings: {
      master: {
        isDefault: true,
      },
    },
    services: [
      {
        displayName: "serviceName",
        path: "./my-service",
        helm: {
          chart: {
            branch: "master",
            git: "https://github.com/microsoft/bedrock-cli-demo-repo.git",
            path: "my-service",
          },
        },
        k8sBackendPort: 80,
      },
    ],
    variableGroups: ["testvg"],
    version: "1.0",
  });
  it("positive test: with all values set", async () => {
    const exitFn = jest.fn();
    jest
      .spyOn(pipeline, "installBuildUpdatePipeline")
      .mockReturnValueOnce(Promise.resolve());

    await execute("serviceName", tmpDir, getMockedValues(), exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
  it("negative test: definitionForAzureRepoPipeline without return id", async () => {
    const exitFn = jest.fn();
    (createPipelineForDefinition as jest.Mock).mockReturnValueOnce({}); // without id
    await execute("serviceName", tmpDir, getMockedValues(), exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("negative test: repo url not defined", async () => {
    const exitFn = jest.fn();
    const mockedVals = getMockedValues();
    mockedVals.repoUrl = "";
    await execute("serviceName", tmpDir, mockedVals, exitFn);
    expect(exitFn).toBeCalledTimes(1);
  });
  it("negative test: github repo not supported", async () => {
    const exitFn = jest.fn();
    const mockedVals = getMockedValues();
    mockedVals.repoUrl = "https://github.com/microsoft/bedrock";
    await execute("serviceName", tmpDir, mockedVals, exitFn);
    expect(exitFn).toBeCalledTimes(1);
  });
  it("negative test: service is not defined", async () => {
    const exitFn = jest.fn();

    await execute("myServiceName", tmpDir, getMockedValues(), exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
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
    (createPipelineForDefinition as jest.Mock).mockReturnValueOnce({ id: 10 });
    await installBuildUpdatePipeline("/path/to/yaml", MOCKED_VALUES);
  });

  it("should fail if the build client cant be instantiated", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValueOnce(Promise.reject());

    try {
      await installBuildUpdatePipeline("/path/to/yaml", MOCKED_VALUES);
      expect(true).toBe(false);
    } catch (_) {
      // expecting exception to be thrown
    }
  });

  it("should fail if the pipeline definition cannot be created", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValueOnce({});
    (createPipelineForDefinition as jest.Mock).mockReturnValueOnce(
      Promise.reject()
    );

    try {
      await installBuildUpdatePipeline("/path/to/yaml", MOCKED_VALUES);
      expect(true).toBe(false);
    } catch (_) {
      // expecting exception to be thrown
    }
  });

  it("should fail if a build cannot be queued on the pipeline", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValueOnce({});
    (createPipelineForDefinition as jest.Mock).mockReturnValueOnce({ id: 10 });
    (queueBuild as jest.Mock).mockReturnValueOnce(Promise.reject());

    try {
      await installBuildUpdatePipeline("/path/to/yaml", MOCKED_VALUES);
      expect(true).toBe(false);
    } catch (_) {
      // expecting exception to be thrown
    }
  });
});
