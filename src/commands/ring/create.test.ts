import { create as createBedrockYaml } from "../../lib/bedrockYaml";
import { read as loadBedrockFile } from "../../lib/bedrockYaml";
import { createTempDir } from "../../lib/ioUtil";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";

import * as fileUtils from "../../lib/fileutils";

import { IBedrockFile } from "../../types";
import { checkDependencies, execute } from "./create";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("checkDependencies", () => {
  it("Project not initialized, it should fail.", async () => {
    const tmpDir = createTempDir();
    expect(() => {
      checkDependencies(tmpDir, "");
    }).toThrow();
  });
  it("Project initialized, it should pass.", async () => {
    const tmpDir = createBedrockYaml();
    createBedrockYaml(tmpDir, {
      rings: {
        master: {
          isDefault: true
        }
      },
      services: {},
      variableGroups: ["testvg"]
    });
    checkDependencies(tmpDir, "not-master");
    // No errors thrown, this is a pass for the function.
  });
  it("Project initialized, but ring already exists, it should fail.", async () => {
    const tmpDir = createBedrockYaml(undefined, {
      rings: {
        master: {
          isDefault: true
        }
      },
      services: {},
      variableGroups: ["testvg"]
    });
    expect(() => {
      checkDependencies(tmpDir, "master");
    }).toThrow();
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
    const mockPipelineUpdate = jest.spyOn(
      fileUtils,
      "updateTriggerBranchesForServiceBuildAndUpdatePipeline"
    );
    mockPipelineUpdate.mockImplementation();
    const tmpDir = createTempDir();

    createBedrockYaml(tmpDir, {
      rings: {
        master: {
          isDefault: true
        }
      },
      services: {
        "./my-service": {
          helm: {
            chart: {
              branch: "master",
              git: "https://github.com/catalystcode/spk-demo-repo.git",
              path: "my-service"
            }
          },
          k8sBackendPort: 80
        }
      },
      variableGroups: ["testvg"]
    });

    const newRingName = "my-new-ring";
    const oldBedrockFile: IBedrockFile = loadBedrockFile(tmpDir);
    expect(
      Object.entries(oldBedrockFile.rings).map(([ring]) => ring)
    ).not.toContain(newRingName);

    await execute(newRingName, tmpDir, exitFn);

    const updatedBedrockFile: IBedrockFile = loadBedrockFile(tmpDir);
    expect(
      Object.entries(updatedBedrockFile.rings).map(([ring]) => ring)
    ).toContain(newRingName);
    expect(mockPipelineUpdate).toBeCalledTimes(1);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
});
