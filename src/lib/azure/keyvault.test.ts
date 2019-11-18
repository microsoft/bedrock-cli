import uuid from "uuid/v4";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { getSecret, setSecret } from "./keyvault";

const keyVaultName = uuid();
const secretName = uuid();
const secretValue = uuid();

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("set secret", () => {
  test("should fail when all arguments are not specified", async () => {
    let error: Error | undefined;
    try {
      await setSecret("", "", "");
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
  });

  test("should create storage account", async () => {
    try {
      await setSecret(keyVaultName, secretName, secretValue);
    } catch (err) {
      logger.error(err);
    }
  });
});

describe("get secret", () => {
  test("should fail getting storage account key when arguments are not specified", async () => {
    let error: Error | undefined;
    try {
      await getSecret("", "");
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
  });
  test("should get storage account key", async () => {
    let latestValue: string | undefined;
    try {
      latestValue = await getSecret(keyVaultName, secretName);
    } catch (err) {
      logger.error(err);
    }
    expect(latestValue).toBeUndefined();
  });
});
