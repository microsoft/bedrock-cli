import path from "path";
import uuid from "uuid";
import { saveConfiguration } from "../config";
import { createTempDir } from "../lib/ioUtil";
import { disableVerboseLogging, enableVerboseLogging, logger } from "../logger";
import { execute } from "./init";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

const mockFileName = "src/commands/mocks/spk-config.yaml";

describe("Test execute function", () => {
  it("negative test: missing file value", async () => {
    const exitFn = jest.fn();
    await execute(
      {
        file: undefined
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("negative test: invalid file value", async () => {
    const exitFn = jest.fn();
    await execute(
      {
        file: uuid()
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("positive test", async () => {
    process.env.test_name = "my_storage_account";
    process.env.test_key = "my_storage_key";
    const randomTmpDir = createTempDir();
    const filename = path.resolve(mockFileName);
    await saveConfiguration(filename, randomTmpDir);

    const exitFn = jest.fn();
    await execute(
      {
        file: path.join(randomTmpDir, "config.yaml")
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
});
