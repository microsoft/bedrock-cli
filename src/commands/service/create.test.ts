import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import uuid from "uuid/v4";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import {
  createTestBedrockYaml,
  createTestMaintainersYaml
} from "../../test/mockFactory";
import { createService } from "./create";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("Adding a service to a repo directory", () => {
  test("New directory is created under root directory with required service files.", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    await writeSampleMaintainersFileToDir(
      path.join(randomTmpDir, "maintainers.yaml")
    );
    await writeSampleBedrockFileToDir(path.join(randomTmpDir, "bedrock.yaml"));

    const packageDir = "";

    const serviceName = uuid();

    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    // addService call
    await createService(randomTmpDir, serviceName, packageDir, false);

    // Check temp test directory exists
    expect(fs.existsSync(randomTmpDir)).toBe(true);

    // Check service directory exists
    const serviceDirPath = path.join(randomTmpDir, packageDir, serviceName);
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

  test("New directory is created under '/packages' directory with required service files.", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    await writeSampleMaintainersFileToDir(
      path.join(randomTmpDir, "maintainers.yaml")
    );
    await writeSampleBedrockFileToDir(path.join(randomTmpDir, "bedrock.yaml"));

    const packageDir = "packages";

    const serviceName = uuid();
    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    // addService call
    await createService(randomTmpDir, serviceName, "packages", false);

    // Check temp test directory exists
    expect(fs.existsSync(randomTmpDir)).toBe(true);

    // Check service directory exists
    const serviceDirPath = path.join(randomTmpDir, packageDir, serviceName);
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

const writeSampleMaintainersFileToDir = async (maintainersFilePath: string) => {
  await promisify(fs.writeFile)(
    maintainersFilePath,
    createTestMaintainersYaml(),
    "utf8"
  );
};

const writeSampleBedrockFileToDir = async (bedrockFilePath: string) => {
  await promisify(fs.writeFile)(
    bedrockFilePath,
    createTestBedrockYaml(),
    "utf8"
  );
};
