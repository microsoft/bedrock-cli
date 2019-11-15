import * as path from "path";
import { Config, loadConfiguration } from "../../config";
import * as update from "../../lib/azure/deploymenttable";
import { isValidConfig, isValidStorageAccount } from "./validate";

import { StorageManagementClient } from "@azure/arm-storage";
import * as storage from "../../lib/azure/storage";
import { deleteSelfTestData, writeSelfTestData } from "./validate";

jest.spyOn(storage, "getStorageClient").mockImplementation(
  async (): Promise<any> => {
    return undefined;
  }
);

jest.spyOn(storage, "getStorageAccountKeys").mockImplementation(
  async (
    accountName: string,
    resourceGroup: string,
    client: StorageManagementClient
  ): Promise<string[]> => {
    if (accountName === "epi-test") {
      return ["mock access key", "mock access key2"];
    }

    return [];
  }
);

jest.spyOn(storage, "isStorageAccountNameAvailable").mockImplementation(
  async (
    accountName: string,
    client: StorageManagementClient
  ): Promise<boolean> => {
    if (accountName === "epi-test" || accountName === "epi-test-no-keys") {
      return false;
    }

    return true;
  }
);

let mockedDB: any[] = [];
const mockTableInfo: update.IDeploymentTable = {
  accountKey: "test",
  accountName: "test",
  partitionKey: "test",
  tableName: "test"
};

jest.spyOn(update, "findMatchingDeployments").mockImplementation(
  (
    tableInfo: update.IDeploymentTable,
    filterName: string,
    filterValue: string
  ): Promise<any> => {
    const array: any[] = [];
    return new Promise(resolve => {
      mockedDB.forEach((row: any) => {
        if (row.p1 === "500") {
          array.push(row);
        }
      });
      resolve(array);
    });
  }
);

jest.spyOn(update, "insertToTable").mockImplementation(
  (tableInfo: update.IDeploymentTable, entry: any): Promise<any> => {
    return new Promise(resolve => {
      mockedDB.push(entry);
      resolve(entry);
    });
  }
);

jest.spyOn(update, "deleteFromTable").mockImplementation(
  (tableInfo: update.IDeploymentTable, entry: any): Promise<any> => {
    return new Promise(resolve => {
      if (mockedDB.length === 1 && mockedDB[0].p1 === "500") {
        mockedDB = [];
      }
      resolve(0);
    });
  }
);

jest.spyOn(update, "updateEntryInTable").mockImplementation(
  (tableInfo: update.IDeploymentTable, entry: any): Promise<any> => {
    return new Promise(resolve => {
      mockedDB.forEach((row: any, index: number) => {
        if (row.RowKey === entry.RowKey) {
          mockedDB[index] = entry;
          resolve(entry);
        }
      }, mockedDB);
    });
  }
);

jest.spyOn(Math, "random").mockImplementation((): number => {
  return 0.5;
});

beforeEach(() => {
  process.env.test_name = "my_storage_account";
  process.env.test_key = "my_storage_key";
  const mockFileName = "src/commands/mocks/spk-config.yaml";
  const filename = path.resolve(mockFileName);
  loadConfiguration(filename);
});

describe("Validate deployment configuration", () => {
  test("valid deployment configuration", async () => {
    const isValid = isValidConfig();
    expect(isValid).toBe(true);
  });
});

describe("Validate missing deployment configuration", () => {
  test("no deployment configuration", async () => {
    Config().introspection = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage", async () => {
    Config().introspection!.azure = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.account_name configuration", async () => {
    Config().introspection!.azure!.account_name = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.table_name configuration", async () => {
    Config().introspection!.azure!.table_name = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.partition_key configuration", async () => {
    Config().introspection!.azure!.partition_key = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.key configuration", async () => {
    Config().introspection!.azure!.key = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.pipeline configuration", () => {
  test("missing deployment.pipeline configuration", async () => {
    Config().azure_devops = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.pipeline configuration", () => {
  test("missing deployment.pipeline.org configuration", async () => {
    Config().azure_devops!.org = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.pipeline configuration", () => {
  test("missing deployment.pipeline.project configuration", async () => {
    Config().azure_devops!.project = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate storage account", () => {
  test("non-existing storage account", async () => {
    Config().introspection!.azure!.account_name = "non-existing-account-name";
    const isValid = await isValidStorageAccount();

    expect(isValid).toBe(false);
  });

  test("existing storage account no keys", async () => {
    Config().introspection!.azure!.account_name = "epi-test-no-keys";
    const isValid = await isValidStorageAccount();

    expect(isValid).toBe(false);
  });

  test("existing storage account with valid key", async () => {
    Config().introspection!.azure!.account_name = "epi-test";
    Config().introspection!.azure!.key = "mock access key2";
    const isValid = await isValidStorageAccount();

    expect(isValid).toBe(true);
  });

  test("existing storage account with invalid key", async () => {
    Config().introspection!.azure!.account_name = "epi-test";
    Config().introspection!.azure!.key = "mock access key3";
    const isValid = await isValidStorageAccount();

    expect(isValid).toBe(false);
  });
});

describe("Write self-test data", () => {
  it("should create a row key, add to storage", async () => {
    mockedDB = [];
    await writeSelfTestData(
      "test-key",
      "test-name",
      "test-partition-key",
      "test-table-name"
    );
    expect(mockedDB).toHaveLength(1);
    expect(mockedDB[0].p1).toBe("500");
    expect(mockedDB[0].service).toBe("spk-self-test");
  });
});

describe("Delete self-test data", () => {
  it("should create a row key, add to storage and delete it", async () => {
    mockedDB = [];
    await writeSelfTestData(
      "test-key",
      "test-name",
      "test-partition-key",
      "test-table-name"
    );
    expect(mockedDB).toHaveLength(1);
    expect(mockedDB[0].p1).toBe("500");
    expect(mockedDB[0].service).toBe("spk-self-test");

    await deleteSelfTestData(
      "test-key",
      "test-name",
      "test-partition-key",
      "test-table-name",
      "500"
    );
    expect(mockedDB).toHaveLength(0);
  });
});
