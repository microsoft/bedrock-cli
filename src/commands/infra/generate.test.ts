import fs from "fs";
import * as fsExtra from "fs-extra";
import path from "path";
import simpleGit from "simple-git/promise";
import { loadConfigurationFromLocalEnv, readYaml } from "../../config";
import { safeGitUrlForLogging } from "../../lib/gitutils";
import { removeDir } from "../../lib/ioUtil";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { IInfraConfigYaml } from "../../types";
import {
  checkRemoteGitExist,
  createGenerated,
  DefinitionYAMLExistence,
  dirIteration,
  execute,
  fetchValues,
  generateConfig,
  generateTfvars,
  gitCheckout,
  gitClone,
  gitFetchPull,
  retryRemoteValidate,
  validateDefinition,
  validateRemoteSource,
  validateTemplateSources
} from "./generate";
import * as generate from "./generate";
import * as infraCommon from "./infra_common";

interface IGitTestData {
  source: string;
  sourcePath: string;
  safeLoggingUrl: string;
}

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
  removeDir("src/commands/infra/mocks/discovery-service-generated");
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe("test fetchValues function", () => {
  it("with project value", () => {
    const result = fetchValues({
      project: "test"
    });
    expect(result).toBe("test");
  });
  it("without project value", () => {
    const result = fetchValues({
      project: undefined
    });
    expect(result).toBe(process.cwd());
  });
});

describe("fetch execute function", () => {
  it("negative time, expected exit code to be 1", async () => {
    const exitFn = jest.fn();
    await execute(
      {
        project: "test"
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
    jest
      .spyOn(generate, "validateRemoteSource")
      .mockReturnValueOnce(Promise.resolve());
    jest.spyOn(generate, "validateTemplateSources").mockReturnValueOnce({});
    jest
      .spyOn(generate, "generateConfig")
      .mockReturnValueOnce(Promise.resolve());

    const exitFn = jest.fn();
    await execute(
      {
        project: "test"
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
      .spyOn(infraCommon, "repoCloneRegex")
      .mockReturnValueOnce(Promise.resolve("sourceFolder"));
    jest
      .spyOn(generate, "checkRemoteGitExist")
      .mockReturnValueOnce(Promise.resolve());
    jest.spyOn(generate, "gitClone").mockReturnValueOnce(Promise.resolve());
    jest.spyOn(generate, "gitCheckout").mockReturnValueOnce(Promise.resolve());

    await validateRemoteSource({
      source: "source",
      version: "0.1"
    });
  });
  it("positive test: with Error refusing to merge unrelated histories", async () => {
    jest
      .spyOn(infraCommon, "repoCloneRegex")
      .mockReturnValueOnce(Promise.resolve("sourceFolder"));
    jest
      .spyOn(generate, "checkRemoteGitExist")
      .mockReturnValueOnce(Promise.resolve());
    jest
      .spyOn(generate, "gitClone")
      .mockReturnValueOnce(
        Promise.reject(new Error("refusing to merge unrelated histories"))
      );
    jest
      .spyOn(generate, "retryRemoteValidate")
      .mockReturnValueOnce(Promise.resolve());

    await validateRemoteSource({
      source: "source",
      version: "0.1"
    });
  });
  it("positive test: with Error Authentication failed", async () => {
    jest
      .spyOn(infraCommon, "repoCloneRegex")
      .mockReturnValueOnce(Promise.resolve("sourceFolder"));
    jest
      .spyOn(generate, "checkRemoteGitExist")
      .mockReturnValueOnce(Promise.resolve());
    jest
      .spyOn(generate, "gitClone")
      .mockReturnValueOnce(Promise.reject(new Error("Authentication failed")));
    jest
      .spyOn(generate, "retryRemoteValidate")
      .mockReturnValueOnce(Promise.resolve());

    await validateRemoteSource({
      source: "source",
      version: "0.1"
    });
  });
  it("negative test: with unknown Error", async () => {
    jest
      .spyOn(infraCommon, "repoCloneRegex")
      .mockReturnValueOnce(Promise.resolve("sourceFolder"));
    jest
      .spyOn(generate, "checkRemoteGitExist")
      .mockReturnValueOnce(Promise.resolve());
    jest
      .spyOn(generate, "gitClone")
      .mockReturnValueOnce(Promise.reject(new Error("other error")));
    jest
      .spyOn(generate, "retryRemoteValidate")
      .mockReturnValueOnce(Promise.resolve());

    try {
      await validateRemoteSource({
        source: "source",
        version: "0.1"
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toBe(
        "Failure error thrown during retry Error: Unable to determine error from supported retry cases other error"
      );
    }
  });
});

describe("test retryRemoteValidate function", () => {
  it("positive test", async () => {
    jest.spyOn(fsExtra, "removeSync").mockReturnValueOnce();
    jest.spyOn(generate, "createGenerated").mockReturnValue();
    jest.spyOn(generate, "gitClone").mockReturnValueOnce(Promise.resolve());
    jest.spyOn(generate, "gitFetchPull").mockReturnValueOnce(Promise.resolve());
    jest.spyOn(generate, "gitCheckout").mockReturnValueOnce(Promise.resolve());
    await retryRemoteValidate("source", "sourcePath", "safeLoggingUrl", "0.1");
  });
  it("negative test", async () => {
    jest.spyOn(fsExtra, "removeSync").mockReturnValueOnce();
    jest.spyOn(generate, "createGenerated").mockReturnValue();
    jest
      .spyOn(generate, "gitClone")
      .mockReturnValueOnce(Promise.reject(new Error("error")));

    try {
      await retryRemoteValidate(
        "source",
        "sourcePath",
        "safeLoggingUrl",
        "0.1"
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeDefined();
    }
  });
});

describe("test generateTfvars function", () => {
  it("undefined as data", () => {
    expect(generateTfvars(undefined)).toEqual([]);
  });
  it("one value as data", () => {
    expect(
      generateTfvars({
        hello: "world"
      })
    ).toEqual(['hello = "world"']);
  });
  it("one key with quote as data", () => {
    expect(
      generateTfvars({
        'h"ello': "world"
      })
    ).toEqual(['h"ello = "world"']);
  });
  it("multiple values as data", () => {
    expect(
      generateTfvars({
        key1: "value1",
        key2: "value2",
        key3: "value3"
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
      custerName: "cluster1"
    };
    const result = dirIteration(undefined, leafObject);
    expect(result).toEqual(leafObject);
  });
  it("leafObject is undefined", () => {
    const parentObject = {
      custerName: "cluster1"
    };
    const result = dirIteration(parentObject, undefined);
    expect(result).toEqual(parentObject);
  });
  it("one variable test", () => {
    const parentObject = {
      custerName: "parent"
    };
    const leafObject = {
      custerName: "leaf"
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(leafObject);
  });
  it("one variable test, parentObject without the variable", () => {
    const parentObject = {};
    const leafObject = {
      custerName: "leaf"
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(leafObject);
  });
  it("one variable test, leafObject without the variable", () => {
    const parentObject = {
      custerName: "leaf"
    };
    const leafObject = {};
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(parentObject);
  });
  it("multiple variables test", () => {
    const parentObject = {
      custerName: "parent",
      variable1: "parent1",
      variable2: "parent2"
    };
    const leafObject = {
      custerName: "leaf",
      variable1: "leaf1",
      variable2: "leaf2"
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(leafObject);
  });
  it("multiple variables test, leafObject does not values", () => {
    const parentObject = {
      custerName: "parent",
      variable1: "parent1",
      variable2: "parent2"
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
      variable2: "leaf2"
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(leafObject);
  });
  it("multiple variables test, parentObject has more values", () => {
    const parentObject = {
      custerName: "parent",
      variable1: "parent1",
      variable2: "parent2",
      xextra: "xextra"
    };
    const leafObject = {
      custerName: "leaf",
      variable1: "leaf1",
      variable2: "leaf2"
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual({
      custerName: "leaf",
      variable1: "leaf1",
      variable2: "leaf2",
      xextra: "xextra"
    });
  });
  it("multiple variables test, leafObject has more values", () => {
    const parentObject = {
      custerName: "parent",
      variable1: "parent1",
      variable2: "parent2"
    };
    const leafObject = {
      custerName: "leaf",
      variable1: "leaf1",
      variable2: "leaf2",
      xextra: "xextra"
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(leafObject);
  });
});

describe("Validate sources in definition.yaml files", () => {
  test("definition.yaml of leaf override parent's variable", async () => {
    const mockParentPath = "src/commands/infra/mocks/discovery-service";
    const mockProjectPath = "src/commands/infra/mocks/discovery-service/west";
    const expectedSourceWest = {
      source: "https://github.com/yradsmikham/spk-source",
      template: "cluster/environments/azure-single-keyvault",
      version: "v0.0.2"
    };
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
      sourceData
    );
  });
  test("without parent's definition.yaml", async () => {
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
      version: "v0.0.1"
    };
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
      sourceData
    );
  });
  test("git source, template and version are missing in project path", async () => {
    const mockParentPath = "src/commands/infra/mocks/discovery-service";
    const mockProjectPath =
      "src/commands/infra/mocks/discovery-service/central";
    const expectedSourceCentral = {
      source: "https://github.com/yradsmikham/spk-source",
      template: "cluster/environments/azure-single-keyvault",
      version: "v0.0.1"
    };
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
      sourceData
    );
  });
  test("without parent's and project's definition.yaml", async () => {
    const mockParentPath = "src/commands/infra/mocks";
    try {
      validateDefinition(mockParentPath, mockParentPath);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeDefined();
    }
  });
});

const getMockedDataForGitTests = async (
  positive: boolean
): Promise<IGitTestData> => {
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
  let source = sourceConfig.source!;
  if (!positive) {
    source += "dummy";
  }

  // Converting source name to storable folder name
  const sourceFolder = await infraCommon.repoCloneRegex(source);
  const sourcePath = path.join(infraCommon.spkTemplatesPath, sourceFolder);
  const safeLoggingUrl = safeGitUrlForLogging(source);

  return {
    safeLoggingUrl,
    source,
    sourcePath
  };
};

const testCheckRemoteGitExist = async (positive: boolean) => {
  const { safeLoggingUrl, source, sourcePath } = await getMockedDataForGitTests(
    positive
  );
  if (!fs.existsSync(sourcePath)) {
    createGenerated(sourcePath);
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
  xit("negative Test", async () => {
    try {
      await testCheckRemoteGitExist(false);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});

const testGitFetchPull = async (positive: boolean) => {
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

const testGitCheckout = async (positive: boolean) => {
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
    git.clone = async () => {
      return "ok";
    };
    await gitClone(git, "source", "path");
    // no exception thrown
  });
  it("negative Test", async () => {
    const git = simpleGit();
    git.clone = async () => {
      throw new Error("Error");
    };
    try {
      await gitClone(git, "source", "path");
      expect(true).toBe(false);
    } catch (e) {
      expect(e.message).toBe("Error");
    }
  });
});

describe("Validate remote git source", () => {
  test("Validating that a git source is cloned to .spk/templates", async () => {
    jest
      .spyOn(generate, "checkRemoteGitExist")
      .mockImplementationOnce(async () => {
        return;
      });
    jest.spyOn(generate, "gitFetchPull").mockReturnValueOnce(Promise.resolve());
    jest.spyOn(generate, "gitCheckout").mockReturnValueOnce(Promise.resolve());

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

jest.spyOn(generate, "checkTfvars").mockImplementation(
  (generatedPath: string, tfvarsFilename: string): Promise<void> => {
    logger.info(`checkTfvars function mocked.`);
    return new Promise(resolve => {
      resolve();
    });
  }
);

jest
  .spyOn(generate, "writeTfvarsFile")
  .mockImplementation(
    (spkTfvars: string[], generatedPath: string, tfvarsFilename: string) => {
      logger.info(`writeTfvarsFile function mocked.`);
      return new Promise(resolve => {
        resolve();
      });
    }
  );

describe("Validate replacement of variables between parent and leaf definitions", () => {
  test("Validating that leaf definitions take precedence when generating multi-cluster definitions", async () => {
    const mockParentPath = "src/commands/infra/mocks/discovery-service";
    const mockProjectPath = "src/commands/infra/mocks/discovery-service/west";
    const finalArray = [
      'acr_enabled = "true"',
      'address_space = "<insert value>"',
      'agent_vm_count = "<insert value>"',
      'agent_vm_size = "<insert value>"',
      'cluster_name = "discovery-service-west"',
      'dns_prefix = "<insert value>"',
      'flux_recreate = "<insert value>"',
      'kubeconfig_recreate = "<insert value>"',
      'gc_enabled = "true"',
      'gitops_poll_interval = "5m"',
      'gitops_ssh_url = "<insert value>"',
      'gitops_url_branch = "master"',
      'gitops_ssh_key = "<insert value>"',
      'gitops_path = "<insert value>"',
      'keyvault_name = "<insert value>"',
      'keyvault_resource_group = "<insert value>"',
      'resource_group_name = "<insert value>"',
      'ssh_public_key = "<insert value>"',
      'service_principal_id = "<insert value>"',
      'service_principal_secret = "<insert value>"',
      'subnet_prefixes = "<insert value>"',
      'vnet_name = "<insert value>"',
      'subnet_name = "<insert value>"',
      'network_plugin = "azure"',
      'network_policy = "azure"',
      'oms_agent_enabled = "false"',
      'enable_acr = "false"',
      'acr_name = "<insert value>"'
    ];
    const parentData = readYaml<IInfraConfigYaml>(
      path.join(mockParentPath, "definition.yaml")
    );
    const parentInfraConfig: any = loadConfigurationFromLocalEnv(
      parentData || {}
    );
    const leafData = readYaml<IInfraConfigYaml>(
      path.join(mockProjectPath, "definition.yaml")
    );
    const leafInfraConfig: any = loadConfigurationFromLocalEnv(leafData || {});
    const finalDefinition = await dirIteration(
      parentInfraConfig.variables,
      leafInfraConfig.variables
    );
    const combinedSpkTfvarsObject = generateTfvars(finalDefinition);
    expect(combinedSpkTfvarsObject).toStrictEqual(finalArray);
  });
});

describe("Validate spk.tfvars file", () => {
  test("Validating that a spk.tfvars is generated and has appropriate format", async () => {
    const mockProjectPath = "src/commands/infra/mocks/discovery-service";
    const data = readYaml<IInfraConfigYaml>(
      path.join(mockProjectPath, `definition.yaml`)
    );
    const infraConfig = loadConfigurationFromLocalEnv(data);
    const spkTfvarsObject = generateTfvars(infraConfig.variables);
    expect(spkTfvarsObject).toContain('gitops_poll_interval = "5m"');
  });
});

describe("Validate backend.tfvars file", () => {
  test("Validating that a backend.tfvars is generated and has appropriate format", async () => {
    const mockProjectPath = "src/commands/infra/mocks/discovery-service";
    const data = readYaml<IInfraConfigYaml>(
      path.join(mockProjectPath, `definition.yaml`)
    );
    const infraConfig = loadConfigurationFromLocalEnv(data);
    const backendTfvarsObject = generateTfvars(infraConfig.backend);
    expect(backendTfvarsObject).toContain(
      'storage_account_name = "storage-account-name"'
    );
  });
});
