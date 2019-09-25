import fs from "fs";
import os from "os";
import path from "path";
import uuid from "uuid/v4";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { createService } from "./create";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("Adding a service to a repo directory", () => {
  test("maintainers.yaml, and azure-pipelines.yaml gets generated in the newly created service directory", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    const serviceName = uuid();
    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    // addService call
    await createService(randomTmpDir, serviceName);

    // Check temp test directory exists
    expect(fs.existsSync(randomTmpDir)).toBe(true);

    // Check service directory exists
    const serviceDirPath = path.join(randomTmpDir, serviceName);
    expect(fs.existsSync(serviceDirPath)).toBe(true);

    // Verify new azure-pipelines created
    const filepaths = ["azure-pipelines.yaml"].map(filename =>
      path.join(serviceDirPath, filename)
    );

    for (const filepath of filepaths) {
      expect(fs.existsSync(filepath)).toBe(true);
    }

    // TODO: Verify root project bedrock.yaml and maintainers.yaml has been changed too.
  });
});
