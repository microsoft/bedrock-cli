import * as path from "path";
import { config, loadConfiguration } from "./../init";
import { isValidConfig, isValidStorageAccount } from "./validate";

import { StorageManagementClient } from "@azure/arm-storage";
import * as storage from "../../lib/azure/storage";

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
    config.introspection = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage", async () => {
    config.introspection!.azure = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.account_name configuration", async () => {
    config.introspection!.azure!.account_name = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.table_name configuration", async () => {
    config.introspection!.azure!.table_name = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.partition_key configuration", async () => {
    config.introspection!.azure!.partition_key = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.key configuration", async () => {
    config.introspection!.azure!.key = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.pipeline configuration", () => {
  test("missing deployment.pipeline configuration", async () => {
    config.azure_devops = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.pipeline configuration", () => {
  test("missing deployment.pipeline.org configuration", async () => {
    config.azure_devops!.org = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.pipeline configuration", () => {
  test("missing deployment.pipeline.project configuration", async () => {
    config.azure_devops!.project = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate storage account", () => {
  test("non-existing storage account", async () => {
    config.introspection!.azure!.account_name = "non-existing-account-name";
    const isValid = await isValidStorageAccount();

    expect(isValid).toBe(false);
  });

  test("existing storage account no keys", async () => {
    config.introspection!.azure!.account_name = "epi-test-no-keys";
    const isValid = await isValidStorageAccount();

    expect(isValid).toBe(false);
  });

  test("existing storage account with valid key", async () => {
    config.introspection!.azure!.account_name = "epi-test";
    config.introspection!.azure!.key = "mock access key2";
    const isValid = await isValidStorageAccount();

    expect(isValid).toBe(true);
  });

  test("existing storage account with invalid key", async () => {
    config.introspection!.azure!.account_name = "epi-test";
    config.introspection!.azure!.key = "mock access key3";
    const isValid = await isValidStorageAccount();

    expect(isValid).toBe(false);
  });
});
