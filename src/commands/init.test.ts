import fs from "fs";
import os from "os";
import * as path from "path";
import uuid from "uuid/v4";
import {
  Config,
  defaultConfigFile,
  loadConfiguration,
  saveConfiguration
} from "../config";
import { disableVerboseLogging, enableVerboseLogging, logger } from "../logger";
import { validatePrereqs } from "./init";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

const mockFileName = "src/commands/mocks/spk-config.yaml";
describe("Initializing a project to use spk with a config file", () => {
  test("init command basic file test", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    process.env.test_name = "my_storage_account";
    process.env.test_key = "my_storage_key";
    const filename = path.resolve(mockFileName);
    await saveConfiguration(filename, randomTmpDir);
    loadConfiguration(path.join(randomTmpDir, "config.yaml"));

    const config = Config();
    expect(config.introspection!).toBeDefined();
    expect(config.introspection!.azure!.account_name).toBe(
      process.env.test_name
    );
    const key = await config.introspection!.azure!.key;
    expect(key).toBe(process.env.test_key);
    expect(config.introspection!.azure!.table_name!).toBe(
      process.env.test_name + "+" + process.env.test_key
    );
    logger.info("Able to initialize a basic config file");
  });
});

describe("Initializing a project a config file but no env vars", () => {
  test("init command basic file without env vars", async () => {
    const filename = path.resolve(mockFileName);
    process.env.test_name = "";
    process.env.test_key = "";
    try {
      loadConfiguration(filename);
      // Make sure execution does not get here:
      expect(true).toBeFalsy();
    } catch (err) {
      expect(err).toBeDefined();
      logger.info(
        "Error is being thrown on undefined env vars being referenced"
      );
    }
  });
});

describe("Initializing a project with a non-existent file", () => {
  test("Non-existent file test", async () => {
    const filename = path.resolve("./spk-config-test.yaml");
    try {
      loadConfiguration(filename);
      // Make sure execution does not get here:
      expect(true).toBeFalsy();
    } catch (e) {
      expect(e.code).toBe("ENOENT");
      logger.info("Error is being thrown on trying to use a non-existent file");
    }
  });
});

describe("Writing to default config location", () => {
  test("Default config location exists", async () => {
    try {
      const filename = path.resolve(mockFileName);
      process.env.test_name = "testStorageName";
      process.env.test_key = "testStorageKey";
      loadConfiguration(filename);

      await saveConfiguration(filename);
      loadConfiguration(defaultConfigFile());
      expect(Config().azure_devops!).toBeDefined();
    } catch (e) {
      logger.error(e);
      // Make sure execution does not get here:
      expect(true).toBeFalsy();
    }
    logger.info("Able to write to default config location");
  });
});

describe("Validating executable prerequisites in spk-config", () => {
  test("Validate that exectuable boolean matches in spk-config", async () => {
    // Iterate through an array of non-existent binaries to create a force fail. If fails, then test pass
    const filename = path.resolve("src/commands/mocks/spk-config.yaml");
    process.env.test_name = "my_storage_account";
    process.env.test_key = "my_storage_key";
    loadConfiguration(filename);
    const fakeBinaries: string[] = ["foobar"];
    await validatePrereqs(fakeBinaries, true);
    expect(Config().infra!).toBeDefined();
    expect(Config().infra!.checks!).toBeDefined();
    expect(Config().infra!.checks!.foobar!).toBe(false);
  });
});
