import fs from "fs";
import os from "os";
import path from "path";
import uuid from "uuid/v4";
import { Bedrock, Maintainers, write } from "../../config";
import { IBedrockFile, IMaintainersFile } from "../../types";
import { initialize } from "./init";

/**
 * Helper to create a new random directory to initialize
 */
const createNewProject = () => {
  // Create random directory to initialize
  const randomTmpDir = path.join(os.tmpdir(), uuid());
  fs.mkdirSync(randomTmpDir);
  return randomTmpDir;
};

describe("Initializing a blank/new bedrock repository", () => {
  test("all standard files get generated in the project root on init", async () => {
    // init
    const randomTmpDir = createNewProject();
    await initialize(randomTmpDir);

    // bedrock.yaml, maintainers.yaml should be in a the root for a 'standard' project
    const filepathsShouldExist = [
      ".gitignore",
      "bedrock.yaml",
      "maintainers.yaml",
      "hld-lifecycle.yaml"
    ].map(filename => path.join(randomTmpDir, filename));

    for (const filepath of filepathsShouldExist) {
      expect(fs.existsSync(filepath)).toBe(true);
    }

    // ensure service specific files do not get created
    const filepathsShouldNotExist = ["Dockerfile", "azure-pipelines.yaml"].map(
      filename => path.join(randomTmpDir, filename)
    );
    for (const filepath of filepathsShouldNotExist) {
      expect(fs.existsSync(filepath)).toBe(false);
    }
  });

  test("defaultRings gets injected successfully", async () => {
    const randomTmpDir = createNewProject();
    const ringName = uuid();
    await initialize(randomTmpDir, { defaultRing: ringName });
    const bedrock = Bedrock(randomTmpDir);
    expect(Object.keys(bedrock.rings).includes(ringName)).toBe(true);
  });
});

describe("initializing an existing file does not modify it", () => {
  test("bedrock.yaml does not get modified", async () => {
    const randomDir = createNewProject();
    const bedrockFile: IBedrockFile = {
      rings: { master: { isDefault: true } },
      services: {
        "some/random/dir": {
          helm: {
            chart: {
              git: "foo",
              path: "./",
              sha: "bar"
            }
          }
        }
      }
    };
    write(bedrockFile, randomDir);
    await initialize(randomDir);

    // bedrock file should not have been modified
    const updatedBedrock = Bedrock(randomDir);
    expect(updatedBedrock).toStrictEqual(bedrockFile);
  });

  test("maintainers.yaml does not get modified", async () => {
    const randomDir = createNewProject();
    const maintainersFile: IMaintainersFile = {
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
