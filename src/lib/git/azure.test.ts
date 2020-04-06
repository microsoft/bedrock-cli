import { WebApi } from "azure-devops-node-api";
import uuid from "uuid/v4";
import { Config } from "../../config";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { getErrorMessage } from "../errorBuilder";
import { AzureDevOpsOpts } from "../git";
import * as gitutils from "../gitutils";
import {
  createPullRequest,
  generatePRUrl,
  getGitOrigin,
  GitAPI,
  repositoryHasFile,
  validateRepository,
} from "./azure";
import * as azure from "./azure";
jest.mock("azure-devops-node-api");
jest.mock("../../config");

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("test getGitOrigin function", () => {
  it("positive test: originPushUrl provided", async () => {
    const res = await getGitOrigin("git-url");
    expect(res).toBe("git-url");
  });
  it("positive test: originPushUrl not provided", async () => {
    jest
      .spyOn(gitutils, "getOriginUrl")
      .mockReturnValueOnce(Promise.resolve("origin-url"));
    const res = await getGitOrigin("");
    expect(res).toBe("origin-url");
  });
  it("negative test: getOriginUrl throws error", async () => {
    jest
      .spyOn(gitutils, "getOriginUrl")
      .mockReturnValueOnce(Promise.reject(new Error("Fake")));
    await expect(getGitOrigin("")).rejects.toThrow();
  });
});

describe("GitAPI", () => {
  test("should fail when PAT not set", async () => {
    (Config as jest.Mock).mockReturnValueOnce({
      azure_devops: {},
    });
    await expect(GitAPI()).rejects.toThrow();
  });

  test("should fail when DevOps org is invalid", async () => {
    (Config as jest.Mock).mockReturnValueOnce({
      azure_devops: {
        access_token: uuid(),
      },
    });
    await expect(GitAPI()).rejects.toThrow();
  });

  test("should pass if org url and PAT set", async () => {
    (Config as jest.Mock).mockReturnValueOnce({
      azure_devops: {
        access_token: uuid(),
        org: uuid(),
      },
    });

    await GitAPI();
  });
});

describe("createPullRequest", () => {
  //////////////////////////////////////////////////////////////////////////////
  // Mock working state
  // - Give a random Config that will allow a GitAPI to build
  // - Mock a WebApi `getGitApi` function with a reference type and mutate the
  //   the reference as needed by the tests; this  cannot by
  //   `.mockImplementation` from within the tests themselves as Jest has a
  //   limitation of not being able to redeclare nested jest.fn()'s
  //////////////////////////////////////////////////////////////////////////////
  (Config as jest.Mock).mockImplementation(() => ({
    azure_devops: {
      access_token: uuid(),
      org: uuid(),
    },
  }));
  // Mutable copy of the gitApi
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gitApi: { [name: string]: (...args: any) => Promise<any> } = {
    createPullRequest: async () => ({
      pullRequestId: 123,
      repository: { id: 456 },
    }),
    getBranches: async () => [{ name: "sourceRef" }, { name: "targetRef" }],
    getPullRequests: async () => [],
    getRepositories: async () => [{ url: "my-git-url" }],
    getRepository: async () => ({ webUrl: "http://foobar.com" }),
  };
  // Keep a reference to the original gitApi functions so they be reused to reset the mocks
  const originalGitApi = { ...gitApi };
  ((WebApi as unknown) as jest.Mock).mockImplementation(() => ({
    getGitApi: async (): Promise<unknown> => gitApi,
  }));

  beforeEach(() => {
    // Reset the gitApi to a the default working state
    for (const [key, func] of Object.entries(originalGitApi)) {
      gitApi[key] = func;
    }
  });

  test("should throw an error when 0 repositories found ", async () => {
    // local mock
    gitApi.getRepositories = async (): Promise<unknown[]> => [];

    await expect(
      createPullRequest(uuid(), uuid(), uuid(), {
        description: uuid(),
        originPushUrl: uuid(),
      })
    ).rejects.toThrow(getErrorMessage("git-azure-get-all-repo-err"));
  });

  test("should fail when source ref for PR is not in DevOps instance", async () => {
    // mock such that the 'sourceRef' has not been pushed to the azdo git
    const originalBranches = gitApi.getBranches;
    gitApi.getBranches = async (): Promise<unknown> => [{ name: "targetRef" }];

    await expect(
      createPullRequest("random title", "sourceRef", "targetRef", {
        description: uuid(),
        originPushUrl: "my-git-url",
      })
    ).rejects.toThrow(getErrorMessage("git-azure-get-match-branch-err"));

    gitApi.getBranches = originalBranches;
  });

  test("should pass when source and target refs exist in azure git and the PR is generated in the DevOps instance", async () => {
    try {
      await createPullRequest("random title", "sourceRef", "targetRef", {
        description: uuid(),
        originPushUrl: "my-git-url",
      });
    } catch (e) {
      expect(true).toBe(false);
    }
  });
  it("negative test", async () => {
    gitApi.createPullRequest = async (): Promise<unknown> => {
      throw Error("fake");
    };

    await expect(
      createPullRequest("random title", "sourceRef", "targetRef", {
        description: uuid(),
        originPushUrl: "my-git-url",
      })
    ).rejects.toThrow();
  });
  it("negative test: TF401179 error", async () => {
    gitApi.createPullRequest = async (): Promise<unknown> => {
      throw Error("TF401179");
    };

    await expect(
      createPullRequest("random title", "sourceRef", "targetRef", {
        description: uuid(),
        originPushUrl: "my-git-url",
      })
    ).rejects.toThrow();
  });
});

describe("test generatePRUrl function", async () => {
  test("positive test", async () => {
    const res = await generatePRUrl({
      pullRequestId: 1,
      repository: {
        id: "test",
      },
    });
    expect(res).toBe("http://foobar.com/pullrequest/1");
  });
  test("negative test", async () => {
    await expect(
      generatePRUrl({
        repository: {},
      })
    ).rejects.toThrow();
  });
});

describe("validateRepository", () => {
  test("repository exists", async () => {
    const getRepositoryFunc = jest.spyOn(azure, "GitAPI");
    getRepositoryFunc.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { getRepository: () => ({ id: "3839fjfkj" }) } as any
    );

    const getItemFunc = jest.spyOn(azure, "GitAPI");
    getItemFunc.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { getItem: () => ({ commitId: "3839fjfkj" }) } as any
    );

    const accessOpts: AzureDevOpsOpts = {
      orgName: "testOrg",
      personalAccessToken: "mytoken",
      project: "testProject",
    };

    await expect(
      validateRepository(
        "my-project",
        "myFile",
        "master",
        "my-repo",
        accessOpts
      )
    ).resolves.not.toThrow();
  });
  test("repository does not exist", async () => {
    const createPullRequestFunc = jest.spyOn(azure, "GitAPI");
    createPullRequestFunc.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { getRepository: () => null } as any
    );

    const accessOpts: AzureDevOpsOpts = {
      orgName: "testOrg",
      personalAccessToken: "mytoken",
      project: "testProject",
    };
    await expect(
      validateRepository(
        "my-project",
        "myFile",
        "master",
        "my-repo",
        accessOpts
      )
    ).rejects.toThrow();
  });
});

describe("repositoryHasFile", () => {
  test("repository contains the given file", async () => {
    const createPullRequestFunc = jest.spyOn(azure, "GitAPI");
    createPullRequestFunc.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { getItem: () => ({ commitId: "3839fjfkj" }) } as any
    );

    const accessOpts: AzureDevOpsOpts = {
      orgName: "testOrg",
      personalAccessToken: "mytoken",
      project: "testProject",
    };
    await expect(
      repositoryHasFile("testFile.txt", "master", "test-repo", accessOpts)
    ).resolves.not.toThrow();
  });
  test("repository does not contain the given file", async () => {
    jest.spyOn(azure, "GitAPI").mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { getItem: () => null } as any
    );
    const accessOpts: AzureDevOpsOpts = {
      orgName: "testOrg",
      personalAccessToken: "mytoken",
      project: "testProject",
    };

    await expect(
      repositoryHasFile("testFile2.txt", "master", "test-repo", accessOpts)
    ).rejects.toThrow();
  });
});
