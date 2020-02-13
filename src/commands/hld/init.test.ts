import fs from "fs";
import os from "os";
import path from "path";
import uuid from "uuid/v4";
import {
  HLD_COMPONENT_FILENAME,
  RENDER_HLD_PIPELINE_FILENAME
} from "../../lib/constants";
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

const defaultComponentGit =
  "https://github.com/microsoft/fabrikate-definitions.git";
const defaultComponentName = "traefik2";
const defaultComponentPath = "definitions/traefik2";

const testExecuteFn = async (
  projectRootPath: string,
  gitPush: boolean,
  componentGit: string,
  componentName: string,
  componentPath: string,
  expectedExitCode: number
) => {
  const exitFn = jest.fn();
  await execute(
    projectRootPath,
    gitPush,
    componentGit,
    componentName,
    componentPath,
    exitFn
  );
  expect(exitFn).toBeCalledTimes(1);
  expect(exitFn.mock.calls).toEqual([[expectedExitCode]]);
};

describe("Test execute function", () => {
  it("simulate an error: missing project path", async () => {
    await testExecuteFn(
      "",
      false,
      defaultComponentGit,
      defaultComponentName,
      defaultComponentPath,
      1
    );
  });
  it("positive test", async () => {
    await testExecuteFn(
      os.tmpdir(),
      false,
      defaultComponentGit,
      defaultComponentName,
      defaultComponentPath,
      0
    );
  });
});

const testRepoInitialization = async (
  gitPush: boolean,
  componentGit: string,
  componentName: string,
  componentPath: string
) => {
  // Create random directory to initialize
  const randomTmpDir = path.join(os.tmpdir(), uuid());
  fs.mkdirSync(randomTmpDir);

  logger.info(`creating randomTmpDir ${randomTmpDir}`);

  // addService call
  await initialize(
    randomTmpDir,
    gitPush,
    componentGit,
    componentName,
    componentPath
  );

  // Check temp test directory exists
  expect(fs.existsSync(randomTmpDir)).toBe(true);

  // Verify new azure-pipelines created
  [RENDER_HLD_PIPELINE_FILENAME, HLD_COMPONENT_FILENAME]
    .map(filename => path.join(randomTmpDir, filename))
    .forEach(filePath => {
      expect(fs.existsSync(filePath)).toBe(true);
    });
};

describe("Initializing an HLD Repository.", () => {
  test("New directory is created under root directory with required service files.", async () => {
    await testRepoInitialization(
      false,
      defaultComponentGit,
      defaultComponentName,
      defaultComponentPath
    );
  });

  test("New directory is created and git push is enabled.", async () => {
    await testRepoInitialization(
      true,
      defaultComponentGit,
      defaultComponentName,
      defaultComponentPath
    );
    expect(checkoutCommitPushCreatePRLink).toHaveBeenCalled();
  });
});
