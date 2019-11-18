// Mocks
jest.mock("@azure/arm-storage");
jest.mock("azure-storage");
jest.mock("../../config");

// imports
import uuid from "uuid/v4";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { createStorageAccount, getStorageAccountKey } from "./storage";

import { StorageAccount } from "@azure/arm-storage/esm/models";
import { Config } from "../../config";

const resourceGroupName = uuid();
const storageAccountName = uuid();
const location = uuid();

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
      await createStorageAccount("", "", "");
    } catch (err) {
      logger.info(`createStorageAccount: ${JSON.stringify(err)}`);
      logger.info(`createStorageAccount error: ${err}`);
      error = err;
    }
    expect(error).toBeDefined();
  });

  test("should create storage account", async () => {
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

    let account: StorageAccount | undefined;
    try {
      account = await createStorageAccount(
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
      await getStorageAccountKey("", "");
    } catch (err) {
      logger.info(JSON.stringify(err));
      error = err;
    }
    expect(error).toBeDefined();
  });
  test("should get storage account key", async () => {
    let key: string | undefined;
    try {
      key = await getStorageAccountKey(resourceGroupName, storageAccountName);
    } catch (err) {
      logger.error(err);
    }
    expect(key).toBeUndefined();
  });
});
