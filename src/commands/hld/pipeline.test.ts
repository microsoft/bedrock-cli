/* eslint-disable @typescript-eslint/camelcase */
import * as config from "../../config";
import * as azdo from "../../lib/azdoClient";
import { BUILD_SCRIPT_URL } from "../../lib/constants";
import { getRepositoryName } from "../../lib/gitutils";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
jest.mock("../../lib/pipelines/pipelines");

import {
  createPipelineForDefinition,
  getBuildApiClient,
  queueBuild,
} from "../../lib/pipelines/pipelines";
import { deepClone } from "../../lib/util";
import { ConfigYaml } from "../../types";

import {
  emptyStringIfUndefined,
  execute,
  CommandOptions,
  installHldToManifestPipeline,
  populateValues,
  requiredPipelineVariables,
} from "./pipeline";
import * as pipeline from "./pipeline";

const MOCKED_VALUES: CommandOptions = {
  buildScriptUrl: "buildScriptUrl",
  devopsProject: "project",
  hldName: "hldName",
  hldUrl: "https://dev.azure.com/test/fabrikam/_git/hld",
  manifestUrl: "https://dev.azure.com/test/fabrikam/_git/materialized",
  orgName: "orgName",
  personalAccessToken: "personalAccessToken",
  pipelineName: "pipelineName",
  yamlFileBranch: "master",
};

const MOCKED_CONFIG = {
  azure_devops: {
    access_token: "mocked_access_token",
    hld_repository: "https://dev.azure.com/mocked/fabrikam/_git/hld",
    manifest_repository:
      "https://dev.azure.com/mocked/fabrikam/_git/materialized",
    org: "mocked_org",
    project: "mocked_project",
  },
};

const getMockObject = (): CommandOptions => {
  return deepClone(MOCKED_VALUES);
};

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

jest.spyOn(azdo, "repositoryHasFile").mockReturnValue(Promise.resolve());

describe("test emptyStringIfUndefined function", () => {
  it("pass in undefined", () => {
    expect(emptyStringIfUndefined(undefined)).toBe("");
  });
  it("send in empty string", () => {
    expect(emptyStringIfUndefined("")).toBe("");
  });
  it("send in string", () => {
    expect(emptyStringIfUndefined("test")).toBe("test");
  });
});

describe("test populateValues function", () => {
  it("with all values in command opts", () => {
    jest.spyOn(config, "Config").mockImplementationOnce(
      (): ConfigYaml => {
        return MOCKED_CONFIG;
      }
    );
    const mockedObject = getMockObject();
    expect(populateValues(mockedObject)).toEqual(mockedObject);
  });
  it("without any values in command opts", () => {
    jest.spyOn(config, "Config").mockImplementationOnce(
      (): ConfigYaml => {
        return MOCKED_CONFIG;
      }
    );
    const values = populateValues({
      buildScriptUrl: "",
      devopsProject: "",
      hldName: "",
      hldUrl: "https://dev.azure.com/mocked/fabrikam/_git/hld",
      manifestUrl: "https://dev.azure.com/mocked/fabrikam/_git/materialized",
      orgName: "",
      personalAccessToken: "",
      pipelineName: "",
      yamlFileBranch: "",
    });

    expect(values.buildScriptUrl).toBe(BUILD_SCRIPT_URL);
    expect(values.devopsProject).toBe(MOCKED_CONFIG.azure_devops.project);
    expect(values.hldName).toBe(
      getRepositoryName(MOCKED_CONFIG.azure_devops.hld_repository)
    );
    expect(values.hldUrl).toBe(MOCKED_CONFIG.azure_devops.hld_repository);
    expect(values.manifestUrl).toBe(
      MOCKED_CONFIG.azure_devops.manifest_repository
    );
    expect(values.orgName).toBe(MOCKED_CONFIG.azure_devops.org);
    expect(values.personalAccessToken).toBe(
      MOCKED_CONFIG.azure_devops.access_token
    );
    expect(values.pipelineName).toBe(
      getRepositoryName(MOCKED_CONFIG.azure_devops.hld_repository) +
        "-to-" +
        getRepositoryName(MOCKED_CONFIG.azure_devops.manifest_repository)
    );
    expect(values.yamlFileBranch).toBe("");
  });
  it("negative tests: github repos not supported", () => {
    expect(() =>
      populateValues({
        buildScriptUrl: "",
        devopsProject: "",
        hldName: "",
        hldUrl: "https://github.com/fabrikam/hld",
        manifestUrl: "https://github.com/fabrikam/materialized",
        orgName: "",
        personalAccessToken: "",
        pipelineName: "",
        yamlFileBranch: "",
      })
    ).toThrow(`GitHub repos are not supported`);
  });
  it("negative tests: github repos not supported", () => {
    expect(() =>
      populateValues({
        buildScriptUrl: "",
        devopsProject: "",
        hldName: "",
        hldUrl: "https://github.com/fabrikam/hld",
        manifestUrl: "https://github.com/fabrikam/materialized",
        orgName: "",
        personalAccessToken: "",
        pipelineName: "",
        yamlFileBranch: "",
      })
    ).toThrow(`GitHub repos are not supported`);
  });
});

describe("test execute function", () => {
  it("positive test", async () => {
    jest.spyOn(config, "Config").mockImplementationOnce(
      (): ConfigYaml => {
        return MOCKED_CONFIG;
      }
    );
    const exitFn = jest.fn();
    jest
      .spyOn(pipeline, "installHldToManifestPipeline")
      .mockReturnValueOnce(Promise.resolve());

    await execute(MOCKED_VALUES, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
  it("negative test", async () => {
    const exitFn = jest.fn();
    await execute(MOCKED_VALUES, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
});

describe("required pipeline variables", () => {
  it("should use have the proper pipeline vars vars", () => {
    const variables = requiredPipelineVariables(
      "somePAT",
      "buildScriptUrl",
      "manifestRepoUrl"
    );

    expect(Object.keys(variables).length).toBe(3);

    expect(variables.PAT.value).toBe("somePAT");
    expect(variables.PAT.isSecret).toBe(true);
    expect(variables.PAT.allowOverride).toBe(true);

    expect(variables.BUILD_SCRIPT_URL.value).toBe("buildScriptUrl");
    expect(variables.BUILD_SCRIPT_URL.isSecret).toBe(false);
    expect(variables.BUILD_SCRIPT_URL.allowOverride).toBe(true);

    expect(variables.MANIFEST_REPO.value).toBe("manifestRepoUrl");
    expect(variables.MANIFEST_REPO.isSecret).toBe(false);
    expect(variables.MANIFEST_REPO.allowOverride).toBe(true);
  });
});

describe("create hld to manifest pipeline test", () => {
  it("should create a pipeline", async () => {
    (createPipelineForDefinition as jest.Mock).mockReturnValue({ id: 10 });
    await installHldToManifestPipeline(getMockObject());
  });

  it("should fail if the build client cant be instantiated", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue(Promise.reject("Error"));
    try {
      await installHldToManifestPipeline(getMockObject());
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeDefined();
    }
  });

  it("should fail if the pipeline definition cannot be created", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue({});
    (createPipelineForDefinition as jest.Mock).mockReturnValue(
      Promise.reject("Error")
    );
    try {
      await installHldToManifestPipeline(getMockObject());
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeDefined();
    }
  });

  it("should fail if a build cannot be queued on the pipeline", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue({});
    (createPipelineForDefinition as jest.Mock).mockReturnValue({ id: 10 });
    (queueBuild as jest.Mock).mockReturnValue(Promise.reject("Error"));

    try {
      await installHldToManifestPipeline(getMockObject());
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeDefined();
    }
  });
});
