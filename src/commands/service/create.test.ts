import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import uuid from "uuid/v4";
import { Bedrock } from "../../config";
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
  const configValues: any[] = [
    "testHelmChart",
    "testHelmRepo",
    "testHelmConfigBranch",
    "testHelmConfigGit",
    "/test/path",
    "testService",
    "test/packages",
    "test-maintainer",
    "test@maintainer.com",
    "my,middleware,string",
    true,
    "testVariableGroup",
    "testDisplayName"
  ];

  it("config is valid", () => {
    expect(isValidConfig.apply(undefined, configValues as any)).toBe(true);
  });

  it("undefined parameters", () => {
    for (const i of configValues.keys()) {
      const configValuesWithInvalidValue = configValues.map((value, j) =>
        i === j ? undefined : value
      );
      expect(
        isValidConfig.apply(undefined, configValuesWithInvalidValue as any)
      ).toBe(false);
    }
  });
});

describe("Adding a service to a repo directory", () => {
  let randomTmpDir: string = "";
  beforeEach(async () => {
    // Create random directory to initialize
    randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);
  });

  test("New directory is created under root directory with required service files.", async () => {
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

  test("empty middleware list is created when none provided", async () => {
    await writeSampleMaintainersFileToDir(
      path.join(randomTmpDir, "maintainers.yaml")
    );
    await writeSampleBedrockFileToDir(path.join(randomTmpDir, "bedrock.yaml"));

    const packageDir = "";
    const serviceName = uuid();
    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    // create service with no middleware
    await createService(randomTmpDir, serviceName, packageDir, false);

    // Check temp test directory exists
    expect(fs.existsSync(randomTmpDir)).toBe(true);

    // Check service directory exists
    const serviceDirPath = path.join(randomTmpDir, packageDir, serviceName);
    expect(fs.existsSync(serviceDirPath)).toBe(true);

    // get bedrock config
    const bedrockConfig = Bedrock(randomTmpDir);

    // check the added service has an empty list for middlewares
    for (const [servicePath, service] of Object.entries(
      bedrockConfig.services
    )) {
      if (servicePath.includes(serviceName)) {
        expect(service.middlewares).toBeDefined();
        expect(Array.isArray(service.middlewares)).toBe(true);
        expect(service.middlewares!.length).toBe(0);
      }
    }
  });

  test("middleware gets added when provided", async () => {
    await writeSampleMaintainersFileToDir(
      path.join(randomTmpDir, "maintainers.yaml")
    );
    await writeSampleBedrockFileToDir(path.join(randomTmpDir, "bedrock.yaml"));

    const packageDir = "";
    const serviceName = uuid();
    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    // add some middlewares
    const middlewares = ["foo", "bar", "baz"];
    await createService(randomTmpDir, serviceName, packageDir, false, {
      middlewares
    });

    // Check temp test directory exists
    expect(fs.existsSync(randomTmpDir)).toBe(true);

    // Check service directory exists
    const serviceDirPath = path.join(randomTmpDir, packageDir, serviceName);
    expect(fs.existsSync(serviceDirPath)).toBe(true);

    // get bedrock config
    const bedrockConfig = Bedrock(randomTmpDir);

    // check that the added service has the expected middlewares
    for (const [servicePath, service] of Object.entries(
      bedrockConfig.services
    )) {
      if (servicePath.includes(serviceName)) {
        expect(service.middlewares).toBeDefined();
        expect(Array.isArray(service.middlewares)).toBe(true);
        expect(service.middlewares?.length).toBe(middlewares.length);
        expect(service.middlewares).toStrictEqual(middlewares);
      }
    }
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