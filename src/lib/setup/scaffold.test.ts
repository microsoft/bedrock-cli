/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from "fs-extra";
import * as path from "path";
import simpleGit from "simple-git/promise";
import * as cmdCreateVariableGroup from "../../commands/project/create-variable-group";
import * as projectInit from "../../commands/project/init";
import * as createService from "../../commands/service/create";
import * as variableGroup from "../../lib/pipelines/variableGroup";
import { createTempDir } from "../ioUtil";
import {
  APP_REPO,
  HELM_REPO,
  HLD_REPO,
  MANIFEST_REPO,
  RequestContext,
} from "./constants";
import * as gitService from "./gitService";
import {
  appRepo,
  helmRepo,
  hldRepo,
  initService,
  manifestRepo,
  setupVariableGroup,
} from "./scaffold";
import * as scaffold from "./scaffold";

const createRequestContext = (workspace: string): RequestContext => {
  return {
    accessToken: "accessToken",
    orgName: "orgName",
    projectName: "projectName",
    workspace,
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

    ["component.yaml", "manifest-generation.yaml"].forEach((f) => {
      const sPath = path.join(folder, f);
      expect(fs.existsSync(sPath)).toBe(true);
      expect(fs.statSync(sPath).isFile()).toBeTruthy();
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

describe("test helmRepo function", () => {
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

    await helmRepo({} as any, createRequestContext(tempDir));
    const folder = path.join(tempDir, HELM_REPO);
    expect(fs.existsSync(folder)).toBe(true);
    expect(fs.statSync(folder).isDirectory()).toBeTruthy();

    const folderAppChart = path.join(folder, APP_REPO, "chart");
    ["Chart.yaml", "values.yaml"].forEach((f) => {
      const sPath = path.join(folderAppChart, f);
      expect(fs.existsSync(sPath)).toBe(true);
      expect(fs.statSync(sPath).isFile()).toBeTruthy();
    });
    const folderAppChartTemplates = path.join(folderAppChart, "templates");
    ["all-in-one.yaml"].forEach((f) => {
      const sPath = path.join(folderAppChartTemplates, f);
      expect(fs.existsSync(sPath)).toBe(true);
      expect(fs.statSync(sPath).isFile()).toBeTruthy();
    });
  });
  it("negative test", async () => {
    const tempDir = createTempDir();
    jest.spyOn(gitService, "createRepoInAzureOrg").mockImplementation(() => {
      throw new Error("fake");
    });
    await expect(
      helmRepo({} as any, createRequestContext(tempDir))
    ).rejects.toThrow();
  });
});

describe("test appRepo function", () => {
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

    jest.spyOn(scaffold, "setupVariableGroup").mockResolvedValueOnce();
    jest.spyOn(scaffold, "initService").mockResolvedValueOnce();
    jest.spyOn(projectInit, "initialize").mockImplementationOnce(async () => {
      fs.createFileSync("README.md");
    });

    await appRepo({} as any, createRequestContext(tempDir));
    const folder = path.join(tempDir, APP_REPO);
    expect(fs.existsSync(folder)).toBe(true);
    expect(fs.statSync(folder).isDirectory()).toBeTruthy();
  });
  it("sanity test, initService", async () => {
    jest.spyOn(createService, "createService").mockResolvedValueOnce();
    await initService(createRequestContext("test"), "test");
  });
  it("sanity test on setupVariableGroup", async () => {
    jest
      .spyOn(variableGroup, "deleteVariableGroup")
      .mockResolvedValueOnce(true);
    jest.spyOn(cmdCreateVariableGroup, "create").mockResolvedValueOnce({});
    jest
      .spyOn(cmdCreateVariableGroup, "setVariableGroupInBedrockFile")
      .mockReturnValueOnce();
    jest
      .spyOn(cmdCreateVariableGroup, "updateLifeCyclePipeline")
      .mockReturnValueOnce();
    await setupVariableGroup(createRequestContext("/dummy"));
  });
  it("negative test", async () => {
    const tempDir = createTempDir();
    jest.spyOn(gitService, "createRepoInAzureOrg").mockImplementation(() => {
      throw new Error("fake");
    });
    await expect(
      appRepo({} as any, createRequestContext(tempDir))
    ).rejects.toThrow();
  });
});
