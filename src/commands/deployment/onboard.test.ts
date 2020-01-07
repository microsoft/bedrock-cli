// imports
import fs from "fs";
import yaml from "js-yaml";
import os from "os";
import * as path from "path";
import uuid from "uuid/v4";
import { Config, loadConfiguration } from "../../config";
import * as config from "../../config";
import * as keyvault from "../../lib/azure/keyvault";
import * as storage from "../../lib/azure/storage";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { IAzureAccessOpts } from "../../types";
import {
  onboard,
  setConfiguration,
  validateRequiredArguments,
  validateStorageName,
  validateTableName
} from "./onboard";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

const storageAccountName = "teststorage";
const storageTableName = "testtable";
const storageResourceGroup = uuid();
const accessOpts: IAzureAccessOpts = {
  servicePrincipalId: uuid(),
  servicePrincipalPassword: uuid(),
  subscriptionId: uuid(),
  tenantId: uuid()
};

const randomTmpDir = path.join(os.tmpdir(), uuid());
fs.mkdirSync(randomTmpDir);
const testConfigFile = path.join(randomTmpDir, "config.yaml");

jest.spyOn(config, "defaultConfigFile").mockImplementation((): string => {
  return testConfigFile;
});

jest.spyOn(storage, "isStorageAccountExist").mockImplementation(
  async (): Promise<any> => {
    return false;
  }
);

jest.spyOn(storage, "createStorageAccount").mockImplementation(
  async (): Promise<any> => {
    return {
      location: "westus",
      name: "testAccount"
    };
  }
);

jest.spyOn(keyvault, "setSecret").mockImplementation(
  async (): Promise<any> => {
    return true;
  }
);

jest.spyOn(logger, "info");

describe("onboard", () => {
  test("empty location", async () => {
    jest.spyOn(storage, "isStorageAccountExist").mockImplementationOnce(
      async (): Promise<any> => {
        return false;
      }
    );

    let hasError = false;
    try {
      await onboard(
        "testAccount",
        "testTable",
        "testResourceGroup",
        "",
        "testKeyVault"
      );
    } catch (err) {
      hasError = true;
      expect(err.message).toBe(
        "the following argument is required: \n -l / --storage-location"
      );
    }

    expect(hasError).toBe(true);
  });

  test("no access key", async () => {
    jest.spyOn(storage, "getStorageAccountKey").mockImplementationOnce(
      async (): Promise<any> => {
        return undefined;
      }
    );

    let hasError = false;
    try {
      await onboard(
        "testAccount",
        "testTable",
        "testResourceGroup",
        "westus",
        "testKeyVault"
      );
    } catch (err) {
      hasError = true;
      expect(err.message).toBe(
        "Storage account testAccount access keys in resource group testResourceGroup is not defined"
      );
    }

    expect(hasError).toBe(true);
  });

  test("create storage account", async () => {
    jest.spyOn(storage, "getStorageAccountKey").mockImplementationOnce(
      async (): Promise<any> => {
        return "kZ83JRndk27402nB";
      }
    );

    jest.spyOn(storage, "createTableIfNotExists").mockImplementationOnce(
      async (): Promise<boolean> => {
        return true;
      }
    );

    // Setup test configuration file
    let hasError = false;
    try {
      const data = {
        introspection: {
          azure: {
            account_name: "testAccount",
            table_name: "testTable"
          }
        }
      };

      fs.writeFileSync(testConfigFile, yaml.safeDump(data));
      await onboard(
        "testAccount",
        "testTable",
        "testResourceGroup",
        "westus",
        "testKeyVault"
      );
    } catch (err) {
      hasError = true;
    }

    expect(hasError).toBe(false);
  });
});

describe("validateRequiredArguments", () => {
  test("Should fail when all required arguments specified with empty values", async () => {
    const opts: IAzureAccessOpts = {};

    const errors: string[] = await validateRequiredArguments("", "", "", opts);
    logger.info(`length: ${errors.length}`);
    expect(errors.length).toBe(7);
  });

  test("Should fail when all required arguments specified with undefined values", async () => {
    const opts: IAzureAccessOpts = {};

    const errors: string[] = await validateRequiredArguments(
      undefined,
      undefined,
      undefined,
      opts
    );
    logger.info(`length: ${errors.length}`);
    expect(errors.length).toBe(7);
  });

  test("Should fail when storageAccountName specified with undefined values", async () => {
    const errors: string[] = await validateRequiredArguments(
      undefined,
      storageTableName,
      storageResourceGroup,
      accessOpts
    );
    logger.info(`length: ${errors.length}`);
    expect(errors.length).toBe(1);
  });

  test("Should fail when storageTableName specified with undefined values", async () => {
    const errors: string[] = await validateRequiredArguments(
      storageAccountName,
      undefined,
      storageResourceGroup,
      accessOpts
    );
    logger.info(`length: ${errors.length}`);
    expect(errors.length).toBe(1);
  });

  test("Should fail when storageResourceGroup specified with undefined values", async () => {
    const errors: string[] = await validateRequiredArguments(
      storageAccountName,
      storageTableName,
      undefined,
      accessOpts
    );
    logger.info(`length: ${errors.length}`);
    expect(errors.length).toBe(1);
  });

  test("Should fail when servicePrincipalId specified with undefined values", async () => {
    const opts: IAzureAccessOpts = {
      servicePrincipalId: undefined,
      servicePrincipalPassword: uuid(),
      subscriptionId: uuid(),
      tenantId: uuid()
    };
    const errors: string[] = await validateRequiredArguments(
      storageAccountName,
      storageTableName,
      storageResourceGroup,
      opts
    );
    logger.info(`length: ${errors.length}`);
    expect(errors.length).toBe(1);
  });

  test("Should fail when servicePrincipalPassword specified with undefined values", async () => {
    const opts: IAzureAccessOpts = {
      servicePrincipalId: uuid(),
      servicePrincipalPassword: undefined,
      subscriptionId: uuid(),
      tenantId: uuid()
    };
    const errors: string[] = await validateRequiredArguments(
      storageAccountName,
      storageTableName,
      storageResourceGroup,
      opts
    );
    logger.info(`length: ${errors.length}`);
    expect(errors.length).toBe(1);
  });

  test("Should fail when subscriptionId specified with undefined values", async () => {
    const opts: IAzureAccessOpts = {
      servicePrincipalId: uuid(),
      servicePrincipalPassword: uuid(),
      subscriptionId: undefined,
      tenantId: uuid()
    };
    const errors: string[] = await validateRequiredArguments(
      storageAccountName,
      storageTableName,
      storageResourceGroup,
      opts
    );
    logger.info(`length: ${errors.length}`);
    expect(errors.length).toBe(1);
  });

  test("Should fail when tenantId specified with undefined values", async () => {
    const opts: IAzureAccessOpts = {
      servicePrincipalId: uuid(),
      servicePrincipalPassword: uuid(),
      subscriptionId: uuid(),
      tenantId: undefined
    };
    const errors: string[] = await validateRequiredArguments(
      storageAccountName,
      storageTableName,
      storageResourceGroup,
      opts
    );
    logger.info(`length: ${errors.length}`);
    expect(errors.length).toBe(1);
  });
});

describe("setConfiguration", () => {
  test("Should pass updating previous storage account and table names", async () => {
    try {
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

      logger.info(`testConfigFile: ${testConfigFile}`);

      // set storage and table names
      await setConfiguration(storageAccountName, storageTableName);
      loadConfiguration(testConfigFile);

      const { azure } = Config().introspection!;
      expect(azure!.account_name).toBe(storageAccountName);
      expect(azure!.table_name).toBe(storageTableName);
    } catch (err) {
      logger.error(`dirs error: ${err}`);
    }
  });

  test("Should pass updating previous undefined storage account and table names", async () => {
    try {
      const data = {
        introspection: {
          azure: {
            account_name: undefined,
            table_name: undefined
          }
        }
      };

      // create config file in test location
      fs.writeFileSync(testConfigFile, yaml.safeDump(data));

      logger.info(`testConfigFile: ${testConfigFile}`);

      // set storage and table names
      await setConfiguration(storageAccountName, storageTableName);
      loadConfiguration(testConfigFile);

      const { azure } = Config().introspection!;
      expect(azure!.account_name).toBe(storageAccountName);
      expect(azure!.table_name).toBe(storageTableName);
    } catch (err) {
      logger.error(`dirs error: ${err}`);
    }
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
