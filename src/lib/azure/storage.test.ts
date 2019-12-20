// Mocks
jest.mock("@azure/arm-storage");
jest.mock("azure-storage");
jest.mock("../../config");

// imports
import uuid from "uuid/v4";
import * as storage from "../../lib/azure/storage";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";

import { StorageAccount } from "@azure/arm-storage/esm/models";
import { promisify } from "util";
import { Config } from "../../config";
import { IAzureAccessOpts } from "../../types";

const resourceGroupName = uuid();
const storageAccountName = uuid();
const location = uuid();

(Config as jest.Mock).mockReturnValue({
  introspection: {
    azure: {
      service_principal_id: uuid(),
      service_principal_secret: uuid(),
      subscription_id: uuid,
      tenant_id: uuid
    }
  }
});
jest.spyOn(storage, "getStorageManagementClient").mockImplementation(
  async (opts: IAzureAccessOpts = {}): Promise<any> => {
    return {
      storageAccounts: {
        checkNameAvailability: (name: string) => {
          return { nameAvailable: true };
        },
        listByResourceGroup: (name: string) => {
          return [
            { name: "testAccountName" },
            { name: "otherTestAccountName" }
          ];
        },
        listKeys: (resourceGroup: string, accountName: string) => {
          return {};
        }
      }
    };
  }
);

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("create storage account", () => {
  test("should fail when all arguments are not specified", async () => {
    let error: Error | undefined;
    try {
      await storage.createStorageAccount("", "", "");
    } catch (err) {
      logger.info(`createStorageAccount: ${JSON.stringify(err)}`);
      logger.info(`createStorageAccount error: ${err}`);
      error = err;
    }
    expect(error).toBeDefined();
  });

  test("should create storage account", async () => {
    let account: StorageAccount | undefined;
    try {
      account = await storage.createStorageAccount(
        resourceGroupName,
        storageAccountName,
        location
      );
    } catch (err) {
      logger.error(err);
    }
    expect(account).toBeUndefined();
  });
});

describe("get storage account key", () => {
  test("should fail getting storage account key when arguments are not specified", async () => {
    let error: Error | undefined;
    try {
      await storage.getStorageAccountKey("", "");
    } catch (err) {
      logger.info(JSON.stringify(err));
      error = err;
    }
    expect(error).toBeDefined();
  });
  test("should get storage account key", async () => {
    let key: string | undefined;
    try {
      key = await storage.getStorageAccountKey(
        resourceGroupName,
        storageAccountName
      );
    } catch (err) {
      logger.error(err);
    }
    expect(key).toBeUndefined();
  });
  test("get storage account key", async () => {
    jest.spyOn(storage, "getStorageManagementClient").mockImplementationOnce(
      async (opts: IAzureAccessOpts = {}): Promise<any> => {
        return {
          storageAccounts: {
            listKeys: (resourceGroup: string, accountName: string) => {
              return { keys: [{ value: "testkey" }] };
            }
          }
        };
      }
    );
    try {
      const key = await storage.getStorageAccountKey(
        "testResourceGroup",
        "testAccountName"
      );
      expect(key).toBe("testkey");
    } catch (err) {
      logger.error(err);
    }
  });
});

describe("create resource group", () => {
  test("invalid name", async () => {
    try {
      await storage.createResourceGroupIfNotExists("", "westus");
    } catch (err) {
      expect(err.message).toEqual("\nInvalid name");
    }
  });

  test("invalid location", async () => {
    try {
      await storage.createResourceGroupIfNotExists("testResourceGroup", "");
    } catch (err) {
      expect(err.message).toEqual("\nInvalid location");
    }
  });
});

describe("get storage account keys", () => {
  test("invalid account name", async () => {
    try {
      await storage.getStorageAccountKeys("", "resourceGroup");
    } catch (err) {
      expect(err.message).toEqual("\nInvalid accountName");
    }
  });

  test("invalid resource group", async () => {
    try {
      await storage.getStorageAccountKeys("accountName", "");
    } catch (err) {
      expect(err.message).toEqual("\nInvalid resourceGroup");
    }
  });

  test("should get storage account key", async () => {
    jest.spyOn(storage, "getStorageManagementClient").mockImplementationOnce(
      async (opts: IAzureAccessOpts = {}): Promise<any> => {
        return {
          storageAccounts: {
            listKeys: (resourceGroup: string, accountName: string) => {
              return { keys: [{ value: "testkey" }] };
            }
          }
        };
      }
    );
    const keys = await storage.getStorageAccountKeys(
      "accountName",
      "resourceGroup"
    );
    expect(keys).toBeDefined();
    expect(keys.length).toBe(1);
    expect(keys[0]).toBe("testkey");
  });

  test("should get no storage key", async () => {
    const keys = await storage.getStorageAccountKeys(
      "accountName",
      "resourceGroup"
    );
    expect(keys).toBeDefined();
    expect(keys.length).toBe(0);
  });
});

describe("storage account name available", () => {
  test("should get no storage key", async () => {
    const isAvailable = await storage.isStorageAccountNameAvailable(
      "accountName"
    );
    expect(isAvailable).toBe(true);
  });
});

describe("storage account exists", () => {
  jest
    .spyOn(storage, "getStorageAccount")
    .mockImplementationOnce(
      async (
        resourceGroup: string,
        accountName: string,
        opts: IAzureAccessOpts = {}
      ): Promise<any> => {
        return { enableHttpsTrafficOnly: true };
      }
    )
    .mockImplementationOnce(
      async (
        resourceGroup: string,
        accountName: string,
        opts: IAzureAccessOpts = {}
      ): Promise<any> => {
        return undefined;
      }
    );

  test("invalid resource group", async () => {
    try {
      await storage.isStorageAccountExist("", "testAccountName");
    } catch (err) {
      expect(err.message).toEqual("\nInvalid resourceGroup");
    }
  });

  test("invalid account name", async () => {
    try {
      await storage.isStorageAccountExist("testResourceGroup", "");
    } catch (err) {
      expect(err.message).toEqual("\nInvalid accountName");
    }
  });

  test("storage account exists", async () => {
    const exists = await storage.isStorageAccountExist(
      "testResourceGroup",
      "testAccountName"
    );
    expect(exists).toBe(true);
  });

  test("storage account does not exist", async () => {
    const exists = await storage.isStorageAccountExist(
      "testResourceGroup",
      "testAccountName"
    );
    expect(exists).toBe(false);
  });
});

describe("get storage account", () => {
  test("invalid resource group", async () => {
    try {
      await storage.getStorageAccount("", "testAccountName");
    } catch (err) {
      expect(err.message).toEqual("\nInvalid resourceGroup");
    }
  });

  test("invalid account name", async () => {
    try {
      await storage.getStorageAccount("testResourceGroup", "");
    } catch (err) {
      expect(err.message).toEqual("\nInvalid accountName");
    }
  });
});

describe("create table if it doesn't exist", () => {
  test("invalid account name", async () => {
    try {
      await storage.createTableIfNotExists("", "tableName", "accessKey");
    } catch (err) {
      expect(err.message).toEqual("\nInvalid accountName");
    }
  });

  test("invalid account name", async () => {
    try {
      await storage.createTableIfNotExists("testAccountName", "", "accesKey");
    } catch (err) {
      expect(err.message).toEqual("\nInvalid tableName");
    }
  });
});
