import {
  create as createBedrockYaml,
  read as loadBedrockFile,
} from "../../lib/bedrockYaml";
import * as fileUtils from "../../lib/fileutils";
import { createTempDir } from "../../lib/ioUtil";
import * as dns from "../../lib/net/dns";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { BedrockFile } from "../../types";
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
          isDefault: true,
        },
      },
      services: [],
      variableGroups: ["testvg"],
      version: "1.0",
    });
    checkDependencies(tmpDir, "not-master");
    // No errors thrown, this is a pass for the function.
  });
  it("Project initialized, but ring already exists, it should fail.", async () => {
    const tmpDir = createBedrockYaml(undefined, {
      rings: {
        master: {
          isDefault: true,
        },
      },
      services: [],
      variableGroups: ["testvg"],
      version: "1.0",
    });
    expect(() => {
      checkDependencies(tmpDir, "master");
    }).toThrow();
  });
});

describe("test execute function and logic", () => {
  it("test execute function: missing ring input", async () => {
    const exitFn = jest.fn();
    await execute("", "someprojectpath", { targetBranch: "" }, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("test execute function: invalid ring input", async () => {
    const exitFn = jest.fn();
    jest.spyOn(dns, "assertIsValid");
    await execute(
      "-not!dns@compliant%",
      "someprojectpath",
      { targetBranch: "" },
      exitFn
    );
    expect(dns.assertIsValid).toHaveReturnedTimes(0); // should never return because it throws
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("test execute function: missing project path", async () => {
    const exitFn = jest.fn();
    jest.spyOn(dns, "assertIsValid");
    await execute("ring", "", { targetBranch: "" }, exitFn);
    expect(dns.assertIsValid).toHaveReturnedTimes(1);
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
          isDefault: true,
        },
      },
      services: [
        {
          path: "./my-service",
          helm: {
            chart: {
              branch: "master",
              git: "https://github.com/microsoft/bedrock-cli-demo-repo.git",
              path: "my-service",
            },
          },
          k8sBackendPort: 80,
        },
      ],
      variableGroups: ["testvg"],
      version: "1.0",
    });

    const newRingName = "my-new-ring";
    const oldBedrockFile: BedrockFile = loadBedrockFile(tmpDir);
    expect(
      Object.entries(oldBedrockFile.rings).map(([ring]) => ring)
    ).not.toContain(newRingName);

    await execute(newRingName, tmpDir, { targetBranch: "" }, exitFn);

    const updatedBedrockFile: BedrockFile = loadBedrockFile(tmpDir);
    expect(
      Object.entries(updatedBedrockFile.rings).map(([ring]) => ring)
    ).toContain(newRingName);
    expect(mockPipelineUpdate).toBeCalledTimes(1);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
});
