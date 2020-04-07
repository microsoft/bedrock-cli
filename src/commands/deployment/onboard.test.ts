import fs from "fs";
import yaml from "js-yaml";
import * as path from "path";
import { Config, loadConfiguration } from "../../config";
import * as config from "../../config";
import * as storage from "../../lib/azure/storage";
import { createTempDir } from "../../lib/ioUtil";
import { deepClone } from "../../lib/util";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger,
} from "../../logger";
import { AzureAccessOpts, ConfigYaml } from "../../types";
import {
  execute,
  getStorageAccessKey,
  CommandOptions,
  onboard,
  OnBoardConfig,
  populateValues,
  setConfiguration,
  validateAndCreateStorageAccount,
  validateValues,
} from "./onboard";
import * as onboardImpl from "./onboard";
import { getErrorMessage } from "../../lib/errorBuilder";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

const MOCKED_VALUES: CommandOptions = {
  servicePrincipalId: "servicePrincipalId",
  servicePrincipalPassword: "servicePrincipalPassword",
  storageAccountName: "testaccount",
  storageLocation: "westus",
  storageResourceGroupName: "testResourceGroup",
  storageTableName: "testtable",
  subscriptionId: "subscriptionId",
  tenantId: "tenantId",
};

const MOCKED_CONFIG: OnBoardConfig = {
  servicePrincipalId: "servicePrincipalId",
  servicePrincipalPassword: "servicePrincipalPassword",
  storageAccountName: "testaccount",
  storageLocation: "westus",
  storageResourceGroupName: "testResourceGroup",
  storageTableName: "testtable",
  subscriptionId: "subscriptionId",
  tenantId: "tenantId",
};

const randomTmpDir = createTempDir();
const testConfigFile = path.join(randomTmpDir, "config.yaml");

const getMockedValues = (): CommandOptions => {
  return deepClone(MOCKED_VALUES);
};

const getMockedConfig = (): OnBoardConfig => {
  return deepClone(MOCKED_CONFIG);
};

const getMockedAccessOpts = (values: OnBoardConfig): AzureAccessOpts => {
  return {
    servicePrincipalId: values.servicePrincipalId,
    servicePrincipalPassword: values.servicePrincipalPassword,
    subscriptionId: values.subscriptionId,
    tenantId: values.tenantId,
  };
};

jest.spyOn(config, "defaultConfigFile").mockReturnValue(testConfigFile);

jest.spyOn(logger, "info");

const testPopulatedVal = (
  configFn: (configYaml: ConfigYaml) => void,
  mockedFn: (values: CommandOptions) => void,
  verifyFn: (values: CommandOptions) => void
): void => {
  const configYaml: ConfigYaml = {
    introspection: {
      azure: {
        key: "key",
      },
    },
  };
  configFn(configYaml);
  jest.spyOn(config, "Config").mockReturnValueOnce(configYaml);
  const mocked = getMockedValues();
  mockedFn(mocked);

  const values = populateValues(mocked);
  verifyFn(values);
};

describe("test populateValues", () => {
  it("all values are set", () => {
    const values = populateValues(getMockedValues());
    expect(values.servicePrincipalId).toBe(MOCKED_VALUES.servicePrincipalId);
    expect(values.servicePrincipalPassword).toBe(
      MOCKED_VALUES.servicePrincipalPassword
    );
    expect(values.storageAccountName).toBe(MOCKED_VALUES.storageAccountName);
    expect(values.storageLocation).toBe(MOCKED_VALUES.storageLocation);
    expect(values.storageResourceGroupName).toBe(
      MOCKED_VALUES.storageResourceGroupName
    );
    expect(values.storageTableName).toBe(MOCKED_VALUES.storageTableName);
    expect(values.subscriptionId).toBe(MOCKED_VALUES.subscriptionId);
    expect(values.tenantId).toBe(MOCKED_VALUES.tenantId);
  });
  it("storageAccountName default to config.introspection.azure.account_name", () => {
    testPopulatedVal(
      (configYaml: ConfigYaml) => {
        if (configYaml.introspection && configYaml.introspection.azure) {
          configYaml.introspection.azure.account_name = "AccountName";
        }
      },
      (values: CommandOptions) => {
        values.storageAccountName = undefined;
      },
      (values) => {
        expect(values.storageAccountName).toBe("AccountName");
      }
    );
  });
  it("storageTableName default to config.introspection.azure.table_name", () => {
    testPopulatedVal(
      (configYaml: ConfigYaml) => {
        if (configYaml.introspection && configYaml.introspection.azure) {
          configYaml.introspection.azure.table_name = "TableName";
        }
      },
      (values: CommandOptions) => {
        values.storageTableName = undefined;
      },
      (values) => {
        expect(values.storageTableName).toBe("TableName");
      }
    );
  });
  it("servicePrincipalId default to config.introspection.azure.service_principal_id", () => {
    testPopulatedVal(
      (configYaml: ConfigYaml) => {
        if (configYaml.introspection && configYaml.introspection.azure) {
          configYaml.introspection.azure.service_principal_id =
            "ServicePrincipalId";
        }
      },
      (values: CommandOptions) => {
        values.servicePrincipalId = undefined;
      },
      (values) => {
        expect(values.servicePrincipalId).toBe("ServicePrincipalId");
      }
    );
  });
  it("servicePrincipalPassword default to config.introspection.azure.service_principal_secret", () => {
    testPopulatedVal(
      (configYaml: ConfigYaml) => {
        if (configYaml.introspection && configYaml.introspection.azure) {
          configYaml.introspection.azure.service_principal_secret =
            "ServicePrincipalSecret";
        }
      },
      (values: CommandOptions) => {
        values.servicePrincipalPassword = undefined;
      },
      (values) => {
        expect(values.servicePrincipalPassword).toBe("ServicePrincipalSecret");
      }
    );
  });
  it("tenantId default to config.introspection.azure.tenant_id", () => {
    testPopulatedVal(
      (configYaml: ConfigYaml) => {
        if (configYaml.introspection && configYaml.introspection.azure) {
          configYaml.introspection.azure.tenant_id = "tenantId";
        }
      },
      (values: CommandOptions) => {
        values.tenantId = undefined;
      },
      (values) => {
        expect(values.tenantId).toBe("tenantId");
      }
    );
  });
  it("subscriptionId default to config.introspection.azure.subscription_id", () => {
    testPopulatedVal(
      (configYaml: ConfigYaml) => {
        if (configYaml.introspection && configYaml.introspection.azure) {
          configYaml.introspection.azure.subscription_id = "subscriptionId";
        }
      },
      (values: CommandOptions) => {
        values.subscriptionId = undefined;
      },
      (values) => {
        expect(values.subscriptionId).toBe("subscriptionId");
      }
    );
  });
});

describe("test validateValues function", () => {
  it("[-ve]: missing value - undefined", () => {
    const vals = getMockedValues();
    vals.servicePrincipalId = undefined;
    expect(() => {
      validateValues(vals);
    }).toThrow();
  });
  it("[-ve]: missing value - empty string", () => {
    const vals = getMockedValues();
    vals.servicePrincipalPassword = "";
    expect(() => {
      validateValues(vals);
    }).toThrow();
  });
  it("[-ve]: missing value - string with only spaces", () => {
    const vals = getMockedValues();
    vals.storageAccountName = " ";
    expect(() => {
      validateValues(vals);
    }).toThrow();
  });
  it("[-ve]: invalid storageAccountName value", () => {
    const vals = getMockedValues();
    vals.storageAccountName = "#123";
    expect(() => {
      validateValues(vals);
    }).toThrow(getErrorMessage("validation-err-storage-account-name-invalid"));
  });
  it("[-ve]: invalid storageTableName value", () => {
    const vals = getMockedValues();
    vals.storageTableName = "# ";
    expect(() => {
      validateValues(vals);
    }).toThrow(
      "The value for storage table name is invalid. It has to be alphanumeric and start with an alphabet."
    );
  });
});

describe("test execute function", () => {
  it("[-ve]: onboard throw exception", async () => {
    jest
      .spyOn(onboardImpl, "onboard")
      .mockReturnValueOnce(Promise.reject("error"));
    const exitFn = jest.fn();
    await execute(getMockedValues(), exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("[+ve]: positive test", async () => {
    jest
      .spyOn(onboardImpl, "onboard")
      .mockReturnValueOnce(Promise.resolve(undefined));
    const exitFn = jest.fn();
    await execute(getMockedValues(), exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
});

describe("test validateAndCreateStorageAccount function", () => {
  it("[+ve] Positive test: storage account does not exist", async () => {
    jest
      .spyOn(storage, "isStorageAccountExist")
      .mockReturnValueOnce(Promise.resolve(false));
    jest
      .spyOn(storage, "createStorageAccount")
      .mockReturnValueOnce(Promise.resolve({ location: "test" }));
    const values = getMockedConfig();
    const accessOpts = getMockedAccessOpts(values);
    await validateAndCreateStorageAccount(values, accessOpts);
  });
  it("[+ve] Positive test: storage account does exist", async () => {
    jest
      .spyOn(storage, "isStorageAccountExist")
      .mockReturnValueOnce(Promise.resolve(true));
    const values = getMockedConfig();
    const accessOpts = getMockedAccessOpts(values);
    await validateAndCreateStorageAccount(values, accessOpts);
  });
});

describe("test getStorageAccessKey function", () => {
  it("already exist", async () => {
    jest.spyOn(storage, "getStorageAccountKey").mockResolvedValueOnce("key");
    const values = getMockedConfig();
    const accessOpts = getMockedAccessOpts(values);
    const storageKey = await getStorageAccessKey(values, accessOpts);
    expect(storageKey).toBe("key");
  });
});

describe("onboard", () => {
  test("empty location", async () => {
    jest.spyOn(storage, "isStorageAccountExist").mockResolvedValueOnce(false);

    try {
      const values = getMockedConfig();
      values.storageLocation = "";
      await onboard(values);
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toBe(
        getErrorMessage("introspect-onboard-cmd-location-missing")
      );
    }
  });

  test("no access key", async () => {
    jest
      .spyOn(storage, "getStorageAccountKey")
      .mockReturnValueOnce(Promise.resolve(undefined));
    jest
      .spyOn(onboardImpl, "validateAndCreateStorageAccount")
      .mockReturnValueOnce(Promise.resolve(undefined));

    try {
      const values = getMockedConfig();
      await onboard(values);
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toBe(
        getErrorMessage({
          errorKey: "introspect-onboard-cmd-get-storage-access-key-err",
          values: ["testaccount", "testResourceGroup"],
        })
      );
    }
  });

  it("create storage account and table", async () => {
    jest
      .spyOn(storage, "getStorageAccountKey")
      .mockReturnValueOnce(Promise.resolve("kZ83JRndk27402nB"));
    jest
      .spyOn(storage, "createTableIfNotExists")
      .mockReturnValueOnce(Promise.resolve(true));
    jest
      .spyOn(storage, "isStorageAccountExist")
      .mockReturnValueOnce(Promise.resolve(false));
    jest
      .spyOn(storage, "createStorageAccount")
      .mockReturnValueOnce(Promise.resolve({ location: "test" }));
    jest.spyOn(onboardImpl, "setConfiguration").mockReturnValueOnce(true);

    const data = {
      introspection: {
        azure: {
          account_name: "testAccount",
          table_name: "testTable",
        },
      },
    };

    fs.writeFileSync(testConfigFile, yaml.safeDump(data));
    await onboard(getMockedConfig());
  });
});

const validateStorageAccountTableInConfigYaml = (): void => {
  const conf = Config();
  expect(conf.introspection).toBeDefined();

  if (conf.introspection) {
    const azure = conf.introspection.azure;
    expect(azure).toBeDefined();

    if (azure) {
      expect(azure.account_name).toBe(MOCKED_CONFIG.storageAccountName);
      expect(azure.table_name).toBe(MOCKED_CONFIG.storageTableName);
    }
  }
};

describe("setConfiguration", () => {
  test("Should pass updating previous storage account and table names", async () => {
    const data = {
      introspection: {
        azure: {
          account_name: "test-storage",
          table_name: "test-table",
        },
      },
    };

    // create config file in test location
    fs.writeFileSync(testConfigFile, yaml.safeDump(data));

    // set storage and table names
    setConfiguration(
      MOCKED_CONFIG.storageAccountName,
      MOCKED_CONFIG.storageTableName
    );
    loadConfiguration(testConfigFile);
    validateStorageAccountTableInConfigYaml();
  });

  test("Should pass updating previous undefined storage account and table names", () => {
    const data = {
      introspection: {
        azure: {},
      },
    };

    // create config file in test location
    fs.writeFileSync(testConfigFile, yaml.safeDump(data));

    // set storage and table names
    setConfiguration(
      MOCKED_CONFIG.storageAccountName,
      MOCKED_CONFIG.storageTableName
    );
    loadConfiguration(testConfigFile);
    validateStorageAccountTableInConfigYaml();
  });
});
