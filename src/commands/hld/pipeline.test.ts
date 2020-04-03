import * as config from "../../config";
import * as azdo from "../../lib/azdoClient";
import { BUILD_SCRIPT_URL } from "../../lib/constants";
import { getRepositoryName } from "../../lib/gitutils";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { getErrorMessage } from "../../lib/errorBuilder";
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

jest.spyOn(azdo, "validateRepository").mockResolvedValue();

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

const orgNameTest = (hasVal: boolean): void => {
  jest.spyOn(config, "Config").mockReturnValueOnce({});
  const data = {
    buildScriptUrl: "",
    devopsProject: "project",
    hldName: "",
    hldUrl: "https://dev.azure.com/mocked/fabrikam/_git/hld",
    manifestUrl: "https://dev.azure.com/mocked/fabrikam/_git/materialized",
    orgName: hasVal ? "org Name" : "",
    personalAccessToken: "somesecret",
    pipelineName: "",
    yamlFileBranch: "",
  };

  if (hasVal) {
    expect(() => populateValues(data)).toThrow(
      getErrorMessage("validation-err-org-name")
    );
  } else {
    expect(() => populateValues(data)).toThrow(
      `The following arguments are required:
 -o, --org-name <organization-name>`
    );
  }
};

const projectNameTest = (hasVal: boolean): void => {
  jest.spyOn(config, "Config").mockReturnValueOnce({});
  const data = {
    buildScriptUrl: "",
    devopsProject: hasVal ? "project\\abc" : "",
    hldName: "",
    hldUrl: "https://dev.azure.com/mocked/fabrikam/_git/hld",
    manifestUrl: "https://dev.azure.com/mocked/fabrikam/_git/materialized",
    orgName: "orgName",
    personalAccessToken: "somesecret",
    pipelineName: "",
    yamlFileBranch: "",
  };

  if (hasVal) {
    expect(() => populateValues(data)).toThrow(
      "Project name can't contain special characters, such as / : \\ ~ & % ; @ ' \" ? < > | # $ * } { , + = [ ]"
    );
  } else {
    expect(() => populateValues(data)).toThrow(
      `The following arguments are required:
 -d, --devops-project <devops-project>`
    );
  }
};

describe("test populateValues function", () => {
  it("with all values in command opts", () => {
    jest.spyOn(config, "Config").mockReturnValueOnce(MOCKED_CONFIG);
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
        devopsProject: "project",
        hldName: "",
        hldUrl: "https://github.com/fabrikam/hld",
        manifestUrl: "https://github.com/fabrikam/materialized",
        orgName: "orgName",
        personalAccessToken: "somevalue",
        pipelineName: "",
        yamlFileBranch: "",
      })
    ).toThrow(`GitHub repos are not supported`);
  });
  it("negative tests: missing and invalid org name", () => {
    orgNameTest(false);
    orgNameTest(true);
  });
  it("negative tests: missing and invalid project name", () => {
    projectNameTest(false);
    projectNameTest(true);
  });
});

describe("test execute function", () => {
  it("positive test", async () => {
    jest.spyOn(config, "Config").mockReturnValueOnce(MOCKED_CONFIG);
    const exitFn = jest.fn();
    jest
      .spyOn(pipeline, "installHldToManifestPipeline")
      .mockResolvedValueOnce();

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
    (createPipelineForDefinition as jest.Mock).mockReturnValueOnce({ id: 10 });
    await installHldToManifestPipeline(getMockObject());
  });

  it("should fail if the build client cant be instantiated", async () => {
    (getBuildApiClient as jest.Mock).mockRejectedValueOnce(Error("Error"));
    await expect(installHldToManifestPipeline(getMockObject())).rejects.toThrow(
      "Error"
    );
  });

  it("should fail if the pipeline definition cannot be created", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValueOnce({});
    (createPipelineForDefinition as jest.Mock).mockRejectedValueOnce(
      Error("Error")
    );
    await expect(installHldToManifestPipeline(getMockObject())).rejects.toThrow(
      "Error"
    );
  });

  it("should fail if a build cannot be queued on the pipeline", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValueOnce({});
    (createPipelineForDefinition as jest.Mock).mockReturnValueOnce({ id: 10 });
    (queueBuild as jest.Mock).mockRejectedValueOnce(Error("Error"));
    await expect(installHldToManifestPipeline(getMockObject())).rejects.toThrow(
      "Error"
    );
  });
});
