import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import uuid from "uuid/v4";
import { checkoutCommitPushCreatePRLink } from "../../lib/gitutils";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import {
  createTestBedrockYaml,
  createTestMaintainersYaml
} from "../../test/mockFactory";
import { createService, isValidConfig } from "./create";
jest.mock("../../lib/gitutils");

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("validate pipeline config", () => {
  it("config is valid", () => {
    expect(
      isValidConfig(
        "testHelmChart",
        "testHelmRepo",
        "testHelmConfigBranch",
        "testHelmConfigGit",
        "/test/path",
        "testService",
        "test/packages",
        "test-maintainer",
        "test@maintainer.com",
        true,
        "testVariableGroup"
      )
    ).toBe(true);
  });

  it("invalid helmChartChart", () => {
    expect(
      isValidConfig(
        undefined,
        "testHelmRepo",
        "testHelmConfigBranch",
        "testHelmConfigGit",
        "/test/path",
        "testService",
        "test/packages",
        "test-maintainer",
        "test@maintainer.com",
        true,
        "testVariableGroup"
      )
    ).toBe(false);
  });

  it("invalid helmChartRepository", () => {
    expect(
      isValidConfig(
        "testHelmChart",
        undefined,
        "testHelmConfigBranch",
        "testHelmConfigGit",
        "/test/path",
        "testService",
        "test/packages",
        "test-maintainer",
        "test@maintainer.com",
        true,
        "testVariableGroup"
      )
    ).toBe(false);
  });

  it("invalid helmConfigBranch", () => {
    expect(
      isValidConfig(
        "testHelmChart",
        "testHelmRepo",
        undefined,
        "testHelmConfigGit",
        "/test/path",
        "testService",
        "test/packages",
        "test-maintainer",
        "test@maintainer.com",
        true,
        "testVariableGroup"
      )
    ).toBe(false);
  });

  it("invalid helmConfigGit", () => {
    expect(
      isValidConfig(
        "testHelmChart",
        "testHelmRepo",
        "testHelmConfigBranch",
        undefined,
        "/test/path",
        "testService",
        "test/packages",
        "test-maintainer",
        "test@maintainer.com",
        true,
        "testVariableGroup"
      )
    ).toBe(false);
  });

  it("invalid helmConfigPath", () => {
    expect(
      isValidConfig(
        "testHelmChart",
        "testHelmRepo",
        "testHelmConfigBranch",
        "testHelmConfigGit",
        undefined,
        "testService",
        "test/packages",
        "test-maintainer",
        "test@maintainer.com",
        true,
        "testVariableGroup"
      )
    ).toBe(false);
  });

  it("invalid serviceName", () => {
    expect(
      isValidConfig(
        "testHelmChart",
        "testHelmRepo",
        "testHelmConfigBranch",
        "testHelmConfigGit",
        "/test/path",
        undefined,
        "test/packages",
        "test-maintainer",
        "test@maintainer.com",
        true,
        "testVariableGroup"
      )
    ).toBe(false);
  });

  it("invalid packagesDir", () => {
    expect(
      isValidConfig(
        "testHelmChart",
        "testHelmRepo",
        "testHelmConfigBranch",
        "testHelmConfigGit",
        "/test/path",
        "testService",
        undefined,
        "test-maintainer",
        "test@maintainer.com",
        true,
        "testVariableGroup"
      )
    ).toBe(false);
  });

  it("invalid maintainerName", () => {
    expect(
      isValidConfig(
        "testHelmChart",
        "testHelmRepo",
        "testHelmConfigBranch",
        "testHelmConfigGit",
        "/test/path",
        "testService",
        "test/packages",
        undefined,
        "test@maintainer.com",
        true,
        "testVariableGroup"
      )
    ).toBe(false);
  });

  it("invalid maintainerEmail", () => {
    expect(
      isValidConfig(
        "testHelmChart",
        "testHelmRepo",
        "testHelmConfigBranch",
        "testHelmConfigGit",
        "/test/path",
        "testService",
        "test/packages",
        "test-maintainer",
        undefined,
        true,
        "testVariableGroup"
      )
    ).toBe(false);
  });

  it("invalid gitPush", () => {
    expect(
      isValidConfig(
        "testHelmChart",
        "testHelmRepo",
        "testHelmConfigBranch",
        "testHelmConfigGit",
        "/test/path",
        "testService",
        "test/packages",
        "test-maintainer",
        "test@maintainer.com",
        undefined,
        "testVariableGroup"
      )
    ).toBe(false);
  });

  it("invalid variableGroupName", () => {
    expect(
      isValidConfig(
        "testHelmChart",
        "testHelmRepo",
        "testHelmConfigBranch",
        "testHelmConfigGit",
        "/test/path",
        "testService",
        "test/packages",
        "test-maintainer",
        "test@maintainer.com",
        true,
        undefined
      )
    ).toBe(false);
  });
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
    const filepaths = ["azure-pipelines.yaml", "Dockerfile"].map(filename =>
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
    const variableGroupName = uuid();

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

    // Verify new azure-pipelines and Dockerfile created
    const filepaths = ["azure-pipelines.yaml", "Dockerfile"].map(filename =>
      path.join(serviceDirPath, filename)
    );

    for (const filepath of filepaths) {
      expect(fs.existsSync(filepath)).toBe(true);
    }

    // TODO: Verify root project bedrock.yaml and maintainers.yaml has been changed too.
  });

  test("New directory is created under '/packages' directory with required service files and git push enabled.", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    await writeSampleMaintainersFileToDir(
      path.join(randomTmpDir, "maintainers.yaml")
    );
    await writeSampleBedrockFileToDir(path.join(randomTmpDir, "bedrock.yaml"));

    const packageDir = "packages";
    const serviceName = uuid();
    const variableGroupName = uuid();

    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    // addService call
    await createService(randomTmpDir, serviceName, "packages", true);

    // Check temp test directory exists
    expect(fs.existsSync(randomTmpDir)).toBe(true);

    // Check service directory exists
    const serviceDirPath = path.join(randomTmpDir, packageDir, serviceName);
    expect(fs.existsSync(serviceDirPath)).toBe(true);

    // Verify new azure-pipelines and Dockerfile created
    const filepaths = ["azure-pipelines.yaml", "Dockerfile"].map(filename =>
      path.join(serviceDirPath, filename)
    );

    for (const filepath of filepaths) {
      expect(fs.existsSync(filepath)).toBe(true);
    }

    expect(checkoutCommitPushCreatePRLink).toHaveBeenCalled();
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
