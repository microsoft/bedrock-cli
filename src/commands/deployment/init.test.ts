import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import {
  config,
  initialize,
  verifyAppConfiguration,
  writeConfigToFile
} from "./init";

jest.mock("../../lib/azure/storage");
jest.mock("../../lib/azure/keyvault");
jest.mock("../../lib/azure/azurecredentials");

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("Initializing a project to use service introspection for the first time", () => {
  test("init command to setup project configuration", async () => {
    const testConfig: { [id: string]: string } = {};
    testConfig.AZURE_ORG = "testOrg";
    testConfig.AZURE_PROJECT = "testProject";
    testConfig.STORAGE_ACCOUNT_KEY = "storageAccountKey";
    testConfig.STORAGE_ACCOUNT_NAME = "storaceAccountName";
    testConfig.STORAGE_PARTITION_KEY = "partitionKey";
    testConfig.STORAGE_TABLE_NAME = "storageTableName";
    testConfig.STORAGE_RESOURCE_GROUP_NAME = "storageResourceGroupName";
    testConfig.STORAGE_LOCATION = "storageLocation";
    testConfig.KEY_VAULT_NAME = "keyVaultName";
    await writeConfigToFile(testConfig);

    await verifyAppConfiguration().then(() => {
      expect(config.AZURE_ORG).toBe("testOrg");
      expect(config.AZURE_PROJECT).toBe("testProject");
      expect(config.STORAGE_ACCOUNT_KEY).toBe("storageAccountKey");
      expect(config.STORAGE_ACCOUNT_NAME).toBe("storaceAccountName");
      expect(config.STORAGE_PARTITION_KEY).toBe("partitionKey");
      expect(config.STORAGE_TABLE_NAME).toBe("storageTableName");
      expect(config.STORAGE_RESOURCE_GROUP_NAME).toBe(
        "storageResourceGroupName"
      );
      expect(config.STORAGE_LOCATION).toBe("storageLocation");
      expect(config.KEY_VAULT_NAME).toBe("keyVaultName");
    });
  });
});

describe("create storage account if not exists", () => {
  it("should create storage account", async () => {
    await initialize("epi-test", "testsarathp1", "westus2", "sarathpvault");
  }, 50000);

  it("should not create storage account", async () => {
    await initialize("epi-test", "testsarathp1", "westus2", "sarathpvault");
  }, 50000);
});
