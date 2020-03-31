jest.mock("@azure/arm-storage");
jest.mock("azure-storage");
jest.mock("../../config");

import uuid from "uuid/v4";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { Config } from "../../config";
import { getStorageAccount, validateStorageAccount } from "./storage";
import * as storage from "./storage";
import * as azureStorage from "azure-storage";

const resourceGroupName = uuid();
const storageAccountName = uuid();
const location = uuid();

(Config as jest.Mock).mockReturnValue({
  introspection: {
    azure: {
      service_principal_id: uuid(),
      service_principal_secret: uuid(),
      subscription_id: uuid,
      tenant_id: uuid,
    },
  },
});

const mockGetStorageManagementClient = (
  nameAvaible = true,
  hasResourceGroups = true
): void => {
  jest.spyOn(storage, "getStorageManagementClient").mockResolvedValueOnce({
    storageAccounts: {
      checkNameAvailability: (): unknown => {
        return { nameAvailable: nameAvaible };
      },
      listByResourceGroup: (): unknown => {
        if (hasResourceGroups) {
          return [
            { name: "testAccountName" },
            { name: "otherTestAccountName" },
          ];
        }
        return undefined;
      },
      listKeys: (): unknown => {
        return {};
      },
      create(): Promise<unknown> {
        return new Promise((resolve) => {
          resolve({
            status: "created",
          });
        });
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
};

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("create storage account", () => {
  test("should fail when all arguments are not specified", async () => {
    await expect(storage.createStorageAccount("", "", "")).rejects.toThrow();
  });
  test("name is not available", async () => {
    mockGetStorageManagementClient(false);
    await expect(
      storage.createStorageAccount(
        resourceGroupName,
        storageAccountName,
        location
      )
    ).rejects.toThrow();
  });
  test("should create storage account", async () => {
    mockGetStorageManagementClient();
    const account = await storage.createStorageAccount(
      resourceGroupName,
      storageAccountName,
      location
    );
    expect(account).toBeDefined();
  });
});

describe("get storage account key", () => {
  test("should fail getting storage account key when arguments are not specified", async () => {
    await expect(storage.getStorageAccountKey("", "")).rejects.toThrow();
  });
  test("negative test", async () => {
    jest.spyOn(storage, "getStorageManagementClient").mockResolvedValueOnce({
      storageAccounts: {
        listKeys: (): never => {
          throw Error("fake");
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await expect(
      storage.getStorageAccountKey(resourceGroupName, storageAccountName)
    ).rejects.toThrow();
  });
  test("negative test: key not found", async () => {
    jest.spyOn(storage, "getStorageManagementClient").mockResolvedValueOnce({
      storageAccounts: {
        listKeys: (): unknown => {
          return {};
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const key = await storage.getStorageAccountKey(
      "testResourceGroup",
      "testAccountName"
    );
    expect(key).toBeUndefined();
  });
  test("get storage account key", async () => {
    jest.spyOn(storage, "getStorageManagementClient").mockResolvedValueOnce({
      storageAccounts: {
        listKeys: (): unknown => {
          return { keys: [{ value: "testkey" }] };
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const key = await storage.getStorageAccountKey(
      "testResourceGroup",
      "testAccountName"
    );
    expect(key).toBe("testkey");
  });
});

describe("create resource group", () => {
  test("invalid name", async () => {
    try {
      await storage.createResourceGroupIfNotExists("", "westus");
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toEqual("\nInvalid name");
    }
  });

  test("invalid location", async () => {
    try {
      await storage.createResourceGroupIfNotExists("testResourceGroup", "");
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toEqual("\nInvalid location");
    }
  });
});

describe("get storage account keys", () => {
  test("invalid account name", async () => {
    try {
      await storage.getStorageAccountKeys("", "resourceGroup");
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toEqual("\nInvalid accountName");
    }
  });

  test("invalid resource group", async () => {
    try {
      await storage.getStorageAccountKeys("accountName", "");
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toEqual("\nInvalid resourceGroup");
    }
  });

  test("should get storage account key", async () => {
    jest.spyOn(storage, "getStorageManagementClient").mockResolvedValueOnce({
      storageAccounts: {
        listKeys: (): unknown => {
          return { keys: [{ value: "testkey" }] };
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const keys = await storage.getStorageAccountKeys(
      "accountName",
      "resourceGroup"
    );
    expect(keys).toBeDefined();
    expect(keys.length).toBe(1);
    expect(keys[0]).toBe("testkey");
  });

  test("should get no storage key", async () => {
    mockGetStorageManagementClient();
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
    mockGetStorageManagementClient();
    const isAvailable = await storage.isStorageAccountNameAvailable(
      "accountName"
    );
    expect(isAvailable).toBe(true);
  });
});

describe("storage account exists", () => {
  test("invalid resource group", async () => {
    jest.spyOn(storage, "getStorageAccount").mockResolvedValueOnce({
      enableHttpsTrafficOnly: true,
      location: "uswest",
    });
    try {
      await storage.isStorageAccountExist("", "testAccountName");
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toEqual("\nInvalid resourceGroup");
    }
  });

  test("invalid account name", async () => {
    jest.spyOn(storage, "getStorageAccount").mockResolvedValueOnce(undefined);
    try {
      await storage.isStorageAccountExist("testResourceGroup", "");
      expect(true).toBe(false);
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
    await expect(
      storage.getStorageAccount("", "testAccountName")
    ).rejects.toThrow("\nInvalid resourceGroup");
  });
  test("invalid account name", async () => {
    await expect(
      storage.getStorageAccount("testResourceGroup", "")
    ).rejects.toThrow("\nInvalid accountName");
  });
});

describe("create table if it doesn't exist", () => {
  test("invalid account name", async () => {
    await expect(
      storage.createTableIfNotExists("", "tableName", "accessKey")
    ).rejects.toThrow("\nInvalid accountName");
  });
  test("invalid account name", async () => {
    await expect(
      storage.createTableIfNotExists("testAccountName", "", "accessKey")
    ).rejects.toThrow("\nInvalid tableName");
  });
  test("positive test", async () => {
    jest.spyOn(azureStorage, "createTableService").mockReturnValueOnce({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createTableIfNotExists: (tableName: string, callbackFn: any) => {
        callbackFn(null, {
          created: true,
        });
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await storage.createTableIfNotExists(
      "testAccountName",
      "tableName",
      "accessKey"
    );
  });
  test("negative test", async () => {
    jest.spyOn(azureStorage, "createTableService").mockReturnValueOnce({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createTableIfNotExists: (tableName: string, callbackFn: any) => {
        callbackFn(Error("fake message"), null);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await expect(
      storage.createTableIfNotExists(
        "testAccountName",
        "tableName",
        "accessKey"
      )
    ).rejects.toThrow("fake message");
  });
});

describe("test getStorageAccount function", () => {
  it("positive test", async () => {
    mockGetStorageManagementClient();
    const res = await getStorageAccount(resourceGroupName, "testAccountName");
    expect(res).toBeDefined();
  });
  it("negative test, no resource groups", async () => {
    mockGetStorageManagementClient(true, false);
    const res = await getStorageAccount(resourceGroupName, "testAccountName");
    expect(res).toBeUndefined();
  });
});

describe("test validateStorageAccount function", () => {
  it("negative test: account does not exist", async () => {
    jest
      .spyOn(storage, "isStorageAccountNameAvailable")
      .mockResolvedValueOnce(true);
    const res = await validateStorageAccount(
      resourceGroupName,
      "testAccountName",
      "testkey"
    );
    expect(res).toBe(false);
  });
  it("negative test: key does not exist", async () => {
    jest
      .spyOn(storage, "isStorageAccountNameAvailable")
      .mockResolvedValueOnce(false);
    jest.spyOn(storage, "getStorageAccountKeys").mockResolvedValueOnce([]);
    const res = await validateStorageAccount(
      resourceGroupName,
      "testAccountName",
      "testkey"
    );
    expect(res).toBe(false);
  });
  it("negative test: exception thrown", async () => {
    jest
      .spyOn(storage, "isStorageAccountNameAvailable")
      .mockRejectedValueOnce(Error("fake"));
    await expect(
      validateStorageAccount(resourceGroupName, "testAccountName", "testkey")
    ).rejects.toThrow();
  });
  it("positive test", async () => {
    jest
      .spyOn(storage, "isStorageAccountNameAvailable")
      .mockResolvedValueOnce(false);
    jest
      .spyOn(storage, "getStorageAccountKeys")
      .mockResolvedValueOnce(["testkey"]);
    const res = await validateStorageAccount(
      resourceGroupName,
      "testAccountName",
      "testkey"
    );
    expect(res).toBe(true);
  });
});
