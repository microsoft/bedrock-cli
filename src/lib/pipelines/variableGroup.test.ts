// Mocks
jest.mock("azure-devops-node-api");
jest.mock("../../config");
jest.mock("../azdoClient");

// Imports
import {
  VariableGroup,
  VariableGroupParameters
} from "azure-devops-node-api/interfaces/TaskAgentInterfaces";
import { ITaskAgentApi } from "azure-devops-node-api/TaskAgentApi";
import uuid from "uuid/v4";
import { Config, readYaml } from "../../config";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { IVariableGroupData } from "../../types";
import {
  addVariableGroup,
  addVariableGroupWithKeyVaultMap,
  authorizeAccessToAllPipelines,
  buildVariablesMap,
  doAddVariableGroup,
  IVariablesMap,
  TaskApi
} from "./variableGroup";

// Tests
beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("TaskApi", () => {
  test("should fail when PAT not set", async () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {}
    });

    let invalidPatError: Error | undefined;
    try {
      await TaskApi();
    } catch (err) {
      invalidPatError = err;
    }
    expect(invalidPatError).toBeDefined();
  });

  test("should fail when DevOps org is invalid", async () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {
        access_token: uuid()
      }
    });

    let invalidOrgError: Error | undefined;
    try {
      await TaskApi();
    } catch (err) {
      invalidOrgError = err;
    }
    expect(invalidOrgError).toBeDefined();
  });

  test("should pass if org url and PAT set", async () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {
        access_token: uuid(),
        org: uuid()
      }
    });

    let api: ITaskAgentApi | undefined;
    try {
      api = await TaskApi();
    } catch (err) {
      logger.info(err);
    }
    expect(api).toBeUndefined();
  });
});

describe("addVariableGroup", () => {
  test("should fail when variable group config is not set", async () => {
    (readYaml as jest.Mock).mockReturnValue({});

    const data = readYaml<IVariableGroupData>("");
    let invalidGroupError: Error | undefined;
    try {
      logger.info("calling add variable group");
      await addVariableGroup(data);
    } catch (err) {
      invalidGroupError = err;
    }
    expect(invalidGroupError).toBeDefined();
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

    const data = readYaml<IVariableGroupData>("");
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
    const data = readYaml<IVariableGroupData>("");
    let invalidGroupError: Error | undefined;
    try {
      logger.info("calling add variable group with Key Vault map");
      await addVariableGroupWithKeyVaultMap(data!);
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

    const data = readYaml<IVariableGroupData>("");
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
      key_vault_provider: {
        service_endpoint: {
          name: "sename",
          service_principal_id: "id",
          service_principal_secret: "secret",
          subscription_id: "id",
          subscription_name: "subname",
          tenant_id: "tid"
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

    const data = readYaml<IVariableGroupData>("");
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
      key_vault_provider: {
        name: "mykv",
        service_endpoint: {}
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

    const data = readYaml<IVariableGroupData>("");
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
      key_vault_provider: {
        name: "mykv",
        service_endpoint: {
          name: "epname",
          service_principal_id: "pricid",
          service_principal_secret: "princsecret",
          subscription_id: "subid",
          subscription_name: "subname",
          tenant_id: "tenid"
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

    const data = readYaml<IVariableGroupData>("");
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

    const data = readYaml<IVariableGroupData>("");
    const variablesMap = await buildVariablesMap(data.variables);

    // create variable group parameterts
    const params: VariableGroupParameters = {
      description: data.description,
      name: data.name,
      type: data.type,
      variables: variablesMap
    };

    let variableGroup: VariableGroup | undefined;
    let error: Error | undefined;
    try {
      variableGroup = await doAddVariableGroup(params, true);
    } catch (err) {
      error = err;
    }
    expect(variableGroup).toBeUndefined();
  });

  test("should pass when variable group with key vault data is set", async () => {
    (readYaml as jest.Mock).mockReturnValue({
      description: uuid(),
      key_vault_data: {
        name: "mykv",
        service_endpoint: {
          name: "epname",
          service_principal_id: "pricid",
          service_principal_secret: "princsecret",
          subscription_id: "subid",
          subscription_name: "subname",
          tenant_id: "tenid"
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

    const data = readYaml<IVariableGroupData>("");
    const variablesMap = await buildVariablesMap(data.variables);

    // create variable group parameterts
    const params: VariableGroupParameters = {
      description: data.description,
      name: data.name,
      type: data.type,
      variables: variablesMap
    };

    let variableGroup: VariableGroup | undefined;
    let error: Error | undefined;
    try {
      variableGroup = await doAddVariableGroup(params, true);
    } catch (err) {
      error = err;
    }
    expect(variableGroup).toBeUndefined();
  });
});

describe("authorizeAccessToAllPipelines", () => {
  test("should pass when valid variable group is passed", async () => {
    (readYaml as jest.Mock).mockReturnValue({
      description: uuid(),
      name: uuid(),
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

    const data = readYaml<IVariableGroupData>("");
    const variablesMap = await buildVariablesMap(data.variables);

    // create variable group parameterts
    const variableGroup: VariableGroup = {
      description: data.description,
      name: data.name,
      type: data.type,
      variables: variablesMap
    };

    let authorized: boolean | undefined;
    let error: Error | undefined;
    try {
      authorized = await authorizeAccessToAllPipelines(variableGroup);
    } catch (err) {
      error = err;
    }
    expect(authorized).toBeUndefined();
  });

  test("should fail when passing null variable group", async () => {
    // create variable group parameterts
    const variableGroup: VariableGroup | undefined = {};

    let error: Error | undefined;
    try {
      await authorizeAccessToAllPipelines(variableGroup);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
  });
});

describe("buildVariablesMap", () => {
  test("should create variable map with two variables", async () => {
    const var1: IVariablesMap = {
      var1: {
        isSecret: false,
        value: "val1"
      }
    };
    const var2: IVariablesMap = {
      var2: {
        isSecret: true,
        value: "val2"
      }
    };

    const variables: IVariablesMap[] = [];
    variables.push(var1);
    variables.push(var2);

    let map: IVariablesMap | undefined;
    const expectedMap: any = `{"0":{"var1":{"isSecret":false,"value":"val1"}},"1":{"var2":{"isSecret":true,"value":"val2"}}}`;
    map = await buildVariablesMap(variables);
    expect(JSON.stringify(map)).toEqual(expectedMap);
    logger.info(`map: ${JSON.stringify(map)}`);
  });

  test("should create variable map with one variable", async () => {
    const var1: IVariablesMap = {
      var1: {
        isSecret: false,
        value: "val1"
      }
    };

    const variables: IVariablesMap[] = [];
    variables.push(var1);

    let map: IVariablesMap | undefined;
    const expectedMap: any = `{"0":{"var1":{"isSecret":false,"value":"val1"}}}`;
    map = await buildVariablesMap(variables);
    expect(JSON.stringify(map)).toEqual(expectedMap);
  });

  test("should create empty variable map with no variables", async () => {
    const variables: IVariablesMap[] = [];
    let map: IVariablesMap | undefined;
    const expectedMap: any = `{}`;
    map = await buildVariablesMap(variables);
    expect(JSON.stringify(map)).toEqual(expectedMap);
  });

  test("should create variable map with two secrets", async () => {
    const var1: IVariablesMap = {
      secret1: {
        enabled: false
      }
    };
    const var2: IVariablesMap = {
      secret2: {
        enabled: true
      }
    };

    const variables: IVariablesMap[] = [];
    variables.push(var1);
    variables.push(var2);

    let secretsMap: IVariablesMap | undefined;
    const expectedMap: any = `{"0":{"secret1":{"enabled":false}},"1":{"secret2":{"enabled":true}}}`;
    secretsMap = await buildVariablesMap(variables);
    expect(JSON.stringify(secretsMap)).toEqual(expectedMap);
  });

  test("should create variable map with one secret", async () => {
    const var1: IVariablesMap = {
      secret1: {
        enabled: true
      }
    };

    const variables: IVariablesMap[] = [];
    variables.push(var1);
    let secretsMap: IVariablesMap | undefined;
    const expectedMap: any = `{"0":{"secret1":{"enabled":true}}}`;
    secretsMap = await buildVariablesMap(variables);
    expect(JSON.stringify(secretsMap)).toEqual(expectedMap);
  });

  test("should create empty variable map with no secrets", async () => {
    const variables: IVariablesMap[] = [];
    let secretsMap: IVariablesMap | undefined;
    const expectedMap: any = `{}`;
    secretsMap = await buildVariablesMap(variables);
    expect(JSON.stringify(secretsMap)).toEqual(expectedMap);
  });
});
