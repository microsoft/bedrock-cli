import * as bedrock from "../../lib/bedrockYaml";
import * as fileUtils from "../../lib/fileutils";
import { createTempDir } from "../../lib/ioUtil";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { createTestBedrockYaml } from "../../test/mockFactory";
import { BedrockFile } from "../../types";
import { checkDependencies, execute } from "./delete";

jest.mock("../../lib/fileutils");

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("checkDependencies", () => {
  it("throws when project not initialized", () => {
    const tmpDir = createTempDir();
    expect(() => checkDependencies(tmpDir)).toThrow();
  });

  it("does not throw when project initialized", () => {
    const tmpDir = createTempDir();
    bedrock.create(tmpDir, createTestBedrockYaml(false) as BedrockFile);
    expect(() => checkDependencies(tmpDir)).not.toThrow();
  });
});

describe("test execute function and logic", () => {
  it("test execute function: missing ring input", async () => {
    const exitFn = jest.fn();
    await execute("", "someprojectpath", exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });

  it("test execute function: missing project path", async () => {
    const exitFn = jest.fn();
    await execute("ring", "", exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });

  it("test execute function: working path with bedrock.yaml", async () => {
    const exitFn = jest.fn();
    const tmpDir = createTempDir();
    const bedrockConfig = createTestBedrockYaml(false) as BedrockFile;
    bedrock.create(tmpDir, bedrockConfig);

    // delete the first ring and write out the update
    jest.spyOn(bedrock, "create");
    const ringToDelete = Object.keys(bedrockConfig.rings).pop() as string;
    expect(ringToDelete).toBeDefined();
    await execute(ringToDelete, tmpDir, exitFn);
    expect(bedrock.create).toBeCalledTimes(1);

    // updateTriggerBranchesForServiceBuildAndUpdatePipeline should be called
    // once per service
    const numberOfServices = bedrockConfig.services.length;
    const updatedRingList = Object.keys(
      bedrock.removeRing(bedrockConfig, ringToDelete).rings
    );
    expect(
      fileUtils.updateTriggerBranchesForServiceBuildAndUpdatePipeline
    ).toBeCalledTimes(numberOfServices);
    for (const { path: servicePath } of bedrockConfig.services) {
      expect(
        fileUtils.updateTriggerBranchesForServiceBuildAndUpdatePipeline
      ).toBeCalledWith(updatedRingList, servicePath);
    }
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
});
