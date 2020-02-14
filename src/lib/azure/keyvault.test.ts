import {
  GetSecretOptions,
  KeyVaultSecret,
  SecretClient,
  SetSecretOptions
} from "@azure/keyvault-secrets";
import uuid from "uuid/v4";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { getSecret, setSecret } from "./keyvault";
import * as keyvault from "./keyvault";

const keyVaultName = uuid();
const mockedName = uuid();
const secretValue = uuid();

jest.spyOn(keyvault, "getClient").mockReturnValue(
  Promise.resolve({
    getSecret: async (
      secretName: string,
      options?: GetSecretOptions
    ): Promise<KeyVaultSecret> => {
      return {
        name: "test",
        properties: {
          name: "test",
          vaultUrl: "http://test.com"
        },
        value: "secretValue"
      };
    },
    setSecret: async (
      secretName: string,
      value: string,
      options?: SetSecretOptions
    ): Promise<KeyVaultSecret> => {
      return {
        name: "test",
        properties: {
          name: "test",
          vaultUrl: "http://test.com"
        }
      };
    }
  } as SecretClient)
);

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("set secret", () => {
  test("should fail when all arguments are not specified", async () => {
    await expect(setSecret("", "", "")).rejects.toThrow();
  });
  test("should create storage account", async () => {
    try {
      await setSecret(keyVaultName, mockedName, secretValue);
    } catch (_) {
      expect(true).toBe(false);
    }
  });
  test("negative test", async () => {
    jest.spyOn(keyvault, "getClient").mockReturnValueOnce(
      Promise.resolve({
        setSecret: async (
          secretName: string,
          value: string,
          options?: SetSecretOptions
        ): Promise<KeyVaultSecret> => {
          throw new Error("fake error");
        }
      } as SecretClient)
    );
    try {
      await setSecret(keyVaultName, mockedName, secretValue);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});

describe("get secret", () => {
  test("should fail getting storage account key when arguments are not specified", async () => {
    await expect(getSecret("", "")).rejects.toThrow();
  });
  it("should get storage account key", async () => {
    try {
      const val = await getSecret(keyVaultName, mockedName);
      expect(val).toBe("secretValue");
    } catch (err) {
      expect(true).toBe(false);
    }
  });
  it("negative test: secret not found", async () => {
    jest.spyOn(keyvault, "getClient").mockReturnValueOnce(
      Promise.resolve({
        getSecret: async (
          secretName: string,
          options?: GetSecretOptions
        ): Promise<KeyVaultSecret> => {
          throw {
            code: "SecretNotFound",
            statusCode: 404
          };
        }
      } as SecretClient)
    );
    try {
      const val = await getSecret(keyVaultName, mockedName);
      expect(val).toBe(undefined);
    } catch (err) {
      expect(true).toBe(false);
    }
  });
  it("negative test: other errors", async () => {
    jest.spyOn(keyvault, "getClient").mockReturnValueOnce(
      Promise.resolve({
        getSecret: async (
          secretName: string,
          options?: GetSecretOptions
        ): Promise<KeyVaultSecret> => {
          throw {
            code: "something else",
            statusCode: 400
          };
        }
      } as SecretClient)
    );
    try {
      const val = await getSecret(keyVaultName, mockedName);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeDefined();
    }
  });
});
