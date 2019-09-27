import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { config, verifyAppConfiguration, writeConfigToFile } from "./init";

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
    await writeConfigToFile(testConfig);

    await verifyAppConfiguration().then(() => {
      expect(config.AZURE_ORG).toBe("testOrg");
      expect(config.AZURE_PROJECT).toBe("testProject");
      expect(config.STORAGE_ACCOUNT_KEY).toBe("storageAccountKey");
      expect(config.STORAGE_ACCOUNT_NAME).toBe("storaceAccountName");
      expect(config.STORAGE_PARTITION_KEY).toBe("partitionKey");
      expect(config.STORAGE_TABLE_NAME).toBe("storageTableName");
    });
  });
});
