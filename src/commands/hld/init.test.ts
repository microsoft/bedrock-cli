import fs from "fs";
import os from "os";
import path from "path";
import uuid from "uuid/v4";
import { checkoutCommitPushCreatePRLink } from "../../lib/gitutils";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { execute, initialize } from "./init";
jest.mock("../../lib/gitutils");

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

const testExecuteFn = async (
  projectRootPath: string,
  gitPush: boolean,
  expectedExitCode: number
) => {
  const exitFn = jest.fn();
  await execute(projectRootPath, gitPush, exitFn);
  expect(exitFn).toBeCalledTimes(1);
  expect(exitFn.mock.calls).toEqual([[expectedExitCode]]);
};

describe("Test execute function", () => {
  it("simulate an error: missing project path", async () => {
    await testExecuteFn("", false, 1);
  });
  it("positive test", async () => {
    await testExecuteFn(os.tmpdir(), false, 0);
  });
});

const testRepoInitialization = async (gitPush: boolean) => {
  // Create random directory to initialize
  const randomTmpDir = path.join(os.tmpdir(), uuid());
  fs.mkdirSync(randomTmpDir);

  logger.info(`creating randomTmpDir ${randomTmpDir}`);

  // addService call
  await initialize(randomTmpDir, gitPush);

  // Check temp test directory exists
  expect(fs.existsSync(randomTmpDir)).toBe(true);

  // Verify new azure-pipelines created
  ["manifest-generation.yaml", "component.yaml"]
    .map(filename => path.join(randomTmpDir, filename))
    .forEach(filePath => {
      expect(fs.existsSync(filePath)).toBe(true);
    });
};

describe("Initializing an HLD Repository.", () => {
  test("New directory is created under root directory with required service files.", async () => {
    await testRepoInitialization(false);
  });

  test("New directory is created and git push is enabled.", async () => {
    await testRepoInitialization(true);
    expect(checkoutCommitPushCreatePRLink).toHaveBeenCalled();
  });
});
