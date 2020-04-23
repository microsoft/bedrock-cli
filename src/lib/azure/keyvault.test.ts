import { KeyVaultSecret } from "@azure/keyvault-secrets";
import uuid from "uuid/v4";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { getErrorMessage } from "../errorBuilder";
import * as azurecredentials from "./azurecredentials";
import { getClient, getSecret, setSecret } from "./keyvault";
import * as keyvault from "./keyvault";

const keyVaultName = uuid();
const mockedName = uuid();
const secretValue = uuid();

jest.mock("@azure/keyvault-secrets", () => {
  class MockClient {
    constructor() {
      return {};
    }
  }
  return {
    SecretClient: MockClient,
  };
});

const mockGetClient = (): void => {
  jest.spyOn(keyvault, "getClient").mockResolvedValueOnce({
    getSecret: async (): Promise<KeyVaultSecret> => {
      return {
        name: "test",
        properties: {
          name: "test",
          vaultUrl: "http://test.com",
        },
        value: "secretValue",
      };
    },
    setSecret: async (): Promise<KeyVaultSecret> => {
      return {
        name: "test",
        properties: {
          name: "test",
          vaultUrl: "http://test.com",
        },
      };
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

describe("set secret", () => {
  test("negative test: missing values for name, key name and value.", async () => {
    await expect(setSecret("", "", "")).rejects.toThrow(
      getErrorMessage("azure-key-vault-set-secret-err")
    );
  });
  test("negative test: missing values for key name and value.", async () => {
    await expect(setSecret("vault-name", "", "")).rejects.toThrow(
      getErrorMessage("azure-key-vault-set-secret-err")
    );
  });
  test("negative test: missing key value.", async () => {
    await expect(setSecret("vault-name", "key-name", "")).rejects.toThrow(
      getErrorMessage("azure-key-vault-set-secret-err")
    );
  });

  test("positive test: should create storage account", async () => {
    mockGetClient();
    await setSecret(keyVaultName, mockedName, secretValue);
  });
  test("negative test: getclient failed", async () => {
    jest.spyOn(keyvault, "getClient").mockResolvedValueOnce({
      setSecret: (): Promise<KeyVaultSecret> => {
        throw Error("fake error");
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await expect(
      setSecret(keyVaultName, mockedName, secretValue)
    ).rejects.toThrow(getErrorMessage("azure-key-vault-set-secret-err"));
  });
});

describe("get secret", () => {
  test("negative test: missing values for name and key name.", async () => {
    await expect(getSecret("", "")).rejects.toThrow(
      getErrorMessage("azure-key-vault-get-secret-err")
    );
  });
  it("positive test: should get storage account key", async () => {
    mockGetClient();
    const val = await getSecret(keyVaultName, mockedName);
    expect(val).toBe("secretValue");
  });
  it("negative test: secret not found", async () => {
    jest.spyOn(keyvault, "getClient").mockResolvedValueOnce({
      getSecret: (): Promise<KeyVaultSecret> => {
        throw {
          code: "SecretNotFound",
          statusCode: 404,
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const val = await getSecret(keyVaultName, mockedName);
    expect(val).toBe(undefined);
  });
  it("negative test: other errors", async () => {
    jest.spyOn(keyvault, "getClient").mockReturnValueOnce(
      Promise.resolve({
        getSecret: (): Promise<KeyVaultSecret> => {
          throw {
            code: "something else",
            statusCode: 400,
          };
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    );

    await expect(getSecret(keyVaultName, mockedName)).rejects.toThrow(
      getErrorMessage("azure-key-vault-get-secret-err")
    );
  });
});

describe("test getClient function", () => {
  it("negative test: missing credential", async () => {
    jest
      .spyOn(azurecredentials, "getCredentials")
      .mockRejectedValueOnce(new Error());
    await expect(getClient(keyVaultName, {})).rejects.toThrow(
      getErrorMessage("azure-key-vault-client-err")
    );
  });
  it("positive test", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest
      .spyOn(azurecredentials, "getCredentials")
      .mockResolvedValueOnce({} as any);
    await getClient(keyVaultName, {});
  });
});
