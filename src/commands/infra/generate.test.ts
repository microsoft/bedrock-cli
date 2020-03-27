import fs from "fs";
import * as fsExtra from "fs-extra";
import path from "path";
import simpleGit from "simple-git/promise";
import { loadConfigurationFromLocalEnv, readYaml } from "../../config";
import { safeGitUrlForLogging } from "../../lib/gitutils";
import { removeDir } from "../../lib/ioUtil";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { InfraConfigYaml } from "../../types";
import {
  checkRemoteGitExist,
  createGenerated,
  DefinitionYAMLExistence,
  dirIteration,
  execute,
  generateConfig,
  generateTfvars,
  getParentGeneratedFolder,
  gitCheckout,
  gitClone,
  gitFetchPull,
  retryRemoteValidate,
  validateDefinition,
  validateRemoteSource,
  validateTemplateSources,
} from "./generate";
import * as generate from "./generate";
import {
  BACKEND_TFVARS,
  DEFAULT_VAR_VALUE,
  DEFINITION_YAML,
  getSourceFolderNameFromURL,
  SPK_TFVARS,
  spkTemplatesPath,
  VARIABLES_TF,
} from "./infra_common";
import * as infraCommon from "./infra_common";

interface GitTestData {
  source: string;
  sourcePath: string;
  safeLoggingUrl: string;
}

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

afterEach(() => {
  removeDir(
    path.join(
      "src",
      "commands",
      "infra",
      "mocks",
      "discovery-service-generated"
    )
  );
});

//////////////////////////////////////////////////////////////////////////////
//
// --- start git tests
//
//////////////////////////////////////////////////////////////////////////////
const getMockedDataForGitTests = async (
  positive: boolean
): Promise<GitTestData> => {
  const mockParentPath = "src/commands/infra/mocks/discovery-service";
  const mockProjectPath = "src/commands/infra/mocks/discovery-service/west";
  const sourceConfiguration = validateDefinition(
    mockParentPath,
    mockProjectPath
  );
  const sourceConfig = validateTemplateSources(
    sourceConfiguration,
    mockParentPath,
    mockProjectPath
  );
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let source = sourceConfig.source!;
  if (!positive) {
    source += "dummy";
  }

  // Converting source name to storable folder name
  const sourceFolder = getSourceFolderNameFromURL(source);
  const sourcePath = path.join(spkTemplatesPath, sourceFolder);
  const safeLoggingUrl = safeGitUrlForLogging(source);

  return {
    safeLoggingUrl,
    source,
    sourcePath,
  };
};

const testCheckRemoteGitExist = async (positive: boolean): Promise<void> => {
  const { safeLoggingUrl, source, sourcePath } = await getMockedDataForGitTests(
    positive
  );
  if (positive && !fs.existsSync(sourcePath)) {
    createGenerated(sourcePath);
  }
  if (!positive) {
    removeDir(sourcePath);
  }
  await checkRemoteGitExist(sourcePath, source, safeLoggingUrl);
};

describe("test checkRemoteGitExist function", () => {
  it("postive Test", async () => {
    await testCheckRemoteGitExist(true);
    // no exception thrown
  });
  // cannot do negative test because it will take too long
  // and timeout
  it("negative Test", async (done) => {
    await expect(testCheckRemoteGitExist(false)).rejects.toThrow();
    done();
  });
});

const testGitFetchPull = async (positive: boolean): Promise<void> => {
  const { safeLoggingUrl, sourcePath } = await getMockedDataForGitTests(
    positive
  );
  if (!positive || fs.existsSync(path.join(sourcePath, ".git"))) {
    await gitFetchPull(sourcePath, safeLoggingUrl);
  }
};

describe("test gitFetchPull function", () => {
  it("postive Test", async () => {
    await testGitFetchPull(true);
    // no exception thrown
  });
  it("negative Test", async () => {
    try {
      await testGitFetchPull(false);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});

const testGitCheckout = async (positive: boolean): Promise<void> => {
  const { sourcePath } = await getMockedDataForGitTests(positive);
  if (!positive || fs.existsSync(path.join(sourcePath, ".git"))) {
    await gitCheckout(sourcePath, "v0.0.1");
  }
};

describe("test gitCheckout function", () => {
  it("postive Test", async () => {
    await testGitCheckout(true);
    // no exception thrown
  });
  it("negative Test", async () => {
    try {
      await testGitCheckout(false);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});

describe("test gitClone function", () => {
  it("postive Test", async () => {
    const git = simpleGit();
    git.clone = async (): Promise<"ok"> => {
      return "ok";
    };
    await gitClone(git, "source", "path");
    // no exception thrown
  });
  it("negative Test", async () => {
    const git = simpleGit();
    git.clone = (): Promise<never> => {
      throw new Error("Error");
    };

    await expect(gitClone(git, "source", "path")).rejects.toThrow();
  });
});

describe("Validate remote git source", () => {
  test("Validating that a git source is cloned to .spk/templates", async () => {
    jest.spyOn(generate, "checkRemoteGitExist").mockResolvedValueOnce();
    jest.spyOn(generate, "gitFetchPull").mockResolvedValueOnce();
    jest.spyOn(generate, "gitCheckout").mockResolvedValueOnce();

    const mockParentPath = "src/commands/infra/mocks/discovery-service";
    const mockProjectPath = "src/commands/infra/mocks/discovery-service/west";
    const sourceConfiguration = validateDefinition(
      mockParentPath,
      mockProjectPath
    );
    const source = validateTemplateSources(
      sourceConfiguration,
      mockParentPath,
      mockProjectPath
    );
    try {
      await validateRemoteSource(source);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeDefined();
    }
  });
});

jest.spyOn(generate, "gitClone").mockReturnValue(Promise.resolve());
jest.spyOn(generate, "createGenerated").mockReturnValue();
jest.spyOn(generate, "checkTfvars").mockReturnValue();
jest.spyOn(generate, "writeTfvarsFile").mockReturnValue();

//////////////////////////////////////////////////////////////////////////////
//
// --- end git tests
//
//////////////////////////////////////////////////////////////////////////////

describe("test getParentGeneratedFolder function", () => {
  it("with output path", () => {
    expect(getParentGeneratedFolder("abc", "output")).toBe(
      path.join("output", "abc-generated")
    );
    expect(getParentGeneratedFolder("abc", path.join("dir", "output"))).toBe(
      path.join("dir", "output", "abc-generated")
    );
  });
  it("without output path", () => {
    expect(getParentGeneratedFolder("abc", "")).toBe(
      path.join("abc-generated")
    );
    expect(getParentGeneratedFolder(path.join("dir", "abc"), "")).toBe(
      path.join("dir", "abc-generated")
    );
  });
});

describe("fetch execute function", () => {
  it("negative time, expected exit code to be 1", async () => {
    const exitFn = jest.fn();
    await execute(
      {
        output: "",
        project: "test",
      },
      exitFn
    );

    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("negative time, simulate error in generateConfig function", async () => {
    jest
      .spyOn(generate, "validateDefinition")
      .mockReturnValueOnce(DefinitionYAMLExistence.PARENT_ONLY);
    jest.spyOn(generate, "validateTemplateSources").mockReturnValueOnce({});
    jest.spyOn(generate, "validateRemoteSource").mockResolvedValueOnce();
    jest
      .spyOn(infraCommon, "getSourceFolderNameFromURL")
      .mockImplementationOnce(() => {
        throw Error("Fake");
      });
    const exitFn = jest.fn();
    await execute(
      {
        output: "",
        project: "test",
      },
      exitFn
    );

    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("with project value", async () => {
    jest
      .spyOn(generate, "validateDefinition")
      .mockReturnValueOnce(DefinitionYAMLExistence.BOTH_EXIST);
    jest.spyOn(generate, "validateRemoteSource").mockResolvedValueOnce();
    jest.spyOn(generate, "validateTemplateSources").mockReturnValueOnce({});
    jest
      .spyOn(generate, "generateConfig")
      .mockReturnValueOnce(Promise.resolve());

    const exitFn = jest.fn();
    await execute(
      {
        output: "",
        project: "test",
      },
      exitFn
    );

    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
    jest.clearAllMocks();
  });
});

describe("test validateRemoteSource function", () => {
  it("positive test", async () => {
    jest
      .spyOn(infraCommon, "getSourceFolderNameFromURL")
      .mockReturnValueOnce("sourceFolder");
    jest.spyOn(generate, "checkRemoteGitExist").mockResolvedValueOnce();
    jest.spyOn(generate, "gitClone").mockResolvedValueOnce();
    jest.spyOn(generate, "gitCheckout").mockResolvedValueOnce();

    await validateRemoteSource({
      source: "source",
      version: "0.1",
    });
  });
  it("positive test: with Error refusing to merge unrelated histories", async () => {
    jest
      .spyOn(infraCommon, "getSourceFolderNameFromURL")
      .mockReturnValueOnce("sourceFolder");
    jest.spyOn(generate, "checkRemoteGitExist").mockResolvedValueOnce();
    jest
      .spyOn(generate, "gitClone")
      .mockRejectedValueOnce(Error("refusing to merge unrelated histories"));
    jest.spyOn(generate, "retryRemoteValidate").mockResolvedValueOnce();

    await validateRemoteSource({
      source: "source",
      version: "0.1",
    });
  });
  it("positive test: with Error Authentication failed", async () => {
    jest
      .spyOn(infraCommon, "getSourceFolderNameFromURL")
      .mockReturnValueOnce("sourceFolder");
    jest.spyOn(generate, "checkRemoteGitExist").mockResolvedValueOnce();
    jest
      .spyOn(generate, "gitClone")
      .mockRejectedValueOnce(Error("Authentication failed"));
    jest.spyOn(generate, "retryRemoteValidate").mockResolvedValueOnce();

    await validateRemoteSource({
      source: "source",
      version: "0.1",
    });
  });
  it("negative test: with unknown Error", async () => {
    jest
      .spyOn(infraCommon, "getSourceFolderNameFromURL")
      .mockReturnValueOnce("sourceFolder");
    jest.spyOn(generate, "checkRemoteGitExist").mockResolvedValueOnce();
    jest
      .spyOn(generate, "gitClone")
      .mockRejectedValueOnce(Error("other error"));
    jest.spyOn(generate, "retryRemoteValidate").mockResolvedValueOnce();

    try {
      await validateRemoteSource({
        source: "source",
        version: "0.1",
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err.errorCode).toBe(1100);
    }
  });
});

describe("test retryRemoteValidate function", () => {
  it("positive test", async () => {
    jest.spyOn(fsExtra, "removeSync").mockReturnValueOnce();
    jest.spyOn(generate, "gitClone").mockReturnValueOnce(Promise.resolve());
    jest.spyOn(generate, "gitFetchPull").mockReturnValueOnce(Promise.resolve());
    jest.spyOn(generate, "gitCheckout").mockReturnValueOnce(Promise.resolve());
    await retryRemoteValidate("source", "sourcePath", "safeLoggingUrl", "0.1");
  });
  it("negative test", async () => {
    jest.spyOn(fsExtra, "removeSync").mockReturnValueOnce();
    jest.spyOn(generate, "gitClone").mockRejectedValueOnce(Error("error"));

    await expect(
      retryRemoteValidate("source", "sourcePath", "safeLoggingUrl", "0.1")
    ).rejects.toThrow();
  });
});

describe("test generateTfvars function", () => {
  it("undefined as data", () => {
    expect(generateTfvars(undefined)).toEqual([]);
  });
  it("one value as data", () => {
    expect(
      generateTfvars({
        hello: "world",
      })
    ).toEqual(['hello = "world"']);
  });
  it("one key with quote as data", () => {
    expect(
      generateTfvars({
        'h"ello': "world",
      })
    ).toEqual(['h"ello = "world"']);
  });
  it("multiple values as data", () => {
    expect(
      generateTfvars({
        key1: "value1",
        key2: "value2",
        key3: "value3",
      })
    ).toEqual(['key1 = "value1"', 'key2 = "value2"', 'key3 = "value3"']);
  });
});

describe("test dirIteration", () => {
  it("parentObject and leafObject are undefined", () => {
    const result = dirIteration(undefined, undefined);
    expect(result).toEqual({});
  });
  it("parentObject is undefined", () => {
    const leafObject = {
      custerName: "cluster1",
    };
    const result = dirIteration(undefined, leafObject);
    expect(result).toEqual(leafObject);
  });
  it("leafObject is undefined", () => {
    const parentObject = {
      custerName: "cluster1",
    };
    const result = dirIteration(parentObject, undefined);
    expect(result).toEqual(parentObject);
  });
  it("one variable test", () => {
    const parentObject = {
      custerName: "parent",
    };
    const leafObject = {
      custerName: "leaf",
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(leafObject);
  });
  it("one variable test, parentObject without the variable", () => {
    const parentObject = {};
    const leafObject = {
      custerName: "leaf",
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(leafObject);
  });
  it("one variable test, leafObject without the variable", () => {
    const parentObject = {
      custerName: "leaf",
    };
    const leafObject = {};
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(parentObject);
  });
  it("multiple variables test", () => {
    const parentObject = {
      custerName: "parent",
      variable1: "parent1",
      variable2: "parent2",
    };
    const leafObject = {
      custerName: "leaf",
      variable1: "leaf1",
      variable2: "leaf2",
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(leafObject);
  });
  it("multiple variables test, leafObject does not values", () => {
    const parentObject = {
      custerName: "parent",
      variable1: "parent1",
      variable2: "parent2",
    };
    const leafObject = {};
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(parentObject);
  });
  it("multiple variables test, parentObject does not values", () => {
    const parentObject = {};
    const leafObject = {
      custerName: "leaf",
      variable1: "leaf1",
      variable2: "leaf2",
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(leafObject);
  });
  it("multiple variables test, parentObject has more values", () => {
    const parentObject = {
      custerName: "parent",
      variable1: "parent1",
      variable2: "parent2",
      xextra: "xextra",
    };
    const leafObject = {
      custerName: "leaf",
      variable1: "leaf1",
      variable2: "leaf2",
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual({
      custerName: "leaf",
      variable1: "leaf1",
      variable2: "leaf2",
      xextra: "xextra",
    });
  });
  it("multiple variables test, leafObject has more values", () => {
    const parentObject = {
      custerName: "parent",
      variable1: "parent1",
      variable2: "parent2",
    };
    const leafObject = {
      custerName: "leaf",
      variable1: "leaf1",
      variable2: "leaf2",
      xextra: "xextra",
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(leafObject);
  });
});

describe("Validate sources in definition.yaml files", () => {
  it("definition.yaml of leaf override parent's variable", async () => {
    const mockParentPath = "src/commands/infra/mocks/discovery-service";
    const mockProjectPath = "src/commands/infra/mocks/discovery-service/west";
    const expectedSourceWest = {
      source: "https://github.com/yradsmikham/spk-source",
      template: "cluster/environments/azure-single-keyvault",
      version: "v0.0.2",
    };
    const outputPath = "";
    const sourceConfiguration = validateDefinition(
      mockParentPath,
      mockProjectPath
    );
    expect(sourceConfiguration).toEqual(DefinitionYAMLExistence.BOTH_EXIST);
    const sourceData = validateTemplateSources(
      sourceConfiguration,
      mockParentPath,
      mockProjectPath
    );
    expect(sourceData).toEqual(expectedSourceWest);
    await generateConfig(
      mockParentPath,
      mockProjectPath,
      sourceConfiguration,
      sourceData,
      outputPath
    );
  });
  it("definition.yaml of leaf and parent configuration are the same", async () => {
    const mockParentPath = "src/commands/infra/mocks/discovery-service";
    const mockProjectPath = mockParentPath;
    const expectedSource = {
      source: "https://github.com/yradsmikham/spk-source",
      template: "cluster/environments/azure-single-keyvault",
      version: "v0.0.1",
    };
    const outputPath = "";
    const sourceConfiguration = validateDefinition(
      mockParentPath,
      mockProjectPath
    );
    expect(sourceConfiguration).toEqual(DefinitionYAMLExistence.BOTH_EXIST);
    const sourceData = validateTemplateSources(
      sourceConfiguration,
      mockParentPath,
      mockProjectPath
    );
    expect(sourceData).toEqual(expectedSource);
    await generateConfig(
      mockParentPath,
      mockProjectPath,
      sourceConfiguration,
      sourceData,
      outputPath
    );
    [
      "acr.tf",
      BACKEND_TFVARS,
      "main.tf",
      "README.md",
      SPK_TFVARS,
      VARIABLES_TF,
    ].forEach((f) => {
      fs.unlinkSync(path.join(mockParentPath, f));
    });
  });
  test("without parent's definition.yaml", () => {
    const mockParentPath = "src/commands/infra/mocks/missing-parent-defn";
    const mockProjectPath = "src/commands/infra/mocks/missing-parent-defn/west";
    try {
      validateDefinition(mockParentPath, mockProjectPath);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeDefined();
    }
  });

  test("without project's definition.yaml", async () => {
    const mockParentPath = "src/commands/infra/mocks/discovery-service";
    const mockProjectPath = "src/commands/infra/mocks/discovery-service/east";
    const expectedSourceEast = {
      source: "https://github.com/yradsmikham/spk-source",
      template: "cluster/environments/azure-single-keyvault",
      version: "v0.0.1",
    };
    const outputPath = "";
    const sourceConfiguration = validateDefinition(
      mockParentPath,
      mockProjectPath
    );
    expect(sourceConfiguration).toEqual(DefinitionYAMLExistence.PARENT_ONLY);
    const sourceData = validateTemplateSources(
      sourceConfiguration,
      mockParentPath,
      mockProjectPath
    );
    expect(sourceData).toEqual(expectedSourceEast);
    await generateConfig(
      mockParentPath,
      mockProjectPath,
      sourceConfiguration,
      sourceData,
      outputPath
    );
  });
  test("git source, template and version are missing in project path", async () => {
    const mockParentPath = "src/commands/infra/mocks/discovery-service";
    const mockProjectPath =
      "src/commands/infra/mocks/discovery-service/central";
    const expectedSourceCentral = {
      source: "https://github.com/yradsmikham/spk-source",
      template: "cluster/environments/azure-single-keyvault",
      version: "v0.0.1",
    };
    const outputPath = "";
    const sourceConfiguration = validateDefinition(
      mockParentPath,
      mockProjectPath
    );
    expect(sourceConfiguration).toEqual(DefinitionYAMLExistence.BOTH_EXIST);
    const sourceData = validateTemplateSources(
      sourceConfiguration,
      mockParentPath,
      mockProjectPath
    );
    expect(sourceData).toEqual(expectedSourceCentral);
    await generateConfig(
      mockParentPath,
      mockProjectPath,
      sourceConfiguration,
      sourceData,
      outputPath
    );
  });
  test("without parent's and project's definition.yaml", () => {
    const mockParentPath = "src/commands/infra/mocks";
    try {
      validateDefinition(mockParentPath, mockParentPath);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeDefined();
    }
  });
});

describe("Validate replacement of variables between parent and leaf definitions", () => {
  test("Validating that leaf definitions take precedence when generating multi-cluster definitions", () => {
    const mockParentPath = "src/commands/infra/mocks/discovery-service";
    const mockProjectPath = "src/commands/infra/mocks/discovery-service/west";
    const finalArray = [
      'acr_enabled = "true"',
      `address_space = "${DEFAULT_VAR_VALUE}"`,
      `agent_vm_count = "${DEFAULT_VAR_VALUE}"`,
      `agent_vm_size = "${DEFAULT_VAR_VALUE}"`,
      'cluster_name = "discovery-service-west"',
      `dns_prefix = "${DEFAULT_VAR_VALUE}"`,
      `flux_recreate = "${DEFAULT_VAR_VALUE}"`,
      `kubeconfig_recreate = "${DEFAULT_VAR_VALUE}"`,
      'gc_enabled = "true"',
      'gitops_poll_interval = "5m"',
      `gitops_ssh_url = "${DEFAULT_VAR_VALUE}"`,
      'gitops_url_branch = "master"',
      `gitops_ssh_key = "${DEFAULT_VAR_VALUE}"`,
      `gitops_path = "${DEFAULT_VAR_VALUE}"`,
      `keyvault_name = "${DEFAULT_VAR_VALUE}"`,
      `keyvault_resource_group = "${DEFAULT_VAR_VALUE}"`,
      `resource_group_name = "${DEFAULT_VAR_VALUE}"`,
      `ssh_public_key = "${DEFAULT_VAR_VALUE}"`,
      `service_principal_id = "${DEFAULT_VAR_VALUE}"`,
      `service_principal_secret = "${DEFAULT_VAR_VALUE}"`,
      `subnet_prefixes = "${DEFAULT_VAR_VALUE}"`,
      `vnet_name = "${DEFAULT_VAR_VALUE}"`,
      `subnet_name = "${DEFAULT_VAR_VALUE}"`,
      'network_plugin = "azure"',
      'network_policy = "azure"',
      'oms_agent_enabled = "false"',
      'enable_acr = "false"',
      `acr_name = "${DEFAULT_VAR_VALUE}"`,
    ];
    const parentData = readYaml<InfraConfigYaml>(
      path.join(mockParentPath, DEFINITION_YAML)
    );
    const parentInfraConfig: InfraConfigYaml | undefined = parentData
      ? loadConfigurationFromLocalEnv(parentData)
      : undefined;
    const leafData = readYaml<InfraConfigYaml>(
      path.join(mockProjectPath, DEFINITION_YAML)
    );
    const leafInfraConfig: InfraConfigYaml | undefined = leafData
      ? loadConfigurationFromLocalEnv(leafData)
      : undefined;
    const finalDefinition = dirIteration(
      parentInfraConfig ? parentInfraConfig.variables : undefined,
      leafInfraConfig ? leafInfraConfig.variables : undefined
    );
    const combinedSpkTfvarsObject = generateTfvars(finalDefinition);
    expect(combinedSpkTfvarsObject).toStrictEqual(finalArray);
  });
});

describe("Validate spk.tfvars file", () => {
  test("Validating that a spk.tfvars is generated and has appropriate format", () => {
    const mockProjectPath = "src/commands/infra/mocks/discovery-service";
    const data = readYaml<InfraConfigYaml>(
      path.join(mockProjectPath, DEFINITION_YAML)
    );
    const infraConfig = loadConfigurationFromLocalEnv(data);
    const spkTfvarsObject = generateTfvars(infraConfig.variables);
    expect(spkTfvarsObject).toContain('gitops_poll_interval = "5m"');
  });
});

describe("Validate backend.tfvars file", () => {
  test("Validating that a backend.tfvars is generated and has appropriate format", () => {
    const mockProjectPath = "src/commands/infra/mocks/discovery-service";
    const data = readYaml<InfraConfigYaml>(
      path.join(mockProjectPath, DEFINITION_YAML)
    );
    const infraConfig = loadConfigurationFromLocalEnv(data);
    const backendTfvarsObject = generateTfvars(infraConfig.backend);
    expect(backendTfvarsObject).toContain(
      'storage_account_name = "storage-account-name"'
    );
  });
});
