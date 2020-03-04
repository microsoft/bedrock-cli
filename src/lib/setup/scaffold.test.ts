import * as fs from "fs-extra";
import * as path from "path";
import simpleGit from "simple-git/promise";
import * as hldInit from "../../commands/hld/init";
import { createTempDir } from "../ioUtil";
import { HLD_REPO, IRequestContext, MANIFEST_REPO } from "./constants";
import * as gitService from "./gitService";
import { hldRepo, manifestRepo } from "./scaffold";
import * as scaffold from "./scaffold";

const createRequestContext = (workspace: string): IRequestContext => {
  return {
    accessToken: "accessToken",
    orgName: "orgName",
    projectName: "projectName",
    workspace
  };
};

describe("test manifestRepo function", () => {
  it("positive test", async () => {
    const tempDir = createTempDir();
    jest
      .spyOn(gitService, "createRepoInAzureOrg")
      .mockReturnValueOnce({} as any);
    jest
      .spyOn(gitService, "commitAndPushToRemote")
      .mockReturnValueOnce({} as any);
    const git = simpleGit();
    git.init = jest.fn();

    await manifestRepo({} as any, createRequestContext(tempDir));

    const folder = path.join(tempDir, MANIFEST_REPO);
    expect(fs.existsSync(folder)).toBe(true);
    expect(fs.statSync(folder).isDirectory()).toBeTruthy();

    const readmeMdPath = path.join(folder, "README.md");
    expect(fs.existsSync(readmeMdPath)).toBe(true);
    expect(fs.statSync(readmeMdPath).isFile()).toBeTruthy();
  });
  it("negative test", async () => {
    const tempDir = createTempDir();
    jest.spyOn(gitService, "createRepoInAzureOrg").mockImplementation(() => {
      throw new Error("fake");
    });
    await expect(
      manifestRepo({} as any, createRequestContext(tempDir))
    ).rejects.toThrow();
  });
});

describe("test hldRepo function", () => {
  it("positive test", async () => {
    const tempDir = createTempDir();
    jest
      .spyOn(gitService, "createRepoInAzureOrg")
      .mockReturnValueOnce({} as any);
    jest
      .spyOn(gitService, "commitAndPushToRemote")
      .mockReturnValueOnce({} as any);
    const git = simpleGit();
    git.init = jest.fn();

    await hldRepo({} as any, createRequestContext(tempDir));
    const folder = path.join(tempDir, HLD_REPO);
    expect(fs.existsSync(folder)).toBe(true);
    expect(fs.statSync(folder).isDirectory()).toBeTruthy();

    ["component.yaml", "manifest-generation.yaml"].forEach(f => {
      const readmeMdPath = path.join(folder, f);
      expect(fs.existsSync(readmeMdPath)).toBe(true);
      expect(fs.statSync(readmeMdPath).isFile()).toBeTruthy();
    });
  });
  it("negative test", async () => {
    const tempDir = createTempDir();
    jest.spyOn(gitService, "createRepoInAzureOrg").mockImplementation(() => {
      throw new Error("fake");
    });
    await expect(
      hldRepo({} as any, createRequestContext(tempDir))
    ).rejects.toThrow();
  });
});
