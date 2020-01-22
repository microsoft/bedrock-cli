import fs from "fs";
import os from "os";
import path from "path";
import uuid from "uuid/v4";
import { readYaml, write } from "../../config";
import { IAzureDevOpsOpts } from "../../lib/git";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { IBedrockFile } from "../../types";
import {
  create,
  execute,
  setVariableGroupInBedrockFile,
  validateRequiredArguments
} from "./create-variable-group";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
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

  test("Should pass with empty variable group arguments", async () => {
    const accessOpts: IAzureDevOpsOpts = {
      orgName,
      personalAccessToken,
      project
    };

    let invalidGroupError: Error | undefined;
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
      invalidGroupError = err;
    }
    expect(invalidGroupError).toBeDefined();
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

  test("Should pass adding a variable group name when no bedrock file exists", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    await setVariableGroupInBedrockFile(randomTmpDir, variableGroupName);

    const filePath = path.join(randomTmpDir, "bedrock.yaml");
    expect(fs.existsSync(filePath)).toBe(true);

    const bedrockFileData = readYaml<IBedrockFile>(filePath);
    logger.info(`filejson: ${JSON.stringify(bedrockFileData)}`);
    expect(bedrockFileData.variableGroups![0]).toBe(variableGroupName);
  });

  test("Should pass adding a valid variable group name when bedrock file exists with undefined variableGroups", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    await setVariableGroupInBedrockFile(randomTmpDir, variableGroupName);

    const bedrockFilePath = path.join(randomTmpDir, "bedrock.yaml");
    expect(fs.existsSync(bedrockFilePath)).toBe(true);

    const bedrockFile = readYaml<IBedrockFile>(bedrockFilePath);
    logger.info(`filejson: ${JSON.stringify(bedrockFile)}`);
    expect(bedrockFile.variableGroups![0]).toBe(variableGroupName);
  });

  test("Should pass adding a valid variable group name when bedrock file exists with empty variableGroups", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    const bedrockFileData: IBedrockFile = {
      rings: {}, // rings is optional but necessary to create a bedrock file in config.write method
      services: {}, // service property is not optional so set it to null
      variableGroups: []
    };

    await setVariableGroupInBedrockFile(randomTmpDir, variableGroupName);

    const bedrockFilePath = path.join(randomTmpDir, "bedrock.yaml");
    expect(fs.existsSync(bedrockFilePath)).toBe(true);

    const bedrockFile = readYaml<IBedrockFile>(bedrockFilePath);
    logger.info(`filejson: ${JSON.stringify(bedrockFile)}`);
    expect(bedrockFile.variableGroups![0]).toBe(variableGroupName);
  });

  test("Should pass adding a valid variable group name when bedrock file exists when variableGroups length is already 1", async () => {
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
