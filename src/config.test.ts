import fs from "fs";
import yaml from "js-yaml";
import os from "os";
import path from "path";
import shell from "shelljs";
import uuid from "uuid/v4";
import { Bedrock, bedrockFileInfo, write } from "./config";
import { disableVerboseLogging, enableVerboseLogging, logger } from "./logger";
import { IBedrockFile, IBedrockFileInfo } from "./types";

const variableGroupName = uuid();

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
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

describe("isBedrockFileValid", () => {
  test("Should fail when empty file directory is passed", async () => {
    let invalidDirError: Error | undefined;

    try {
      logger.info("calling create");
      await bedrockFileInfo("");
    } catch (err) {
      invalidDirError = err;
    }
    expect(invalidDirError).toBeDefined();
  });

  test("Should return false when bedrock file does not exist", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    const fileInfo: IBedrockFileInfo = await bedrockFileInfo(randomTmpDir);

    logger.info(`bedrock.yaml file exists: ${fileInfo.exist}`);

    expect(fileInfo.exist).toBe(false);
  });

  test("Should pass when bedrock file exists with variable groups length 0", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    logger.info(`random temp dir: ${randomTmpDir}`);

    // create bedrock file to simulate the the use case that `spk project init` ran before
    const bedrockFileData: IBedrockFile = {
      rings: {},
      services: {},
      variableGroups: []
    };

    const asYaml = yaml.safeDump(bedrockFileData, {
      lineWidth: Number.MAX_SAFE_INTEGER
    });
    fs.writeFileSync(path.join(randomTmpDir, "bedrock.yaml"), asYaml);

    const fileInfo: IBedrockFileInfo = await bedrockFileInfo(randomTmpDir);
    logger.verbose(
      `bedrock.yaml file exists: ${fileInfo.exist} in ${randomTmpDir}`
    );

    expect(fileInfo.exist).toBe(true);
    expect(fileInfo.hasVariableGroups).toBe(false);
  });

  test("Should pass when bedrock file exists with one variable group", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    logger.info(`random temp dir: ${randomTmpDir}`);

    // create bedrock file to simulate the the use case that `spk project init` ran before
    const bedrockFileData: IBedrockFile = {
      rings: {},
      services: {},
      variableGroups: [variableGroupName]
    };

    const asYaml = yaml.safeDump(bedrockFileData, {
      lineWidth: Number.MAX_SAFE_INTEGER
    });
    fs.writeFileSync(path.join(randomTmpDir, "bedrock.yaml"), asYaml);

    const fileInfo: IBedrockFileInfo = await bedrockFileInfo(randomTmpDir);
    logger.info(
      `bedrock.yaml file exists: ${fileInfo.exist} in ${randomTmpDir}`
    );

    expect(fileInfo.exist).toBe(true);
    expect(fileInfo.hasVariableGroups).toBe(true);
  });
});
