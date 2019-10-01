import fs from "fs";
import os from "os";
import yaml from "js-yaml";
import path from "path";
import uuid from "uuid/v4";

import cpFile from "cp-file";

import { disableVerboseLogging, enableVerboseLogging, logger } from "../logger";
import { addMaintainerToFile } from "./fileutils";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("Adding a new maintainer to existing maintainers file", () => {
  test("Existing maintainer, existing service", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    const maintainerFilePath = path.join(randomTmpDir, "maintainers.yaml");
    // TODO: figure out this path for the file...
    await cpFile(
      "/Users/mtarng/Workspace/spk/src/lib/maintainers.yaml",
      maintainerFilePath
    );
    logger.info("File copied");

    addMaintainerToFile(
      maintainerFilePath,
      "/pathtoservice/service",
      "name",
      "email"
    );
  });
});
