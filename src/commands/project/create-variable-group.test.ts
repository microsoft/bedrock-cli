import fs from "fs";
import yaml from "js-yaml";
import mockFs from "mock-fs";
import path from "path";
import uuid from "uuid/v4";
import { readYaml, write } from "../../config";
import {
  create as createBedrockYaml,
  isExists as isBedrockFileExists,
  read as readBedrockFile
} from "../../lib/bedrockYaml";
import { PROJECT_PIPELINE_FILENAME } from "../../lib/constants";
import { IAzureDevOpsOpts } from "../../lib/git";
import { createTempDir } from "../../lib/ioUtil";
import * as pipelineVariableGroup from "../../lib/pipelines/variableGroup";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import {
  createTestBedrockYaml,
  createTestHldLifecyclePipelineYaml
} from "../../test/mockFactory";
import { IAzurePipelinesYaml, IBedrockFile } from "../../types";
import {
  create,
  execute,
  setVariableGroupInBedrockFile,
  updateLifeCyclePipeline
} from "./create-variable-group";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

beforeEach(() => {
  jest.clearAllMocks();
});

const registryName = uuid();
const variableGroupName = uuid();
const hldRepoUrl = uuid();
const servicePrincipalId = uuid();
const servicePrincipalPassword: string = uuid();
const tenant = uuid();
const orgName = uuid();
const project = uuid();
const personalAccessToken = uuid();

describe("test execute function", () => {
  it("missing variable name", async () => {
    const exitFn = jest.fn();
    await execute(
      "",
      {
        hldRepoUrl,
        orgName,
        personalAccessToken,
        project,
        registryName,
        servicePrincipalId,
        servicePrincipalPassword,
        tenant
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
  });
  it("missing registry name", async () => {
    const exitFn = jest.fn();
    await execute(
      variableGroupName,
      {
        hldRepoUrl,
        orgName,
        personalAccessToken,
        project,
        registryName: undefined,
        servicePrincipalId,
        servicePrincipalPassword,
        tenant
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
  });
});

describe("create", () => {
  test("Should fail with empty variable group arguments", async () => {
    const accessOpts: IAzureDevOpsOpts = {
      orgName,
      personalAccessToken,
      project
    };

    let invalidDataError: Error | undefined;
    try {
      logger.info("calling create");
      await create("", "", "", "", "", "", accessOpts);
    } catch (err) {
      invalidDataError = err;
    }
    expect(invalidDataError).toBeDefined();
  });

  test("Should pass with variable group arguments", async () => {
    // mock the function that calls the Azdo project's Task API
    // because unit test is unable to reach this API.
    // all the validation of parameters passed into create
    // function succeeds
    const doAddVariableGroupMock = jest.spyOn(
      pipelineVariableGroup,
      "doAddVariableGroup"
    );
    doAddVariableGroupMock.mockImplementation(() => {
      return Promise.resolve({});
    });

    const accessOpts: IAzureDevOpsOpts = {
      orgName,
      personalAccessToken,
      project
    };

    try {
      logger.info("calling create");
      await create(
        variableGroupName,
        registryName,
        hldRepoUrl,
        servicePrincipalId,
        servicePrincipalPassword,
        tenant,
        accessOpts
      );
    } catch (err) {
      // should not reach here
      expect(true).toBe(false);
    }
  });
});

describe("setVariableGroupInBedrockFile", () => {
  test("Should fail with empty arguments", async () => {
    let invalidGroupNameError: Error | undefined;
    try {
      logger.info("calling create");
      await setVariableGroupInBedrockFile("", "");
    } catch (err) {
      invalidGroupNameError = err;
    }
    expect(invalidGroupNameError).toBeDefined();
  });

  test("Should fail with empty variable group name", async () => {
    let invalidGroupNameError: Error | undefined;
    try {
      logger.info("calling create");
      await setVariableGroupInBedrockFile(uuid(), "");
    } catch (err) {
      invalidGroupNameError = err;
    }
    expect(invalidGroupNameError).toBeDefined();
  });

  test("Should fail with empty directory", async () => {
    let invalidGroupNameError: Error | undefined;
    try {
      logger.info("calling create");
      await setVariableGroupInBedrockFile("", uuid());
    } catch (err) {
      invalidGroupNameError = err;
    }
    expect(invalidGroupNameError).toBeDefined();
  });

  test("Should fail adding a variable group name when no bedrock file exists", async () => {
    // Create random directory to initialize
    const randomTmpDir = createTempDir();
    let noFileError: Error | undefined;

    try {
      await setVariableGroupInBedrockFile(randomTmpDir, variableGroupName);
    } catch (err) {
      logger.info(`${err}`);
      noFileError = err;
    }
    expect(noFileError).toBeDefined();
  });

  test("Should pass adding a valid variable group name when bedrock file exists with empty variableGroups", async () => {
    // Create random directory to initialize
    const randomTmpDir = createBedrockYaml();

    await setVariableGroupInBedrockFile(randomTmpDir, variableGroupName);

    expect(isBedrockFileExists(randomTmpDir)).toBe(true);
    const bedrockFile = readBedrockFile(randomTmpDir);

    logger.info(`filejson: ${JSON.stringify(bedrockFile)}`);
    expect(bedrockFile.variableGroups![0]).toBe(variableGroupName);
  });

  test("Should pass adding a valid variable group name when bedrock file exists when variableGroups length is > 0", async () => {
    // Create random directory to initialize

    const prevariableGroupName = uuid();
    logger.info(`prevariableGroupName: ${prevariableGroupName}`);
    const bedrockFileData: IBedrockFile = {
      rings: {}, // rings is optional but necessary to create a bedrock file in config.write method
      services: {}, // service property is not optional so set it to null
      variableGroups: [prevariableGroupName]
    };

    const randomTmpDir = createBedrockYaml("", bedrockFileData);
    await setVariableGroupInBedrockFile(randomTmpDir, variableGroupName);
    expect(isBedrockFileExists(randomTmpDir)).toBe(true);

    const bedrockFile = readBedrockFile(randomTmpDir);
    logger.info(`filejson: ${JSON.stringify(bedrockFile)}`);
    expect(bedrockFile.variableGroups![0]).toBe(prevariableGroupName);
    expect(bedrockFile.variableGroups![1]).toBe(variableGroupName);
  });
});

describe("updateLifeCyclePipeline", () => {
  beforeAll(() => {
    mockFs({
      "bedrock.yaml": createTestBedrockYaml() as any
    });
  });

  afterAll(() => {
    mockFs.restore();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Should fail with empty arguments", async () => {
    let invalidDirError: Error | undefined;
    try {
      await updateLifeCyclePipeline("");
    } catch (err) {
      invalidDirError = err;
    }
    expect(invalidDirError).toBeDefined();
  });

  test("Should fail adding a variable group name when no pipeline yaml file exists", async () => {
    // Create random directory to initialize
    const randomTmpDir = createTempDir();
    let noFileError: Error | undefined;

    try {
      await updateLifeCyclePipeline(randomTmpDir);
    } catch (err) {
      noFileError = err;
    }
    expect(noFileError).toBeDefined();
  });

  test("Should pass adding variable groups when bedrock file exists with empty variableGroups", async () => {
    // Create random directory to initialize
    const randomTmpDir = createTempDir();

    const defaultBedrockFileObject = createTestBedrockYaml(
      false
    ) as IBedrockFile;

    write(defaultBedrockFileObject, randomTmpDir);

    const hldFilePath = path.join(randomTmpDir, PROJECT_PIPELINE_FILENAME);

    const hldLifeCycleFile: IAzurePipelinesYaml = createTestHldLifecyclePipelineYaml(
      false
    ) as IAzurePipelinesYaml;

    const asYaml = yaml.safeDump(hldLifeCycleFile, {
      lineWidth: Number.MAX_SAFE_INTEGER
    });

    fs.writeFileSync(hldFilePath, asYaml);

    await updateLifeCyclePipeline(randomTmpDir);

    const hldLifeCycleYaml = readYaml<IAzurePipelinesYaml>(hldFilePath);
    logger.info(`filejson: ${JSON.stringify(hldLifeCycleYaml)}`);
    expect(hldLifeCycleYaml.variables!.length).toBeLessThanOrEqual(0);
  });

  test("Should pass adding variable groups when bedrock file exists with one variableGroup", async () => {
    // Create random directory to initialize
    const randomTmpDir = createTempDir();
    logger.info(`random dir: ${randomTmpDir})`);

    const defaultBedrockFileObject = createTestBedrockYaml(
      false
    ) as IBedrockFile;

    // add new variabe group
    defaultBedrockFileObject.variableGroups = [
      ...(defaultBedrockFileObject.variableGroups ?? []),
      variableGroupName
    ];

    write(defaultBedrockFileObject, randomTmpDir);

    const hldFilePath = path.join(randomTmpDir, PROJECT_PIPELINE_FILENAME);

    const hldLifeCycleFile: IAzurePipelinesYaml = createTestHldLifecyclePipelineYaml(
      false
    ) as IAzurePipelinesYaml;

    const asYaml = yaml.safeDump(hldLifeCycleFile, {
      lineWidth: Number.MAX_SAFE_INTEGER
    });

    fs.writeFileSync(hldFilePath, asYaml);

    await updateLifeCyclePipeline(randomTmpDir);

    const hldLifeCycleYaml = readYaml<IAzurePipelinesYaml>(hldFilePath);
    logger.info(`filejson: ${JSON.stringify(hldLifeCycleYaml)}`);
    expect(hldLifeCycleYaml.variables![0]).toEqual({
      group: variableGroupName
    });
  });
});
