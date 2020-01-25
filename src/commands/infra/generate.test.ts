import path from "path";
import { loadConfigurationFromLocalEnv, readYaml } from "../../config";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { IInfraConfigYaml } from "../../types";
import {
  dirIteration,
  generateConfig,
  generateTfvars,
  validateDefinition,
  validateRemoteSource,
  validateTemplateSources
} from "./generate";
import * as generate from "./generate";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("test dirIteration", () => {
  it("parentObject and leafObject are undefined", () => {
    const result = dirIteration(undefined, undefined);
    expect(result).toEqual({});
  });
  it("parentObject is undefined", () => {
    const leafObject = {
      "custerName": "cluster1"
    };
    const result = dirIteration(undefined, leafObject);
    expect(result).toEqual(leafObject);
  });
  it("leafObject is undefined", () => {
    const parentObject = {
      "custerName": "cluster1"
    };
    const result = dirIteration(parentObject, undefined);
    expect(result).toEqual(parentObject);
  });
  it("one variable test", () => {
    const parentObject = {
      "custerName": "parent"
    };
    const leafObject = {
      "custerName": "left"
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(leafObject);
  });
  it("one variable test, parentObject without the variable", () => {
    const parentObject = {
    };
    const leafObject = {
      "custerName": "leaf"
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(leafObject);
  });
  it("one variable test, leafObject without the variable", () => {
    const parentObject = {
      "custerName": "leaf"
    };
    const leafObject = {
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(parentObject);
  });
  it("multiple variables test", () => {
    const parentObject = {
      "custerName": "parent",
      "variable1": "parent1",
      "variable2": "parent2"
    };
    const leafObject = {
      "custerName": "leaf",
      "variable1": "leaf1",
      "variable2": "leaf2"
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(leafObject);
  });
  it("multiple variables test, leafObject does not values", () => {
    const parentObject = {
      "custerName": "parent",
      "variable1": "parent1",
      "variable2": "parent2"
    };
    const leafObject = {
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(parentObject);
  });
  it("multiple variables test, parentObject does not values", () => {
    const parentObject = {
    };
    const leafObject = {
      "custerName": "leaf",
      "variable1": "leaf1",
      "variable2": "leaf2"
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(leafObject);
  });
  it("multiple variables test, parentObject has more values", () => {
    const parentObject = {
      "custerName": "parent",
      "variable1": "parent1",
      "variable2": "parent2",
      "xextra": "xextra"
    };
    const leafObject = {
      "custerName": "leaf",
      "variable1": "leaf1",
      "variable2": "leaf2"
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual({
      "custerName": "leaf",
      "variable1": "leaf1",
      "variable2": "leaf2",
      "xextra": "xextra"
    });
  });
  it("multiple variables test, leafObject has more values", () => {
    const parentObject = {
      "custerName": "parent",
      "variable1": "parent1",
      "variable2": "parent2"
    };
    const leafObject = {
      "custerName": "leaf",
      "variable1": "leaf1",
      "variable2": "leaf2",
      "xextra": "xextra"
    };
    const result = dirIteration(parentObject, leafObject);
    expect(result).toEqual(leafObject);
  });
})

describe("Validate sources in definition.yaml files", () => {
  test("Validating that a provided project folder contains definition.yaml files with valid source, version, and template", async () => {
    let mockParentPath = "src/commands/infra/mocks/discovery-service";
    let mockProjectPath = "src/commands/infra/mocks/discovery-service/west";
    const expectedArrayWest = [
      "A",
      "https://github.com/yradsmikham/spk-source",
      "cluster/environments/azure-single-keyvault",
      "v0.0.2"
    ];
    let sourceConfiguration = await validateDefinition(
      mockParentPath,
      mockProjectPath
    );
    let returnArray = await validateTemplateSources(
      sourceConfiguration,
      path.join(mockParentPath, `definition.yaml`),
      path.join(mockProjectPath, `definition.yaml`)
    );
    expect(returnArray).toEqual(expectedArrayWest);
    await generateConfig(mockParentPath, mockProjectPath, returnArray);

    mockProjectPath = "src/commands/infra/mocks/discovery-service/east";
    const expectedArrayEast = [
      "B",
      "https://github.com/yradsmikham/spk-source",
      "cluster/environments/azure-single-keyvault",
      "v0.0.1"
    ];
    sourceConfiguration = await validateDefinition(
      mockParentPath,
      mockProjectPath
    );
    returnArray = await validateTemplateSources(
      sourceConfiguration,
      path.join(mockParentPath, `definition.yaml`),
      path.join(mockProjectPath, `definition.yaml`)
    );

    expect(returnArray).toEqual(expectedArrayEast);
    await generateConfig(mockParentPath, mockProjectPath, returnArray);

    mockProjectPath = "src/commands/infra/mocks/discovery-service/central";
    const expectedArrayCentral = [
      "A",
      "https://github.com/yradsmikham/spk-source",
      "cluster/environments/azure-single-keyvault",
      "v0.0.1"
    ];
    sourceConfiguration = await validateDefinition(
      mockParentPath,
      mockProjectPath
    );
    returnArray = await validateTemplateSources(
      sourceConfiguration,
      path.join(mockParentPath, `definition.yaml`),
      path.join(mockProjectPath, `definition.yaml`)
    );

    expect(returnArray).toEqual(expectedArrayCentral);
    await generateConfig(mockParentPath, mockProjectPath, returnArray);

    mockParentPath = "src/commands/infra/mocks";
    sourceConfiguration = await validateDefinition(
      mockParentPath,
      mockParentPath
    );

    expect(sourceConfiguration).toEqual("");
  });
});

describe("Validate remote git source", () => {
  test("Validating that a git source is cloned to .spk/templates", async () => {
    const mockParentPath = "src/commands/infra/mocks/discovery-service";
    const mockProjectPath = "src/commands/infra/mocks/discovery-service/west";
    const sourceConfiguration = await validateDefinition(
      mockParentPath,
      mockProjectPath
    );
    const sourceArray = await validateTemplateSources(
      sourceConfiguration,
      path.join(mockParentPath, `definition.yaml`),
      path.join(mockProjectPath, `definition.yaml`)
    );
    const sourceBoolean = await validateRemoteSource(sourceArray);
    expect(sourceBoolean).toBe(false);
  });
});

jest.spyOn(generate, "gitClone").mockImplementation(
  (source: string, sourcePath: string): Promise<void> => {
    logger.info(`gitClone function mocked.`);
    return new Promise(resolve => {
      resolve();
    });
  }
);

jest.spyOn(generate, "createGenerated").mockImplementation(
  (projectPath: string): Promise<string> => {
    logger.info(`createGenerated function mocked.`);
    return new Promise(resolve => {
      resolve();
    });
  }
);

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
    const combinedSpkTfvarsObject = await generateTfvars(finalDefinition);
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
    const spkTfvarsObject = await generateTfvars(infraConfig.variables);
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
    const backendTfvarsObject = await generateTfvars(infraConfig.backend);
    expect(backendTfvarsObject).toContain(
      'storage_account_name = "storage-account-name"'
    );
  });
});
