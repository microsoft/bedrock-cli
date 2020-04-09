import fs from "fs";
import path from "path";
import { promisify } from "util";
import uuid = require("uuid/v4");
import { Bedrock } from "../../config";
import * as config from "../../config";
import * as bedrockYaml from "../../lib/bedrockYaml";
import { SERVICE_PIPELINE_FILENAME } from "../../lib/constants";
import { checkoutCommitPushCreatePRLink } from "../../lib/gitutils";
import { createTempDir, removeDir } from "../../lib/ioUtil";
import * as dns from "../../lib/net/dns";
import { deepClone } from "../../lib/util";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger,
} from "../../logger";
import {
  createTestBedrockYaml,
  createTestMaintainersYaml,
} from "../../test/mockFactory";
import {
  assertValidDnsInputs,
  createService,
  execute,
  fetchValues,
  CommandValues,
  validateGitUrl,
} from "./create";
import { BedrockServiceConfig } from "../../types";

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

const mockValues: CommandValues = {
  gitPush: false,
  helmChartChart: "",
  helmChartRepository: "",
  helmConfigAccessTokenVariable: "ACCESS_TOKEN_SECRET",
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
  variableGroups: [],
};

const getMockValues = (): CommandValues => {
  return deepClone(mockValues);
};

const validateDirNFiles = (
  dir: string,
  servicePath: string,
  values: CommandValues
): void => {
  // Check temp test directory exists
  expect(fs.existsSync(dir)).toBe(true);

  // Check service directory exists
  const serviceDirPath = path.join(dir, values.packagesDir, servicePath);
  expect(fs.existsSync(serviceDirPath)).toBe(true);

  // Verify new azure-pipelines created
  const filepaths = [SERVICE_PIPELINE_FILENAME, "Dockerfile"].map((filename) =>
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

  it("Positive test: with middlewares value", () => {
    jest
      .spyOn(config, "Bedrock")
      .mockReturnValueOnce(bedrockYaml.DEFAULT_CONTENT());
    const mocked = getMockValues();
    mocked.middlewares = "mid1, mid2"; // space after comma is intentional, expecting trimming to happen
    const result = fetchValues(mocked);
    expect(result.middlewaresArray).toEqual(["mid1", "mid2"]);
  });

  it("Positive test: with bedrock rings", () => {
    const mockedBedrockFileConfig = { ...bedrockYaml.DEFAULT_CONTENT() };
    mockedBedrockFileConfig.rings = {
      master: {},
      qa: {},
    };
    jest.spyOn(config, "Bedrock").mockReturnValueOnce(mockedBedrockFileConfig);
    const mocked = getMockValues();
    mocked.ringNames = ["master", "qa"];
    const result = fetchValues(mocked);
    expect(result.ringNames).toEqual(["master", "qa"]);
  });

  it("Positive test", () => {
    const mocked = getMockValues();
    jest
      .spyOn(config, "Bedrock")
      .mockReturnValueOnce(bedrockYaml.DEFAULT_CONTENT());
    const result = fetchValues(mocked);
    expect(result).toEqual(mocked);
  });
});

describe("isValidDnsInputs", () => {
  test("valid inputs does not throw", () => {
    expect(() =>
      assertValidDnsInputs({
        k8sBackend: "my-service",
        pathPrefix: "service",
        pathPrefixMajorVersion: "v1",
      })
    ).not.toThrow();
  });

  test("invalid inputs throws", () => {
    expect(() =>
      assertValidDnsInputs({
        k8sBackend: "-not_dns_compliant",
        pathPrefix: "",
        pathPrefixMajorVersion: "",
      })
    ).toThrow();

    expect(() =>
      assertValidDnsInputs({
        k8sBackend: "",
        pathPrefix: "-not_dns_compliant",
        pathPrefixMajorVersion: "",
      })
    ).toThrow();

    expect(() =>
      assertValidDnsInputs({
        k8sBackend: "",
        pathPrefix: "",
        pathPrefixMajorVersion: "-not_dns_compliant",
      })
    ).toThrow();
  });
});

describe("Test execute function", () => {
  it("Negative test: with non-dns compliant values", async () => {
    const exitFn = jest.fn();
    jest.spyOn(dns, "assertIsValid");
    await execute("-non_dns@compliant", "foo", { ...getMockValues() }, exitFn);
    expect(dns.assertIsValid).toHaveBeenCalledTimes(1);
  });

  it("Negative test: without service name", async () => {
    const exitFn = jest.fn();
    await execute("", "my/service/path", getMockValues(), exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });

  it("Negative test: missing bedrock file", async () => {
    const testServiceName = uuid();
    const testServicePath = "my/service/path";
    const exitFn = jest.fn();

    jest.spyOn(bedrockYaml, "fileInfo").mockImplementation(() => ({
      exist: false,
      hasVariableGroups: false,
    }));

    try {
      await execute(testServiceName, testServicePath, getMockValues(), exitFn);
      expect(exitFn).toBeCalledTimes(1);
      expect(exitFn.mock.calls).toEqual([[1]]);
    } finally {
      removeDir(testServiceName); // housekeeping
    }
  });

  it("Negative test: missing bedrock variable groups", async () => {
    const testServiceName = uuid();
    const testServicePath = "my/service/path";
    const exitFn = jest.fn();

    jest.spyOn(bedrockYaml, "fileInfo").mockImplementation(() => ({
      exist: true,
      hasVariableGroups: false,
    }));

    try {
      await execute(testServiceName, testServicePath, getMockValues(), exitFn);
      expect(exitFn).toBeCalledTimes(1);
      expect(exitFn.mock.calls).toEqual([[1]]);
    } finally {
      removeDir(testServiceName); // housekeeping
    }
  });
});

describe("Validate Git URLs", () => {
  it("Should error when providing an invalid git url", () => {
    const exitFn = jest.fn();
    const helmConfigPath = "dev.azure.com/foo/bar";

    validateGitUrl(helmConfigPath, exitFn);
    expect(exitFn).toBeCalledTimes(1);
  });

  it("Should not error when providing a valid github https url", () => {
    const exitFn = jest.fn();
    const helmConfigPath = "https://github.com/CatalystCode/spk.git";

    validateGitUrl(helmConfigPath, exitFn);
    expect(exitFn).toBeCalledTimes(0);
  });

  it("Should not error when providing a valid azdo https url", () => {
    const exitFn = jest.fn();
    const helmConfigPath =
      "https://dev@dev.azure.com/catalystcode/project/_git/repo";

    validateGitUrl(helmConfigPath, exitFn);
    expect(exitFn).toBeCalledTimes(0);
  });

  it("Should not error when providing a valid azdo git+ssh url", () => {
    const exitFn = jest.fn();
    const helmConfigPath = "git@ssh.dev.azure.com:v3/CatalystCode/project/repo";

    validateGitUrl(helmConfigPath, exitFn);
    expect(exitFn).toBeCalledTimes(0);
  });

  it("Should not error when providing a valid github git+ssh url", () => {
    const exitFn = jest.fn();
    const helmConfigPath = "git@github.com:CatalystCode/spk.git";

    validateGitUrl(helmConfigPath, exitFn);
    expect(exitFn).toBeCalledTimes(0);
  });
});

const writeSampleMaintainersFileToDir = async (
  maintainersFilePath: string
): Promise<void> => {
  await promisify(fs.writeFile)(
    maintainersFilePath,
    createTestMaintainersYaml(),
    "utf8"
  );
};

const writeSampleBedrockFileToDir = async (
  bedrockFilePath: string
): Promise<void> => {
  await promisify(fs.writeFile)(
    bedrockFilePath,
    createTestBedrockYaml(),
    "utf8"
  );
};

describe("Adding a service to a repo directory", () => {
  let randomTmpDir = "";
  beforeEach(() => {
    // Create random directory to initialize
    randomTmpDir = createTempDir();
  });

  test("New service is created in project root directory. With display name given, so this works fine.", async () => {
    await writeSampleMaintainersFileToDir(
      path.join(randomTmpDir, "maintainers.yaml")
    );
    await writeSampleBedrockFileToDir(path.join(randomTmpDir, "bedrock.yaml"));

    const values = getMockValues();
    values.packagesDir = "";
    values.k8sPort = 1337;
    values.helmConfigAccessTokenVariable = "SOME_ENV_VAR";
    const serviceName = "my-service-name";
    const servicePath = ".";

    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    expect(createService(randomTmpDir, serviceName, servicePath, values))
      .resolves;
    validateDirNFiles(randomTmpDir, servicePath, values);

    // TODO: Verify root project bedrock.yaml and maintainers.yaml has been changed too.
    const bedrock = Bedrock(randomTmpDir);
    const newService = bedrock.services.find(
      (s) => s.displayName === "my-service-name"
    ) as BedrockServiceConfig;
    expect(newService).toStrictEqual(
      expect.objectContaining({
        path: "./",
        k8sBackendPort: values.k8sPort,
        displayName: serviceName,
        helm: {
          chart: expect.objectContaining({
            accessTokenVariable: "SOME_ENV_VAR",
          }),
        },
      })
    );
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
    const servicePath = uuid();

    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    await createService(randomTmpDir, serviceName, servicePath, values);
    validateDirNFiles(randomTmpDir, servicePath, values);

    // TODO: Verify root project bedrock.yaml and maintainers.yaml has been changed too.
    const bedrock = Bedrock(randomTmpDir);
    const newService = bedrock.services.find(
      (s) => s.displayName === serviceName
    ) as BedrockServiceConfig;
    expect(newService).toStrictEqual(
      expect.objectContaining({
        path: "./" + servicePath,
        k8sBackendPort: values.k8sPort,
        displayName: serviceName,
      })
    );
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
    const servicePath = uuid();

    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    // addService call
    await createService(randomTmpDir, serviceName, servicePath, values);
    validateDirNFiles(randomTmpDir, servicePath, values);

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
    const servicePath = uuid();

    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    await createService(randomTmpDir, serviceName, servicePath, values);
    validateDirNFiles(randomTmpDir, servicePath, values);

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
    const servicePath = uuid();

    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    // create service with no middleware
    await createService(randomTmpDir, serviceName, servicePath, values);
    validateDirNFiles(randomTmpDir, servicePath, values);

    const bedrockConfig = Bedrock(randomTmpDir);

    // check the added service has an empty list for middlewares
    for (const service of bedrockConfig.services) {
      if (service.displayName === serviceName) {
        expect(service.middlewares).toBeDefined();
        if (service.middlewares) {
          expect(Array.isArray(service.middlewares)).toBe(true);
          expect(service.middlewares.length).toBe(0);
        }
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
    const servicePath = uuid();
    logger.info(
      `creating randomTmpDir ${randomTmpDir} and service ${serviceName}`
    );

    await createService(randomTmpDir, serviceName, servicePath, values);
    validateDirNFiles(randomTmpDir, servicePath, values);

    const bedrockConfig = Bedrock(randomTmpDir);

    // check that the added service has the expected middlewares
    for (const service of bedrockConfig.services) {
      if (service.displayName === serviceName) {
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
