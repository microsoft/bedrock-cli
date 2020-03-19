/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import fs from "fs";
import yaml from "js-yaml";
import * as path from "path";
import { Config, loadConfiguration } from "../../config";
import * as config from "../../config";
import * as keyvault from "../../lib/azure/keyvault";
import * as storage from "../../lib/azure/storage";
import { createTempDir } from "../../lib/ioUtil";
import { deepClone } from "../../lib/util";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { AzureAccessOpts, ConfigYaml } from "../../types";
import {
  createKeyVault,
  execute,
  getStorageAccessKey,
  CommandOptions,
  onboard,
  populateValues,
  setConfiguration,
  validateAndCreateStorageAccount,
  validateStorageName,
  validateTableName,
  validateValues
} from "./onboard";
import * as onboardImpl from "./onboard";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

const MOCKED_VALUES: CommandOptions = {
  keyVaultName: "testKeyVault",
  servicePrincipalId: "servicePrincipalId",
  servicePrincipalPassword: "servicePrincipalPassword",
  storageAccountName: "testaccount",
  storageLocation: "westus",
  storageResourceGroupName: "testResourceGroup",
  storageTableName: "testtable",
  subscriptionId: "subscriptionId",
  tenantId: "tenantId"
};

const randomTmpDir = createTempDir();
const testConfigFile = path.join(randomTmpDir, "config.yaml");

const getMockedValues = (): CommandOptions => {
  return deepClone(MOCKED_VALUES);
};

const getMockedAccessOpts = (values: CommandOptions): AzureAccessOpts => {
  return {
    servicePrincipalId: values.servicePrincipalId,
    servicePrincipalPassword: values.servicePrincipalPassword,
    subscriptionId: values.subscriptionId,
    tenantId: values.tenantId
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
        key: "key"
      }
    }
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
    expect(values.keyVaultName).toBe(MOCKED_VALUES.keyVaultName);
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
        configYaml.introspection!.azure!.account_name = "AccountName";
      },
      (values: CommandOptions) => {
        values.storageAccountName = undefined;
      },
      values => {
        expect(values.storageAccountName).toBe("AccountName");
      }
    );
  });
  it("storageTableName default to config.introspection.azure.table_name", () => {
    testPopulatedVal(
      (configYaml: ConfigYaml) => {
        configYaml.introspection!.azure!.table_name = "TableName";
      },
      (values: CommandOptions) => {
        values.storageTableName = undefined;
      },
      values => {
        expect(values.storageTableName).toBe("TableName");
      }
    );
  });
  it("keyVaultName default to config.introspection.azure.key_vault_name", () => {
    testPopulatedVal(
      (configYaml: ConfigYaml) => {
        configYaml.key_vault_name = "KeyVaulteName";
      },
      (values: CommandOptions) => {
        values.keyVaultName = undefined;
      },
      values => {
        expect(values.keyVaultName).toBe("KeyVaulteName");
      }
    );
  });
  it("servicePrincipalId default to config.introspection.azure.service_principal_id", () => {
    testPopulatedVal(
      (configYaml: ConfigYaml) => {
        configYaml.introspection!.azure!.service_principal_id =
          "ServicePrincipalId";
      },
      (values: CommandOptions) => {
        values.servicePrincipalId = undefined;
      },
      values => {
        expect(values.servicePrincipalId).toBe("ServicePrincipalId");
      }
    );
  });
  it("servicePrincipalPassword default to config.introspection.azure.service_principal_secret", () => {
    testPopulatedVal(
      (configYaml: ConfigYaml) => {
        configYaml.introspection!.azure!.service_principal_secret =
          "ServicePrincipalSecret";
      },
      (values: CommandOptions) => {
        values.servicePrincipalPassword = undefined;
      },
      values => {
        expect(values.servicePrincipalPassword).toBe("ServicePrincipalSecret");
      }
    );
  });
  it("tenantId default to config.introspection.azure.tenant_id", () => {
    testPopulatedVal(
      (configYaml: ConfigYaml) => {
        configYaml.introspection!.azure!.tenant_id = "tenantId";
      },
      (values: CommandOptions) => {
        values.tenantId = undefined;
      },
      values => {
        expect(values.tenantId).toBe("tenantId");
      }
    );
  });
  it("subscriptionId default to config.introspection.azure.subscription_id", () => {
    testPopulatedVal(
      (configYaml: ConfigYaml) => {
        configYaml.introspection!.azure!.subscription_id = "subscriptionId";
      },
      (values: CommandOptions) => {
        values.subscriptionId = undefined;
      },
      values => {
        expect(values.subscriptionId).toBe("subscriptionId");
      }
    );
  });
});

describe("test validateValues function", () => {
  it("[-ve]: missing value - undefined", () => {
    const vals = getMockedValues();
    vals.servicePrincipalId = undefined;
    try {
      validateValues(vals);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
  it("[-ve]: missing value - empty string", () => {
    const vals = getMockedValues();
    vals.servicePrincipalPassword = "";
    try {
      validateValues(vals);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
  it("[-ve]: missing value - string with only spaces", () => {
    const vals = getMockedValues();
    vals.storageAccountName = " ";
    try {
      validateValues(vals);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
  it("[-ve]: invalid storageAccountName value", () => {
    const vals = getMockedValues();
    vals.storageAccountName = "#123";
    try {
      validateValues(vals);
      expect(true).toBe(false);
    } catch (e) {
      expect(e.message).toBe(
        "Storage account name must be only alphanumeric characters in lowercase and must be from 3 to 24 characters long."
      );
    }
  });
  it("[-ve]: invalid storageTableName value", () => {
    const vals = getMockedValues();
    vals.storageTableName = "# ";
    try {
      validateValues(vals);
      expect(true).toBe(false);
    } catch (e) {
      expect(e.message).toBe(
        "Table names must be only alphanumeric characters, cannot begin with a numeric character, case-insensitive, and must be from 3 to 63 characters long."
      );
    }
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
    const values = getMockedValues();
    const accessOpts = getMockedAccessOpts(values);
    await validateAndCreateStorageAccount(values, accessOpts);
  });
  it("[+ve] Positive test: storage account does exist", async () => {
    jest
      .spyOn(storage, "isStorageAccountExist")
      .mockReturnValueOnce(Promise.resolve(true));
    const values = getMockedValues();
    const accessOpts = getMockedAccessOpts(values);
    await validateAndCreateStorageAccount(values, accessOpts);
  });
});

describe("test getStorageAccessKey function", () => {
  it("already exist", async () => {
    jest
      .spyOn(storage, "getStorageAccountKey")
      .mockReturnValueOnce(Promise.resolve("key"));
    const values = getMockedValues();
    const accessOpts = getMockedAccessOpts(values);
    const storageKey = await getStorageAccessKey(values, accessOpts);
    expect(storageKey).toBe("key");
  });
});

describe("test createKeyVault function", () => {
  it("[+ve] not key vault value", async () => {
    const values = getMockedValues();
    values.keyVaultName = undefined;
    const accessOpts = getMockedAccessOpts(values);
    // nothing is done
    await createKeyVault(values, accessOpts, "accessString");
  });
  it("[+ve] with key vault value", async () => {
    jest.spyOn(keyvault, "setSecret").mockReturnValueOnce(Promise.resolve());
    const values = getMockedValues();
    const accessOpts = getMockedAccessOpts(values);
    await createKeyVault(values, accessOpts, "accessString");
  });
});

describe("onboard", () => {
  test("empty location", async () => {
    jest
      .spyOn(storage, "isStorageAccountExist")
      .mockReturnValueOnce(Promise.resolve(false));

    try {
      const values = getMockedValues();
      values.storageLocation = "";
      await onboard(values);
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toBe(
        "the following argument is required: \n -l / --storage-location"
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
      const values = getMockedValues();
      await onboard(values);
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toBe(
        "Storage account testaccount access keys in resource group testResourceGroup is not defined"
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
    jest
      .spyOn(onboardImpl, "createKeyVault")
      .mockReturnValueOnce(Promise.resolve());
    jest.spyOn(onboardImpl, "setConfiguration").mockReturnValueOnce(true);

    const data = {
      introspection: {
        azure: {
          account_name: "testAccount",
          table_name: "testTable"
        }
      }
    };

    fs.writeFileSync(testConfigFile, yaml.safeDump(data));
    await onboard(getMockedValues());
  });
});

describe("setConfiguration", () => {
  test("Should pass updating previous storage account and table names", async () => {
    const data = {
      introspection: {
        azure: {
          account_name: "test-storage",
          table_name: "test-table"
        }
      }
    };

    // create config file in test location
    fs.writeFileSync(testConfigFile, yaml.safeDump(data));

    // set storage and table names
    await setConfiguration(
      MOCKED_VALUES.storageAccountName!,
      MOCKED_VALUES.storageTableName!
    );
    loadConfiguration(testConfigFile);

    const { azure } = Config().introspection!;
    expect(azure!.account_name).toBe(MOCKED_VALUES.storageAccountName);
    expect(azure!.table_name).toBe(MOCKED_VALUES.storageTableName);
  });

  test("Should pass updating previous undefined storage account and table names", () => {
    const data = {
      introspection: {
        azure: {}
      }
    };

    // create config file in test location
    fs.writeFileSync(testConfigFile, yaml.safeDump(data));

    // set storage and table names
    setConfiguration(
      MOCKED_VALUES.storageAccountName!,
      MOCKED_VALUES.storageTableName!
    );
    loadConfiguration(testConfigFile);

    const { azure } = Config().introspection!;
    expect(azure!.account_name).toBe(MOCKED_VALUES.storageAccountName);
    expect(azure!.table_name).toBe(MOCKED_VALUES.storageTableName);
  });
});

describe("validateTableName", () => {
  test("Should pass with valid name", async () => {
    const isValid = await validateTableName("deployment");
    expect(isValid).toBe(true);
  });

  test("vShould fail when name starts with number", async () => {
    const isValid = await validateTableName("21deployment");
    expect(isValid).toBe(false);
  });

  test("vShould fail when name is > 63 characters", async () => {
    const isValid = await validateTableName(
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAaaaaaaaaaaaaaaa"
    );
    expect(isValid).toBe(false);
  });

  test("vShould fail when name includes special characters", async () => {
    const isValid = await validateTableName("deployment$@");
    expect(isValid).toBe(false);
  });

  test("vShould fail when name includes special characters", async () => {
    const isValid = await validateTableName("deployment$@");
    expect(isValid).toBe(false);
  });
});

describe("validateStorageName", () => {
  test("Should pass with valid name", async () => {
    const isValid = await validateStorageName("teststorage");
    expect(isValid).toBe(true);
  });

  test("Should pass with valid name", async () => {
    const isValid = await validateStorageName("12teststorage");
    expect(isValid).toBe(true);
  });

  test("Should fail with upper case letters in the name", async () => {
    const isValid = await validateStorageName("teststoragE");
    expect(isValid).toBe(false);
  });

  test("Should fail with - in the name", async () => {
    const isValid = await validateStorageName("test-storage");
    expect(isValid).toBe(false);
  });

  test("Should pass with max length name", async () => {
    const isValid = await validateStorageName("aaaaaaaaaaaaaaaaaaaaaaaa");
    logger.info(`spin1: ${isValid}`);
    expect(isValid).toBe(true);
  });

  test("Should fail with > max length name", async () => {
    const isValid = await validateStorageName("aaaaaaaaaaaaaaaaaaaaaaaaa");
    logger.info(`spin1: ${isValid}`);
    expect(isValid).toBe(false);
  });
});
