import { create as createBedrockYaml } from "../../lib/bedrockYaml";
import { createTempDir } from "../../lib/ioUtil";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";

import { checkDependencies, execute } from "./delete";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("test valid function", () => {
  it("negative test", async () => {
    try {
      const tmpDir = createBedrockYaml();
      checkDependencies(tmpDir);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).not.toBeNull();
    }
  });
});

describe("test execute function and logic", () => {
  it("test execute function: missing project path", async () => {
    const exitFn = jest.fn();
    await execute("ring", "", exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("test execute function: working path with bedrock.yaml", async () => {
    const exitFn = jest.fn();

    const tmpDir = createTempDir();
    createBedrockYaml(tmpDir, {
      rings: {
        master: {
          isDefault: true
        }
      },
      services: {},
      variableGroups: ["testvg"]
    });
    await execute("ring", tmpDir, exitFn);

    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
});
