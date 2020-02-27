jest.mock("azure-devops-node-api");
jest.mock("../config");

import uuid from "uuid/v4";
import { Config } from "../config";
import {
  azdoUrl,
  getBuildApi,
  getRestClient,
  getTaskAgentApi,
  getWebApi,
  invalidateWebApi,
  repositoryHasFile
} from "./azdoClient";
import * as azdoClient from "./azdoClient";
import { IAzureDevOpsOpts } from "./git";
import * as azure from "./git/azure";

describe("AzDo Pipeline utility functions", () => {
  test("azdo url is well formed", () => {
    const org = "test";
    expect(azdoUrl(org)).toBe("https://dev.azure.com/test");
  });
});

const TOKEN = uuid();
const ORG = uuid();

beforeEach(() => {
  invalidateWebApi();
});

const mockConfig = (token?: string, org?: string) => {
  (Config as jest.Mock).mockReturnValueOnce({
    azure_devops: {
      access_token: token,
      org
    }
  });
};

describe("test getWebApi function", () => {
  test("should fail when personal access token is not set", async () => {
    mockConfig();
    await expect(getWebApi()).rejects.toThrow();
  });
  test("should fail when org is not set", async () => {
    mockConfig(TOKEN);
    await expect(getWebApi()).rejects.toThrow();
  });
  test("should pass when org and personal access token are set", async () => {
    mockConfig(TOKEN, ORG);
    const res = await getWebApi();
    expect(res).toBeDefined();

    mockConfig(); // empty config. still work because API client is cached
    const again = await getWebApi();
    expect(again).toBeDefined();
  });
});

describe("test getTaskAgentApi function", () => {
  test("should fail when PAT not set", async () => {
    mockConfig();
    await expect(getTaskAgentApi()).rejects.toThrow();
  });
  test("should fail when DevOps org is invalid", async () => {
    mockConfig(TOKEN);
    await expect(getTaskAgentApi()).rejects.toThrow();
  });
  test("should pass if org url and PAT set", async () => {
    mockConfig(TOKEN, ORG);
    const mockFn = jest.spyOn(azdoClient, "getWebApi").mockReturnValueOnce({
      getTaskAgentApi: () => {
        return {};
      }
    } as any);

    const res = await getTaskAgentApi();
    expect(res).toBeDefined();
    mockFn.mockReset();

    mockConfig(); // empty config. still work because API client is cached
    const again = await getTaskAgentApi();
    expect(again).toBeDefined();
  });
});

describe("test getRestClient function", () => {
  test("should fail when personal access token is not set", async () => {
    mockConfig();
    await expect(getRestClient()).rejects.toThrow();
  });
  test("should fail when org is not set", async () => {
    mockConfig(TOKEN);
    await expect(getRestClient()).rejects.toThrow();
  });
  test("should pass when org and personal access token are set", async () => {
    mockConfig(TOKEN, ORG);
    const mockFn = jest.spyOn(azdoClient, "getWebApi").mockReturnValueOnce(
      Promise.resolve({
        rest: {}
      } as any)
    );

    const res = await getRestClient();
    expect(res).toBeDefined();
    mockFn.mockReset();

    mockConfig(); // empty config. still work because API client is cached
    const again = await getRestClient();
    expect(again).toBeDefined();
  });
});

describe("test getBuildApi function", () => {
  test("should fail when personal access token is not set", async () => {
    mockConfig();
    await expect(getBuildApi()).rejects.toThrow();
  });
  test("should fail when org is not set", async () => {
    mockConfig(TOKEN);
    await expect(getBuildApi()).rejects.toThrow();
  });
  test("should pass when org and personal access token are set", async () => {
    mockConfig(TOKEN, ORG);
    const mockFn = jest.spyOn(azdoClient, "getWebApi").mockReturnValueOnce({
      getBuildApi: () => {
        return {};
      }
    } as any);

    const api = await getBuildApi();
    expect(api).toBeDefined();
    mockFn.mockReset();

    mockConfig(); // empty config. still work because API client is cached
    const again = await getBuildApi();
    expect(again).toBeDefined();
  });
});

describe("repositoryHasFile", () => {
  test("repository contains the given file", async () => {
    const createPullRequestFunc = jest.spyOn(azure, "GitAPI");
    createPullRequestFunc.mockReturnValueOnce(
      Promise.resolve({ getItem: () => ({ commitId: "3839fjfkj" }) } as any)
    );
    const accessOpts: IAzureDevOpsOpts = {
      orgName: "testOrg",
      personalAccessToken: "mytoken",
      project: "testProject"
    };
    let hasError = false;

    try {
      await repositoryHasFile(
        "testFile.txt",
        "master",
        "test-repo",
        accessOpts
      );
    } catch (err) {
      hasError = true;
    }
    expect(hasError).toBe(false);
  });
  test("repository does not contain the given file", async () => {
    const createPullRequestFunc = jest.spyOn(azure, "GitAPI");
    createPullRequestFunc.mockReturnValueOnce(
      Promise.resolve({ getItem: () => null } as any)
    );
    const accessOpts: IAzureDevOpsOpts = {
      orgName: "testOrg",
      personalAccessToken: "mytoken",
      project: "testProject"
    };
    let hasError = false;

    try {
      await repositoryHasFile(
        "testFile2.txt",
        "master",
        "test-repo",
        accessOpts
      );
    } catch (err) {
      hasError = true;
    }
    expect(hasError).toBe(true);
  });
});
