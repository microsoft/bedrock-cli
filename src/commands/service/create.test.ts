import fs from "fs";
import path from "path";
import { promisify } from "util";
import uuid from "uuid/v4";
import { Bedrock } from "../../config";
import * as config from "../../config";
import * as bedrockYaml from "../../lib/bedrockYaml";
import { DEFAULT_CONTENT as BedrockMockedContent } from "../../lib/bedrockYaml";
import { SERVICE_PIPELINE_FILENAME } from "../../lib/constants";
import { checkoutCommitPushCreatePRLink } from "../../lib/gitutils";
import { createTempDir, removeDir } from "../../lib/ioUtil";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import {
  createTestBedrockYaml,
  createTestMaintainersYaml
} from "../../test/mockFactory";
import { createService, execute, fetchValues, ICommandValues } from "./create";
jest.mock("../../lib/gitutils");

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

beforeEach(() => {
  jest.clearAllMocks();
});

const mockValues: ICommandValues = {
  displayName: "",
  gitPush: false,
  helmChartChart: "",
  helmChartRepository: "",
  helmConfigBranch: "",
  helmConfigGit: "",
  helmConfigPath: "",
  k8sBackend: "",
  k8sBackendPort: "80",
  k8sPort: 80,
  maintainerEmail: "",
  maintainerName: "",
  middlewares: "",
  middlewaresArray: [],
  packagesDir: "",
  pathPrefix: "",
  pathPrefixMajorVersion: "",
  ringNames: [],
  variableGroups: []
};

const getMockValues = (): ICommandValues => {
  // TOFIX: if possible, can we use lodash?
  return JSON.parse(JSON.stringify(mockValues));
};

const validateDirNFiles = (
  dir: string,
  serviceName: string,
  values: ICommandValues
) => {
  // Check temp test directory exists
  expect(fs.existsSync(dir)).toBe(true);

  // Check service directory exists
  const serviceDirPath = path.join(dir, values.packagesDir, serviceName);
  expect(fs.existsSync(serviceDirPath)).toBe(true);

  // Verify new azure-pipelines created
  const filepaths = [SERVICE_PIPELINE_FILENAME, "Dockerfile"].map(filename =>
    path.join(serviceDirPath, filename)
  );

  for (const filepath of filepaths) {
    expect(fs.existsSync(filepath)).toBe(true);
  }
};

describe("Test fetchValues function", () => {
  it("Negative test: invalid port", () => {
    const values = getMockValues();
    values.k8sBackendPort = "abc";
    try {
      fetchValues(values);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeDefined();
    }
  });
  it("Postive test: with middlewares value", () => {
    jest.spyOn(config, "Bedrock").mockReturnValueOnce(BedrockMockedContent);
    const mocked = getMockValues();
    mocked.middlewares = "mid1, mid2"; // space after comma is intentional, expecting trimming to happen
    const result = fetchValues(mocked);
    expect(result.middlewaresArray).toEqual(["mid1", "mid2"]);
  });
  it("Postive test: with bedrock rings", () => {
    const mockedBedrockFileConfig = { ...BedrockMockedContent };
    mockedBedrockFileConfig.rings = {
      master: {},
      qa: {}
    };
    jest.spyOn(config, "Bedrock").mockReturnValueOnce(mockedBedrockFileConfig);
    const mocked = getMockValues();
    mocked.ringNames = ["master", "qa"];
    const result = fetchValues(mocked);
    expect(result.ringNames).toEqual(["master", "qa"]);
  });
  it("Postive test", () => {
    const mocked = getMockValues();
    jest.spyOn(config, "Bedrock").mockReturnValueOnce(BedrockMockedContent);
    const result = fetchValues(mocked);
    expect(result).toEqual(mocked);
  });
});
describe("Test execute function", () => {
  it("Negative test: without service name", async () => {
    const exitFn = jest.fn();
    await execute("", getMockValues(), exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("Negative test: missing bedrock file", async () => {
    const testServiceName = uuid();
    const exitFn = jest.fn();
    jest.spyOn(bedrockYaml, "fileInfo").mockImplementation(() => ({
      exist: false,
      hasVariableGroups: false
    }));
    try {
      await execute(testServiceName, getMockValues(), exitFn);
      expect(exitFn).toBeCalledTimes(1);
      expect(exitFn.mock.calls).toEqual([[1]]);
    } finally {
      removeDir(testServiceName); // housekeeping
    }
  });
  it("Negative test: missing bedrock variable groups", async () => {
    const testServiceName = uuid();
    const exitFn = jest.fn();
    jest.spyOn(bedrockYaml, "fileInfo").mockImplementation(() => ({
      exist: true,
      hasVariableGroups: false
    }));
    try {
      await execute(testServiceName, getMockValues(), exitFn);
      expect(exitFn).toBeCalledTimes(1);
      expect(exitFn.mock.calls).toEqual([[1]]);
    } finally {
      removeDir(testServiceName); // housekeeping
    }
  });
});

describe("Adding a service to a repo directory", () => {
  let randomTmpDir: string = "";
  beforeEach(async () => {
    // Create random directory to initialize
    randomTmpDir = createTempDir();
  });

  test("New service is created in projet root directory. No display name given, so this should throw an error.", async () => {
    await writeSampleMaintainersFileToDir(
      path.join(randomTmpDir, "maintainers.yaml")
    );
    await writeSampleBedrockFileToDir(path.join(randomTmpDir, "bedrock.yaml"));

    const values = getMockValues();
    values.packagesDir = "";
    values.k8sPort = 1337;
    const serviceName = ".";

    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    let hasError = false;
    try {
      await createService(randomTmpDir, serviceName, values);
    } catch (err) {
      hasError = true;
      expect(err.message).toBe(
        "Cannot create service pipeline due to serviceName being '.'. Please include a displayName if you are trying to create a service in your project root directory."
      );
    }
    expect(hasError).toBe(true);
  });

  test("New service is created in projet root directory. With display name given, so this work fine.", async () => {
    await writeSampleMaintainersFileToDir(
      path.join(randomTmpDir, "maintainers.yaml")
    );
    await writeSampleBedrockFileToDir(path.join(randomTmpDir, "bedrock.yaml"));

    const values = getMockValues();
    values.packagesDir = "";
    values.k8sPort = 1337;
    values.displayName = "my-service-name";
    const serviceName = ".";

    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    let hasError = false;
    try {
      await createService(randomTmpDir, serviceName, values);
    } catch (err) {
      hasError = true;
    }
    expect(hasError).toBe(false);

    await createService(randomTmpDir, serviceName, values);
    validateDirNFiles(randomTmpDir, serviceName, values);

    // TODO: Verify root project bedrock.yaml and maintainers.yaml has been changed too.
    const bedrock = Bedrock(randomTmpDir);
    const newService = bedrock.services["./"];
    expect(newService).toBeDefined();
    expect(newService.k8sBackendPort).toBe(values.k8sPort);
    expect(newService.displayName).toBe(values.displayName);
  });

  test("New directory is created under root directory with required service files.", async () => {
    await writeSampleMaintainersFileToDir(
      path.join(randomTmpDir, "maintainers.yaml")
    );
    await writeSampleBedrockFileToDir(path.join(randomTmpDir, "bedrock.yaml"));

    const values = getMockValues();
    values.packagesDir = "";
    values.k8sPort = 1337;
    const serviceName = uuid();

    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    await createService(randomTmpDir, serviceName, values);
    validateDirNFiles(randomTmpDir, serviceName, values);

    // TODO: Verify root project bedrock.yaml and maintainers.yaml has been changed too.
    const bedrock = Bedrock(randomTmpDir);
    const newService = bedrock.services["./" + serviceName];
    expect(newService).toBeDefined();
    expect(newService.k8sBackendPort).toBe(values.k8sPort);
  });

  test("New directory is created under '/packages' directory with required service files.", async () => {
    await writeSampleMaintainersFileToDir(
      path.join(randomTmpDir, "maintainers.yaml")
    );
    await writeSampleBedrockFileToDir(path.join(randomTmpDir, "bedrock.yaml"));

    const values = getMockValues();
    values.packagesDir = "packages";
    values.k8sPort = 1337;
    const serviceName = uuid();

    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    // addService call
    await createService(randomTmpDir, serviceName, values);
    validateDirNFiles(randomTmpDir, serviceName, values);

    // TODO: Verify root project bedrock.yaml and maintainers.yaml has been changed too.
  });

  test("New directory is created under '/packages' directory with required service files and git push enabled.", async () => {
    await writeSampleMaintainersFileToDir(
      path.join(randomTmpDir, "maintainers.yaml")
    );
    await writeSampleBedrockFileToDir(path.join(randomTmpDir, "bedrock.yaml"));

    const values = getMockValues();
    values.packagesDir = "packages";
    values.gitPush = true;
    values.k8sPort = 1337;
    const serviceName = uuid();

    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    await createService(randomTmpDir, serviceName, values);
    validateDirNFiles(randomTmpDir, serviceName, values);

    expect(checkoutCommitPushCreatePRLink).toHaveBeenCalled();
  });

  test("empty middleware list is created when none provided", async () => {
    await writeSampleMaintainersFileToDir(
      path.join(randomTmpDir, "maintainers.yaml")
    );
    await writeSampleBedrockFileToDir(path.join(randomTmpDir, "bedrock.yaml"));

    const values = getMockValues();
    values.k8sPort = 1337;
    const serviceName = uuid();
    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    // create service with no middleware
    await createService(randomTmpDir, serviceName, values);
    validateDirNFiles(randomTmpDir, serviceName, values);

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

    const values = getMockValues();
    values.k8sPort = 1337;
    values.middlewaresArray = ["foo", "bar", "baz"];

    const serviceName = uuid();
    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    await createService(randomTmpDir, serviceName, values);
    validateDirNFiles(randomTmpDir, serviceName, values);

    const bedrockConfig = Bedrock(randomTmpDir);

    // check that the added service has the expected middlewares
    for (const [servicePath, service] of Object.entries(
      bedrockConfig.services
    )) {
      if (servicePath.includes(serviceName)) {
        expect(service.middlewares).toBeDefined();
        expect(Array.isArray(service.middlewares)).toBe(true);
        expect(service.middlewares?.length).toBe(
          values.middlewaresArray.length
        );
        expect(service.middlewares).toStrictEqual(values.middlewaresArray);
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
