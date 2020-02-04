import os from "os";
import path from "path";
import shell from "shelljs";
import uuid from "uuid/v4";
import { Bedrock, updateVariableWithLocalEnv, write } from "./config";
import { disableVerboseLogging, enableVerboseLogging } from "./logger";
import { IBedrockFile } from "./types";

const variableGroupName = uuid();

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
  test("valid helm configuration passes", async () => {
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    shell.mkdir("-p", randomTmpDir);
    const validBedrockYaml: IBedrockFile = {
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

    let bedrockConfig: IBedrockFile | undefined;
    let error: Error | undefined;
    try {
      bedrockConfig = Bedrock(randomTmpDir);
    } catch (err) {
      error = err;
    }
    expect(bedrockConfig).toBeTruthy();
    expect(error).toBeUndefined();
  });

  test("invalid helm configuration fails", async () => {
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    shell.mkdir("-p", randomTmpDir);
    const validBedrockYaml: IBedrockFile = {
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
    } as any;
    write(validBedrockYaml, randomTmpDir);

    let bedrockConfig: IBedrockFile | undefined;
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
