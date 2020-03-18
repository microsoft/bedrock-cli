import {
  VariableGroup,
  VariableGroupParameters
} from "azure-devops-node-api/interfaces/TaskAgentInterfaces";
import uuid from "uuid/v4";
import { readYaml } from "../../config";
import * as config from "../../config";
import * as azdoClient from "../azdoClient";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { VariableGroupData, VariableGroupDataVariable } from "../../types";
import {
  addVariableGroup,
  addVariableGroupWithKeyVaultMap,
  authorizeAccessToAllPipelines,
  buildVariablesMap,
  doAddVariableGroup
} from "./variableGroup";

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
    (readYaml as jest.Mock).mockReturnValue({});

    const data = readYaml<VariableGroupData>("");
    await expect(addVariableGroup(data)).rejects.toThrow();
  });
  test("should fail when variable group config variables are not set", async () => {
    (readYaml as jest.Mock).mockReturnValue({
      variables: undefined
    });

    const data = readYaml<VariableGroupData>("");
    await expect(addVariableGroup(data)).rejects.toThrow();
  });
  test("should pass when variable group data is set", async () => {
    (readYaml as jest.Mock).mockReturnValue({
      description: "mydesc",
      name: "myvg",
      type: "Vsts",
      variables: [
        {
          var1: {
            isSecret: true,
            value: "val1"
          }
        }
      ]
    });

    const data = readYaml<VariableGroupData>("");
    let group: VariableGroup | undefined;
    try {
      logger.info("calling add variable group with mock config");
      group = await addVariableGroup(data);
    } catch (err) {
      logger.error(err);
    }
    expect(group).toBeUndefined();
  });
});

describe("addVariableGroupWithKeyVaultMap", () => {
  test("should fail when variable group data is not set", async () => {
    (readYaml as jest.Mock).mockReturnValue({});
    const data = readYaml<VariableGroupData>("");
    let invalidGroupError: Error | undefined;
    try {
      logger.info("calling add variable group with Key Vault map");
      await addVariableGroupWithKeyVaultMap(data);
    } catch (err) {
      invalidGroupError = err;
    }
    expect(invalidGroupError).toBeDefined();
  });

  test("should fail when key vault data is not set for variable group", async () => {
    (readYaml as jest.Mock).mockReturnValue({
      description: "mydesc",
      name: "myvg",
      type: "AzureKeyVault",
      variables: [
        {
          secret1: {
            enabled: true
          }
        }
      ]
    });

    const data = readYaml<VariableGroupData>("");
    let group: VariableGroup | undefined;
    try {
      logger.info("calling addVariableGroupWithKeyVaultMap with mock config");
      group = await addVariableGroupWithKeyVaultMap(data);
    } catch (err) {
      logger.error(err);
    }
    expect(group).toBeUndefined();
  });

  test("should fail when key vault name is not set for variable group", async () => {
    (readYaml as jest.Mock).mockReturnValue({
      description: "mydesc",
      "key_vault_provider": {
        "service_endpoint": {
          name: "sename",
          "service_principal_id": "id",
          "service_principal_secret": "secret",
          "subscription_id": "id",
          "subscription_name": "subname",
          "tenant_id": "tid"
        }
      },
      name: "myvg",
      type: "AzureKeyVault",
      variables: [
        {
          secret1: {
            enabled: true
          }
        }
      ]
    });

    const data = readYaml<VariableGroupData>("");
    let group: VariableGroup | undefined;
    try {
      group = await addVariableGroupWithKeyVaultMap(data);
    } catch (err) {
      logger.error(err);
    }
    expect(group).toBeUndefined();
  });

  test("should fail when service endpoint data is not set for variable group", async () => {
    (readYaml as jest.Mock).mockReturnValue({
      description: "myvg desc",
      "key_vault_provider": {
        name: "mykv",
        "service_endpoint": {}
      },
      name: "myvg",
      variables: [
        {
          secret1: {
            enabled: true
          }
        }
      ]
    });

    const data = readYaml<VariableGroupData>("");
    let group: VariableGroup | undefined;
    try {
      group = await addVariableGroupWithKeyVaultMap(data);
    } catch (err) {
      logger.error(err);
    }
    expect(group).toBeUndefined();
  });

  test("should pass when variable group data is valid", async () => {
    (readYaml as jest.Mock).mockReturnValue({
      description: "myvg desc",
      "key_vault_provider": {
        name: "mykv",
        "service_endpoint": {
          name: "epname",
          "service_principal_id": "pricid",
          "service_principal_secret": "princsecret",
          "subscription_id": "subid",
          "subscription_name": "subname",
          "tenant_id": "tenid"
        }
      },
      name: "myvg",
      variables: [
        {
          secret1: {
            enabled: true
          }
        }
      ]
    });

    const data = readYaml<VariableGroupData>("");
    let group: VariableGroup | undefined;
    try {
      logger.info("calling add variable group with mock config");
      group = await addVariableGroupWithKeyVaultMap(data);
    } catch (err) {
      logger.error(err);
    }
    expect(group).toBeUndefined();
  });
});

describe("doAddVariableGroup", () => {
  test("should pass when variable group with vsts data is set", async () => {
    (readYaml as jest.Mock).mockReturnValue({
      description: uuid(),
      name: uuid(),
      type: "Vsts",
      variables: {
        var1: {
          isSecret: false,
          value: "val1"
        },
        var2: {
          isSecret: true,
          value: "val2"
        }
      }
    });

    const data = readYaml<VariableGroupData>("");
    const variablesMap = await buildVariablesMap(data.variables);

    // create variable group parameterts
    const params: VariableGroupParameters = {
      description: data.description,
      name: data.name,
      type: data.type,
      variables: variablesMap
    };

    let variableGroup: VariableGroup | undefined;

    try {
      variableGroup = await doAddVariableGroup(params, true);
    } catch (_) {
      // ignored
    }
    expect(variableGroup).toBeUndefined();
  });

  test("should pass when variable group with key vault data is set", async () => {
    (readYaml as jest.Mock).mockReturnValue({
      description: uuid(),
      "key_vault_data": {
        name: "mykv",
        "service_endpoint": {
          name: "epname",
          "service_principal_id": "pricid",
          "service_principal_secret": "princsecret",
          "subscription_id": "subid",
          "subscription_name": "subname",
          "tenant_id": "tenid"
        }
      },
      name: uuid(),
      type: "AzureKeyVault",
      variables: {
        var1: {
          isSecret: false,
          value: "val1"
        },
        var2: {
          isSecret: true,
          value: "val2"
        }
      }
    });

    const data = readYaml<VariableGroupData>("");
    const variablesMap = await buildVariablesMap(data.variables);

    // create variable group parameterts
    const params: VariableGroupParameters = {
      description: data.description,
      name: data.name,
      type: data.type,
      variables: variablesMap
    };

    let variableGroup: VariableGroup | undefined;

    try {
      variableGroup = await doAddVariableGroup(params, true);
    } catch (_) {
      // ignore
    }
    expect(variableGroup).toBeUndefined();
  });
});

describe("authorizeAccessToAllPipelines", () => {
  test("negative test", async () => {
    await expect(
      authorizeAccessToAllPipelines({
        id: undefined
      })
    ).rejects.toThrow();
  });
  test("should pass when valid variable group is passed", async () => {
    jest.spyOn(config, "Config").mockReturnValueOnce({
      "azure_devops": {
        project: "test"
      }
    });
    jest.spyOn(azdoClient, "getBuildApi").mockResolvedValueOnce({
      authorizeProjectResources: () => {
        return [
          {
            authorized: true
          }
        ];
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const authorized = await authorizeAccessToAllPipelines({
      id: 1,
      name: "group"
    });
    expect(authorized).toBeTruthy();
  });
  test("should fail when passing null variable group", async () => {
    await expect(authorizeAccessToAllPipelines({})).rejects.toThrow();
  });
});

describe("buildVariablesMap", () => {
  test("should create variable map with two variables", async () => {
    const variables: VariableGroupDataVariable = {
      var1: {
        isSecret: false,
        value: "val1"
      },
      var2: {
        isSecret: true,
        value: "val2"
      }
    };

    const map = await buildVariablesMap(variables);
    expect(map).toEqual(variables);
    logger.info(`map: ${JSON.stringify(map)}`);
  });

  test("should create variable map with one variable", async () => {
    const variables: VariableGroupDataVariable = {
      var1: {
        isSecret: false,
        value: "val1"
      }
    };

    const map = await buildVariablesMap(variables);
    expect(map).toEqual(variables);
  });

  test("should create empty variable map with no variables", async () => {
    const variables: VariableGroupDataVariable = {};
    const map = await buildVariablesMap(variables);
    expect(Object.keys(map).length).toBe(0);
  });

  test("should create variable map with two secrets", async () => {
    const variables: VariableGroupDataVariable = {
      secret1: {
        enabled: false
      },
      secret2: {
        enabled: true
      }
    };

    const secretsMap = await buildVariablesMap(variables);
    expect(secretsMap).toEqual(variables);
  });

  test("should create variable map with one secret", async () => {
    const variables: VariableGroupDataVariable = {
      secret1: {
        enabled: true
      }
    };

    const secretsMap = await buildVariablesMap(variables);
    expect(secretsMap).toEqual(variables);
  });

  test("should create empty variable map with no secrets", async () => {
    const variables: VariableGroupDataVariable = {};
    const secretsMap = await buildVariablesMap(variables);
    expect(Object.keys(secretsMap).length).toBe(0);
  });
});
