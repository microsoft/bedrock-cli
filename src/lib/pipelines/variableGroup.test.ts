import { VariableGroupParameters } from "azure-devops-node-api/interfaces/TaskAgentInterfaces";
import uuid from "uuid/v4";
import * as azdoClient from "../azdoClient";
import { readYaml } from "../../config";
import * as config from "../../config";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { VariableGroupData, VariableGroupDataVariable } from "../../types";
import {
  addVariableGroup,
  addVariableGroupWithKeyVaultMap,
  authorizeAccessToAllPipelines,
  buildVariablesMap,
  deleteVariableGroup,
  doAddVariableGroup,
} from "./variableGroup";
import * as variableGroup from "./variableGroup";
import * as serviceEndpoint from "./serviceEndpoint";

// Mocks
jest.mock("azure-devops-node-api");
jest.mock("../../config");
jest.mock("../azdoClient");

// Tests
beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("addVariableGroup", () => {
  test("should fail when variable group config is not set", async () => {
    (readYaml as jest.Mock).mockReturnValueOnce({});

    const data = readYaml<VariableGroupData>("");
    await expect(addVariableGroup(data)).rejects.toThrow();
  });
  test("should fail when variable group config variables are not set", async () => {
    (readYaml as jest.Mock).mockReturnValueOnce({
      variables: undefined,
    });

    const data = readYaml<VariableGroupData>("");
    await expect(addVariableGroup(data)).rejects.toThrow();
  });
  it("should pass when variable group data is set", async () => {
    (readYaml as jest.Mock).mockReturnValueOnce({
      description: "mydesc",
      name: "myvg",
      type: "Vsts",
      variables: [
        {
          var1: {
            isSecret: true,
            value: "val1",
          },
        },
      ],
    });
    const data = readYaml<VariableGroupData>("");
    jest.spyOn(variableGroup, "doAddVariableGroup").mockResolvedValueOnce({});
    const group = await addVariableGroup(data);
    expect(group).toBeDefined();
  });
});

describe("addVariableGroupWithKeyVaultMap", () => {
  test("should fail when variable group data is not set", async () => {
    (readYaml as jest.Mock).mockReturnValueOnce({});
    const data = readYaml<VariableGroupData>("");
    await expect(addVariableGroupWithKeyVaultMap(data)).rejects.toThrow();
  });
  test("should fail when key vault data is not set for variable group", async () => {
    (readYaml as jest.Mock).mockReturnValueOnce({
      description: "mydesc",
      name: "myvg",
      type: "AzureKeyVault",
      variables: [
        {
          secret1: {
            enabled: true,
          },
        },
      ],
    });
    const data = readYaml<VariableGroupData>("");
    await expect(addVariableGroupWithKeyVaultMap(data)).rejects.toThrow();
  });
  test("should fail when key vault name is not set for variable group", async () => {
    (readYaml as jest.Mock).mockReturnValueOnce({
      description: "mydesc",
      key_vault_provider: {
        service_endpoint: {
          name: "sename",
          service_principal_id: "id",
          service_principal_secret: "secret",
          subscription_id: "id",
          subscription_name: "subname",
          tenant_id: "tid",
        },
      },
      name: "myvg",
      type: "AzureKeyVault",
      variables: [
        {
          secret1: {
            enabled: true,
          },
        },
      ],
    });

    const data = readYaml<VariableGroupData>("");
    await expect(addVariableGroupWithKeyVaultMap(data)).rejects.toThrow();
  });
  test("should fail when service endpoint data is not set for variable group", async () => {
    (readYaml as jest.Mock).mockReturnValueOnce({
      description: "myvg desc",
      key_vault_provider: {
        name: "mykv",
        service_endpoint: {},
      },
      name: "myvg",
      variables: [
        {
          secret1: {
            enabled: true,
          },
        },
      ],
    });
    const data = readYaml<VariableGroupData>("");
    await expect(addVariableGroupWithKeyVaultMap(data)).rejects.toThrow();
  });
  test("should pass when variable group data is valid", async () => {
    (readYaml as jest.Mock).mockReturnValueOnce({
      description: "myvg desc",
      key_vault_provider: {
        name: "mykv",
        service_endpoint: {
          name: "epname",
          service_principal_id: "pricid",
          service_principal_secret: "princsecret",
          subscription_id: "subid",
          subscription_name: "subname",
          tenant_id: "tenid",
        },
      },
      name: "myvg",
      variables: [
        {
          secret1: {
            enabled: true,
          },
        },
      ],
    });

    const data = readYaml<VariableGroupData>("");
    jest
      .spyOn(serviceEndpoint, "createServiceEndpointIfNotExists")
      .mockResolvedValueOnce({
        id: "test",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    jest.spyOn(variableGroup, "doAddVariableGroup").mockResolvedValueOnce({});
    const group = await addVariableGroupWithKeyVaultMap(data);
    expect(group).toBeDefined();
  });
});

const mockForDoAddVariableGroupTest = (): void => {
  jest.spyOn(config, "Config").mockReturnValueOnce({
    azure_devops: {
      project: "project",
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  jest.spyOn(azdoClient, "getTaskAgentApi").mockResolvedValueOnce({
    addVariableGroup: () => {
      return {
        id: "test",
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  jest
    .spyOn(variableGroup, "authorizeAccessToAllPipelines")
    .mockResolvedValueOnce(true);
};

describe("doAddVariableGroup", () => {
  test("negative test: project is not provided", async () => {
    jest.spyOn(config, "Config").mockReturnValueOnce({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // project is not in config.yaml
    await expect(doAddVariableGroup({}, true)).rejects.toThrow();
  });
  test("should pass when variable group with vsts data is set", async () => {
    mockForDoAddVariableGroupTest();
    (readYaml as jest.Mock).mockReturnValueOnce({
      description: uuid(),
      name: uuid(),
      type: "Vsts",
      variables: {
        var1: {
          isSecret: false,
          value: "val1",
        },
        var2: {
          isSecret: true,
          value: "val2",
        },
      },
    });

    const data = readYaml<VariableGroupData>("");
    const variablesMap = buildVariablesMap(data.variables);

    // create variable group parameterts
    const params: VariableGroupParameters = {
      description: data.description,
      name: data.name,
      type: data.type,
      variables: variablesMap,
    };

    const group = await doAddVariableGroup(params, true);
    expect(group).toBeDefined();
  });
  test("should pass when variable group with key vault data is set", async () => {
    mockForDoAddVariableGroupTest();
    (readYaml as jest.Mock).mockReturnValueOnce({
      description: uuid(),
      key_vault_data: {
        name: "mykv",
        service_endpoint: {
          name: "epname",
          service_principal_id: "pricid",
          service_principal_secret: "princsecret",
          subscription_id: "subid",
          subscription_name: "subname",
          tenant_id: "tenid",
        },
      },
      name: uuid(),
      type: "AzureKeyVault",
      variables: {
        var1: {
          isSecret: false,
          value: "val1",
        },
        var2: {
          isSecret: true,
          value: "val2",
        },
      },
    });

    const data = readYaml<VariableGroupData>("");

    // create variable group parameterts
    const params: VariableGroupParameters = {
      description: data.description,
      name: data.name,
      type: data.type,
      variables: buildVariablesMap(data.variables),
    };

    const group = await doAddVariableGroup(params, true);
    expect(group).toBeDefined();
  });
});

describe("authorizeAccessToAllPipelines", () => {
  test("negative test", async () => {
    await expect(
      authorizeAccessToAllPipelines({
        id: undefined,
      })
    ).rejects.toThrow();
  });
  test("should pass when valid variable group is passed", async () => {
    jest.spyOn(config, "Config").mockReturnValueOnce({
      azure_devops: {
        project: "test",
      },
    });
    jest.spyOn(azdoClient, "getBuildApi").mockResolvedValueOnce({
      authorizeProjectResources: () => {
        return [
          {
            authorized: true,
          },
        ];
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const authorized = await authorizeAccessToAllPipelines({
      id: 1,
      name: "group",
    });
    expect(authorized).toBeTruthy();
  });
  test("should fail when passing null variable group", async () => {
    await expect(authorizeAccessToAllPipelines({})).rejects.toThrow();
  });
  test("should fail when project is missing", async () => {
    await expect(
      authorizeAccessToAllPipelines({
        id: 1,
        name: "group",
      })
    ).rejects.toThrow();
  });
});

describe("buildVariablesMap", () => {
  test("should create variable map with two variables", async () => {
    const variables: VariableGroupDataVariable = {
      var1: {
        isSecret: false,
        value: "val1",
      },
      var2: {
        isSecret: true,
        value: "val2",
      },
    };

    const map = buildVariablesMap(variables);
    expect(map).toEqual(variables);
  });

  test("should create variable map with one variable", async () => {
    const variables: VariableGroupDataVariable = {
      var1: {
        isSecret: false,
        value: "val1",
      },
    };

    const map = buildVariablesMap(variables);
    expect(map).toEqual(variables);
  });

  test("should create empty variable map with no variables", async () => {
    const variables: VariableGroupDataVariable = {};
    const map = buildVariablesMap(variables);
    expect(Object.keys(map).length).toBe(0);
  });

  test("should create variable map with two secrets", async () => {
    const variables: VariableGroupDataVariable = {
      secret1: {
        enabled: false,
      },
      secret2: {
        enabled: true,
      },
    };

    const secretsMap = buildVariablesMap(variables);
    expect(secretsMap).toEqual(variables);
  });

  test("should create variable map with one secret", async () => {
    const variables: VariableGroupDataVariable = {
      secret1: {
        enabled: true,
      },
    };

    const secretsMap = buildVariablesMap(variables);
    expect(secretsMap).toEqual(variables);
  });

  test("should create empty variable map with no secrets", async () => {
    const secretsMap = buildVariablesMap({});
    expect(Object.keys(secretsMap).length).toBe(0);
  });
});

describe("test deleteVariableGroup function", () => {
  it("positive test: group found", async () => {
    const delFn = jest.fn();
    jest.spyOn(azdoClient, "getTaskAgentApi").mockResolvedValueOnce({
      deleteVariableGroup: delFn,
      getVariableGroups: () => [
        {
          id: "test",
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const deleted = await deleteVariableGroup({}, "test");
    expect(delFn).toBeCalledTimes(1);
    expect(deleted).toBeTruthy();
  });
  it("positive test: no matching groups found", async () => {
    const delFn = jest.fn();
    jest.spyOn(azdoClient, "getTaskAgentApi").mockResolvedValueOnce({
      deleteVariableGroup: delFn,
      getVariableGroups: () => [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const deleted = await deleteVariableGroup({}, "test");
    expect(delFn).toBeCalledTimes(0);
    expect(deleted).toBeFalsy();
  });
});
