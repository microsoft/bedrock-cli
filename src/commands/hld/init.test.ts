import fs from "fs";
import os from "os";
import path from "path";
import uuid from "uuid/v4";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { initialize } from "./init";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("Initializing an HLD Repository.", () => {
  test("New directory is created under root directory with required service files.", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    logger.info(`creating randomTmpDir ${randomTmpDir}`);

    // addService call
    await initialize(randomTmpDir, false);

    // Check temp test directory exists
    expect(fs.existsSync(randomTmpDir)).toBe(true);

    // Verify new azure-pipelines created
    const filepaths = ["manifest-generation.yaml"].map(filename =>
      path.join(randomTmpDir, filename)
    );

    for (const filepath of filepaths) {
      expect(fs.existsSync(filepath)).toBe(true);
    }
  });
});
