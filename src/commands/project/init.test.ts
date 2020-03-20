import fs from "fs";
import path from "path";
import uuid from "uuid/v4";
import { Bedrock, Maintainers, write } from "../../config";
import {
  PROJECT_PIPELINE_FILENAME,
  SERVICE_PIPELINE_FILENAME
} from "../../lib/constants";
import { createTempDir, getMissingFilenames } from "../../lib/ioUtil";
import { BedrockFile, MaintainersFile } from "../../types";
import { execute, initialize } from "./init";
import * as init from "./init";
import { getVersionMessage } from "../../lib/fileutils";

const CREATED_FILES = [
  ".gitignore",
  "bedrock.yaml",
  "maintainers.yaml",
  PROJECT_PIPELINE_FILENAME
];

describe("Initializing a blank/new bedrock repository", () => {
  const writeSpy = jest.spyOn(fs, "writeFileSync");
  test("all standard files get generated in the project root on init", async () => {
    const randomTmpDir = createTempDir();
    await initialize(randomTmpDir);

    const expectedFilePath = path.join(randomTmpDir, "bedrock.yaml");
    expect(writeSpy).toBeCalledWith(
      expectedFilePath,
      `${getVersionMessage()}\n`,
      "utf8"
    );

    // bedrock.yaml, maintainers.yaml should be in a the root for a 'standard' project
    const missing = getMissingFilenames(randomTmpDir, CREATED_FILES);
    expect(missing.length).toBe(0); // no files are missing hence length 0

    // ensure service specific files do not get created
    const unexpected = getMissingFilenames(randomTmpDir, [
      "Dockerfile",
      SERVICE_PIPELINE_FILENAME
    ]);
    expect(unexpected.length).toBe(2);
  });

  test("defaultRings gets injected successfully", async () => {
    const randomTmpDir = createTempDir();
    const ringName = uuid();
    await initialize(randomTmpDir, { defaultRing: ringName });
    const bedrock = Bedrock(randomTmpDir);
    expect(Object.keys(bedrock.rings).includes(ringName)).toBe(true);
  });
});

describe("initializing an existing file does not modify it", () => {
  test("bedrock.yaml does not get modified", async () => {
    const randomDir = createTempDir();
    const bedrockFile: BedrockFile = {
      rings: { master: { isDefault: true } },
      services: {
        "some/random/dir": {
          helm: {
            chart: {
              git: "foo",
              path: "./",
              sha: "bar"
            }
          },
          k8sBackendPort: 1337
        }
      },
      version: "1.0"
    };
    write(bedrockFile, randomDir);
    await initialize(randomDir);

    // bedrock file should not have been modified
    const updatedBedrock = Bedrock(randomDir);
    expect(updatedBedrock).toStrictEqual(bedrockFile);
  });

  test("maintainers.yaml does not get modified", async () => {
    const randomDir = createTempDir();
    const maintainersFile: MaintainersFile = {
      services: {
        "some/random/dir": {
          maintainers: [{ name: "foo bar", email: "foobar@baz.com" }]
        }
      }
    };
    write(maintainersFile, randomDir);
    await initialize(randomDir);

    // maintainers file should not have been modified
    const updatedMaintainers = Maintainers(randomDir);
    expect(updatedMaintainers).toStrictEqual(maintainersFile);
  });
});

describe("Test execute function", () => {
  it("positive test", async () => {
    jest.spyOn(init, "initialize");
    const exitFn = jest.fn();
    const randomDir = createTempDir();
    await execute(
      {
        defaultRing: "master"
      },
      randomDir,
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(initialize).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]); // 0: success
  });

  it("negative test", async () => {
    jest.spyOn(init, "initialize").mockImplementation(() => {
      throw new Error();
    });
    const exitFn = jest.fn();
    const randomDir = createTempDir();
    await execute(
      {
        defaultRing: "master"
      },
      randomDir,
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]); // 1: error
  });
});
