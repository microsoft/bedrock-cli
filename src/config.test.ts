/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/camelcase */
import os from "os";
import path from "path";
import shell from "shelljs";
import uuid from "uuid/v4";
import {
  Bedrock,
  Config,
  defaultConfigFile,
  loadConfiguration,
  saveConfiguration,
  updateVariableWithLocalEnv,
  write
} from "./config";
import { createTempDir } from "./lib/ioUtil";
import { disableVerboseLogging, enableVerboseLogging } from "./logger";
import { BedrockFile } from "./types";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("Test updateVariableWithLocalEnv function", () => {
  beforeAll(() => {
    process.env.hello = "world";
    process.env.hello1 = "world1";
  });
  afterAll(() => {
    delete process.env.hello;
    delete process.env.hello1;
  });
  it("positive test", () => {
    expect(
      updateVariableWithLocalEnv("${env:hello} - ${env:hello} : ${env:hello1}")
    ).toBe("world - world : world1");
  });
  it("negative test", () => {
    try {
      updateVariableWithLocalEnv(
        "${env:hello2} - ${env:hello} : ${env:hello1}"
      );
    } catch (e) {
      expect(e.message).toBe(
        "Environment variable needs to be defined for hello2 since it's referenced in the config file."
      );
    }
  });
});

describe("Bedrock", () => {
  test("valid helm configuration passes", () => {
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    shell.mkdir("-p", randomTmpDir);
    const validBedrockYaml: BedrockFile = {
      rings: {},
      services: {
        "foo/a": {
          helm: {
            chart: {
              chart: "elastic",
              repository: "some-repo"
            }
          },
          k8sBackend: "backendservice",
          k8sBackendPort: 1337,
          pathPrefix: "servicepath",
          pathPrefixMajorVersion: "v1"
        },
        "foo/b": {
          helm: {
            chart: {
              git: "foo",
              path: "some/path",
              sha: "cef8361c62e7a91887625336eb13a8f90dbcf8df"
            }
          },
          k8sBackend: "backendservice",
          k8sBackendPort: 1337,
          pathPrefix: "servicepath",
          pathPrefixMajorVersion: "v1"
        }
      }
    };
    write(validBedrockYaml, randomTmpDir);

    let bedrockConfig: BedrockFile | undefined;
    let error: Error | undefined;
    try {
      bedrockConfig = Bedrock(randomTmpDir);
    } catch (err) {
      error = err;
    }
    expect(bedrockConfig).toBeTruthy();
    expect(error).toBeUndefined();
  });

  test("invalid helm configuration fails", () => {
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    shell.mkdir("-p", randomTmpDir);
    const validBedrockYaml: BedrockFile = {
      rings: {},
      services: {
        "foo/a": {
          helm: {
            // Missing 'chart'
            chart: {
              repository: "some-repo"
            }
          }
        },
        "foo/b": {
          helm: {
            // missing 'path'
            chart: {
              git: "foo",
              sha: "cef8361c62e7a91887625336eb13a8f90dbcf8df"
            }
          }
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    write(validBedrockYaml, randomTmpDir);

    let bedrockConfig: BedrockFile | undefined;
    let error: Error | undefined;
    try {
      bedrockConfig = Bedrock(randomTmpDir);
    } catch (err) {
      error = err;
    }
    expect(bedrockConfig).toBeFalsy();
    expect(error).toBeDefined();
  });
});

const mockFileName = "src/commands/mocks/spk-config.yaml";

describe("Initializing a project to use spk with a config file", () => {
  test("init command basic file test", async () => {
    // Create random directory to initialize
    const randomTmpDir = createTempDir();
    process.env.test_name = "my_storage_account";
    process.env.test_key = "my_storage_key";
    const filename = path.resolve(mockFileName);
    saveConfiguration(filename, randomTmpDir);
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
  });
});

describe("Initializing a project a config file but no env vars", () => {
  test("init command basic file without env vars", () => {
    const filename = path.resolve(mockFileName);
    process.env.test_name = "";
    process.env.test_key = "";
    try {
      loadConfiguration(filename);
      // Make sure execution does not get here:
      expect(true).toBeFalsy();
    } catch (err) {
      expect(err).toBeDefined();
    }
  });
});

describe("Initializing a project with a non-existent file", () => {
  test("Non-existent file test", () => {
    const filename = path.resolve("./spk-config-test.yaml");
    try {
      loadConfiguration(filename);
      // Make sure execution does not get here:
      expect(true).toBeFalsy();
    } catch (e) {
      expect(e.code).toBe("ENOENT");
    }
  });
});

describe("Writing to default config location", () => {
  test("Default config location exists", () => {
    try {
      const filename = path.resolve(mockFileName);
      process.env.test_name = "testStorageName";
      process.env.test_key = "testStorageKey";
      loadConfiguration(filename);

      saveConfiguration(filename);
      loadConfiguration(defaultConfigFile());
      expect(Config().azure_devops!).toBeDefined();
    } catch (e) {
      // Make sure execution does not get here:
      expect(true).toBeFalsy();
    }
  });
});
