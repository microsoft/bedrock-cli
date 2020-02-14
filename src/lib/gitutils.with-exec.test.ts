import { disableVerboseLogging, enableVerboseLogging } from "../logger";
import { getCurrentBranch } from "./gitutils";
import { createTempDir } from "./ioUtil";
import { exec } from "./shell";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("getCurrentBranch", () => {
  it("should return 'master' when working on a newly created repo with 0 commits", async () => {
    const randomTmpDir = createTempDir();

    // initialize the new git repo
    await exec("git", ["init"], { cwd: randomTmpDir });
    const currentBranch = await getCurrentBranch(randomTmpDir);

    expect(currentBranch).toBe("master");
  });

  it("should return 'foobar' when working on a newly created repo with 0 commits and 'foobar' has been checked out", async () => {
    const randomTmpDir = createTempDir();

    // initialize the new git repo and checkout 'foobar'
    await exec("git", ["init"], { cwd: randomTmpDir });
    await exec("git", ["checkout", "-b", "foobar"], { cwd: randomTmpDir });
    const currentBranch = await getCurrentBranch(randomTmpDir);

    expect(currentBranch).toBe("foobar");
  });
});
