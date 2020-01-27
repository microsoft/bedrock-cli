import fs from "fs";
import yaml from "js-yaml";
import mockFs from "mock-fs";
import os from "os";
import path from "path";
import uuid from "uuid/v4";
import { readYaml, write } from "../../config";
import { IAzureDevOpsOpts } from "../../lib/git";
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
  isBedrockFileExists,
  setVariableGroupInBedrockFile,
  updateLifeCyclePipeline,
  validateRequiredArguments
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

const accessopts: IAzureDevOpsOpts = {
  orgName,
  personalAccessToken,
  project
};

describe("validateRequiredArguments", () => {
  test("Should fail when all required arguments specified with empty values", async () => {
    const opts: IAzureDevOpsOpts = {};

    const errors: string[] = validateRequiredArguments(
      "",
      "",
      "",
      "",
      "",
      opts
    );
    logger.info(`length: ${errors.length}`);
    expect(errors.length).toBe(8);
  });

  test("Should fail when all required arguments are not specified", async () => {
    const opts: IAzureDevOpsOpts = {};
    const errors: string[] = validateRequiredArguments(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      opts
    );
    logger.info(`length: ${errors.length}`);
    expect(errors.length).toBe(8);
  });

  test("Should fail when registryName argument is not specified", async () => {
    const errors: string[] = validateRequiredArguments(
      undefined,
      hldRepoUrl,
      servicePrincipalId,
      servicePrincipalPassword,
      tenant,
      accessopts
    );
    logger.info(`length: ${errors.length}`);
    expect(errors.length).toBe(1);
  });

  test("Should fail when hldRepoUrl argument is not specified", async () => {
    const errors: string[] = validateRequiredArguments(
      registryName,
      undefined,
      servicePrincipalId,
      servicePrincipalPassword,
      tenant,
      accessopts
    );
    logger.info(`length: ${errors.length}`);
    expect(errors.length).toBe(1);
  });

  test("Should fail when servicePrincipalId argument is not specified", async () => {
    const errors: string[] = validateRequiredArguments(
      registryName,
      hldRepoUrl,
      undefined,
      servicePrincipalPassword,
      tenant,
      accessopts
    );
    logger.info(`length: ${errors.length}`);
    expect(errors.length).toBe(1);
  });

  test("Should fail when servicePrincipalPassword argument is not specified", async () => {
    const errors: string[] = validateRequiredArguments(
      registryName,
      hldRepoUrl,
      servicePrincipalId,
      undefined,
      tenant,
      accessopts
    );
    logger.info(`length: ${errors.length}`);
    expect(errors.length).toBe(1);
  });

  test("Should fail when tenant argument is not specified", async () => {
    const errors: string[] = validateRequiredArguments(
      registryName,
      hldRepoUrl,
      servicePrincipalId,
      servicePrincipalPassword,
      undefined,
      accessopts
    );
    logger.info(`length: ${errors.length}`);
    expect(errors.length).toBe(1);
  });
});

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
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

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
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    // create bedrock file to simulate the the use case that `spk project init` ran before
    const bedrockFileData: IBedrockFile = {
      rings: {},
      services: {},
      variableGroups: []
    };

    const asYaml = yaml.safeDump(bedrockFileData, {
      lineWidth: Number.MAX_SAFE_INTEGER
    });

    fs.writeFileSync(path.join(randomTmpDir, "bedrock.yaml"), asYaml);

    await setVariableGroupInBedrockFile(randomTmpDir, variableGroupName);

    const bedrockFilePath = path.join(randomTmpDir, "bedrock.yaml");
    expect(fs.existsSync(bedrockFilePath)).toBe(true);

    const bedrockFile = readYaml<IBedrockFile>(bedrockFilePath);

    logger.info(`filejson: ${JSON.stringify(bedrockFile)}`);
    expect(bedrockFile.variableGroups![0]).toBe(variableGroupName);
  });

  test("Should pass adding a valid variable group name when bedrock file exists when variableGroups length is > 0", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    const prevariableGroupName = uuid();
    logger.info(`prevariableGroupName: ${prevariableGroupName}`);
    const bedrockFileData: IBedrockFile = {
      rings: {}, // rings is optional but necessary to create a bedrock file in config.write method
      services: {}, // service property is not optional so set it to null
      variableGroups: [prevariableGroupName]
    };

    write(bedrockFileData, randomTmpDir);

    await setVariableGroupInBedrockFile(randomTmpDir, variableGroupName);

    const filePath = path.join(randomTmpDir, "bedrock.yaml");
    expect(fs.existsSync(filePath)).toBe(true);

    const bedrockFile = readYaml<IBedrockFile>(filePath);
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
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

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
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);
    const writeSpy = jest.spyOn(fs, "writeFileSync");

    const defaultBedrockFileObject = createTestBedrockYaml(
      false
    ) as IBedrockFile;

    write(defaultBedrockFileObject, randomTmpDir);

    const hldFilePath = path.join(randomTmpDir, "hld-lifecycle.yaml");

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
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);
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

    const hldFilePath = path.join(randomTmpDir, "hld-lifecycle.yaml");

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

describe("isBedrockFileExists", () => {
  test("Should fail when empty file directory is passed", async () => {
    let invalidDirError: Error | undefined;

    try {
      logger.info("calling create");
      await isBedrockFileExists("");
    } catch (err) {
      invalidDirError = err;
    }
    expect(invalidDirError).toBeDefined();
  });

  test("Should return false when bedrock file does not exist", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    const exists = await isBedrockFileExists(randomTmpDir);

    logger.info(`bedrock.yaml file exists: ${exists}`);

    expect(exists).toBe(false);
  });

  test("Should return true when bedrock file exists", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    logger.info(`random temp dir: ${randomTmpDir}`);

    // create bedrock file to simulate the the use case that `spk project init` ran before
    const bedrockFileData: IBedrockFile = {
      rings: {},
      services: {},
      variableGroups: []
    };

    const asYaml = yaml.safeDump(bedrockFileData, {
      lineWidth: Number.MAX_SAFE_INTEGER
    });
    fs.writeFileSync(path.join(randomTmpDir, "bedrock.yaml"), asYaml);

    const exists = await isBedrockFileExists(randomTmpDir);
    logger.info(`bedrock.yaml file exists: ${exists} in ${randomTmpDir}`);

    expect(exists).toBe(true);
  });
});
