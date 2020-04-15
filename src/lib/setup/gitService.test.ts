/* eslint-disable @typescript-eslint/no-explicit-any */
import { WORKSPACE, HLD_REPO } from "./constants";
import * as gitService from "./gitService";
import {
  completePullRequest,
  commitAndPushToRemote,
  createRepo,
  createRepoInAzureOrg,
  deleteRepo,
  getAzureRepoUrl,
  getGitApi,
  getRepoInAzureOrg,
  getRepoURL,
} from "./gitService";
import { getErrorMessage } from "../errorBuilder";
import * as azureGit from "../git/azure";

const mockRequestContext = {
  accessToken: "pat",
  orgName: "orgname",
  projectName: "project",
  workspace: WORKSPACE,
};

describe("test getAzureRepoUrl function", () => {
  it("sanity test", () => {
    expect(getAzureRepoUrl("org", "project", "repo")).toBe(
      "https://dev.azure.com/org/project/_git/repo"
    );
  });
});

describe("test getGitApi function", () => {
  it("mocked webAPI", async () => {
    await getGitApi({
      getGitApi: jest.fn(),
    } as any);
  });
  it("mocked webAPI: cached", async () => {
    await getGitApi({
      getGitApi: () => {
        return {};
      },
    } as any);
    await getGitApi({
      // without getGitApi function works because the client is cached in the first call
    } as any);
  });
});

describe("test getRepoURL function", () => {
  it("positive test", () => {
    const res = getRepoURL(
      {
        remoteUrl: "https://orgName@github.com/test",
      } as any,
      "orgName"
    );
    expect(res).toBe("https://github.com/test");
  });
});

describe("test createRepo function", () => {
  it("positive test", async () => {
    const mockResult = {
      id: "testRepo",
    };
    const res = await createRepo(
      {
        createRepository: async () => {
          return mockResult;
        },
      } as any,
      "testRepo",
      "testProject"
    );
    expect(res).toStrictEqual(mockResult);
  });
  it("negative test: permission issue", async () => {
    await expect(
      createRepo(
        {
          createRepository: () => {
            throw {
              message: "Authentication failure",
              statusCode: 401,
            };
          },
        } as any,
        "testRepo",
        "testProject"
      )
    ).rejects.toThrow();
  });
  it("negative test: other issue", async () => {
    await expect(
      createRepo(
        {
          createRepository: () => {
            throw new Error("fake");
          },
        } as any,
        "testRepo",
        "testProject"
      )
    ).rejects.toThrow();
  });
});

describe("test deleteRepo function", () => {
  it("positive test", async () => {
    await deleteRepo(
      {
        deleteRepository: () => {
          return;
        },
      } as any,
      {
        id: "test",
        name: "test",
      },
      "project"
    );
  });
  it("negative test: deleteRepository throw error", async () => {
    await expect(
      deleteRepo(
        {
          deleteRepository: () => {
            throw new Error("Fake");
          },
        } as any,
        {
          id: "test",
          name: "test",
        },
        "project"
      )
    ).rejects.toThrow();
  });
  it("negative test: repo does not have id", async () => {
    await expect(
      deleteRepo(
        {
          deleteRepository: () => {
            throw new Error("Fake");
          },
        } as any,
        {
          name: "test",
        },
        "project"
      )
    ).rejects.toThrow();
  });
});

describe("test getRepoInAzureOrg function", () => {
  it("positive test", async () => {
    const mockRepo = {
      name: "testRepo",
      project: {
        name: "testProject",
      },
    };
    const res = await getRepoInAzureOrg(
      {
        getRepositories: () => {
          return [mockRepo];
        },
      } as any,
      "testRepo",
      "testProject"
    );
    expect(res).toStrictEqual(mockRepo);
  });
  it("negative test: no repos", async () => {
    const res = await getRepoInAzureOrg(
      {
        getRepositories: () => {
          return [];
        },
      } as any,
      "testRepo",
      "testProject"
    );
    expect(res).toBeUndefined();
  });
  it("negative test: repo not found", async () => {
    const res = await getRepoInAzureOrg(
      {
        getRepositories: () => {
          return [
            {
              name: "otherRepo",
              project: {
                name: "testProject",
              },
            },
          ];
        },
      } as any,
      "testRepo",
      "testProject"
    );
    expect(res).toBeUndefined();
  });
  it("negative test: permission issue", async () => {
    await expect(
      getRepoInAzureOrg(
        {
          getRepositories: () => {
            throw {
              message: "Authentication failure",
              statusCode: 401,
            };
          },
        } as any,
        "testRepo",
        "testProject"
      )
    ).rejects.toThrow();
  });
  it("negative test: other error", async () => {
    await expect(
      getRepoInAzureOrg(
        {
          getRepositories: () => {
            throw new Error("fake");
          },
        } as any,
        "testRepo",
        "testProject"
      )
    ).rejects.toThrow();
  });
});

describe("test createRepoInAzureOrg function", () => {
  it("positive test: repo already exists", async () => {
    const fnCreateRepo = jest.spyOn(gitService, "createRepo");

    const mockRepo = {
      name: "testRepo",
      project: {
        name: "testProject",
      },
    };
    const res = await createRepoInAzureOrg(
      {
        getRepositories: () => {
          return [mockRepo];
        },
      } as any,
      "testRepo",
      "testProject"
    );
    expect(res).toStrictEqual(mockRepo);
    expect(fnCreateRepo).toBeCalledTimes(0);
    fnCreateRepo.mockReset();
  });
  it("positive test: repo does not exist", async () => {
    const fnCreateRepo = jest.spyOn(gitService, "createRepo");
    fnCreateRepo.mockReturnValueOnce(
      Promise.resolve({
        id: "testRepo",
      })
    );

    const res = await createRepoInAzureOrg(
      {
        getRepositories: () => {
          return [];
        },
      } as any,
      "testRepo",
      "testProject"
    );
    expect(res).toStrictEqual({
      id: "testRepo",
    });
    expect(fnCreateRepo).toBeCalledTimes(1);
    fnCreateRepo.mockReset();
  });
  it("positive test: repo already exists and recreate", async () => {
    const mockRepo = {
      id: "testRepo",
      name: "testRepo",
      project: {
        name: "testProject",
      },
    };
    const fnCreateRepo = jest.spyOn(gitService, "createRepo");
    fnCreateRepo.mockReturnValueOnce(Promise.resolve(mockRepo));
    const fnDeleteRepo = jest.spyOn(gitService, "deleteRepo");
    fnDeleteRepo.mockReturnValueOnce(Promise.resolve());

    const res = await createRepoInAzureOrg(
      {
        getRepositories: () => {
          return [mockRepo];
        },
      } as any,
      "testRepo",
      "testProject",
      true
    );
    expect(res).toStrictEqual(mockRepo);

    expect(fnCreateRepo).toBeCalledTimes(1);
    expect(fnDeleteRepo).toBeCalledTimes(1);
    fnCreateRepo.mockReset();
    fnDeleteRepo.mockReset();
  });
});

describe("test commitAndPushToRemote function", () => {
  it("positive test", async () => {
    await commitAndPushToRemote(
      {
        addRemote: jest.fn,
        commit: jest.fn,
        getRemotes: () => {
          return [];
        },
        log: () => {
          return {
            all: [
              {
                date: "2020-03-01 07:50:48 -0800",
                message: "Initial commit for some repo",
              },
            ],
          };
        },
        push: jest.fn,
      } as any,
      mockRequestContext,
      "repoName"
    );
  });
  it("negative test", async () => {
    await expect(
      commitAndPushToRemote(
        {
          commit: () => {
            throw new Error("fake");
          },
        } as any,
        mockRequestContext,
        "repoName"
      )
    ).rejects.toThrow();
  });
});

describe("test completePullRequest function", () => {
  it("negative test: no active pull requests", async () => {
    jest.spyOn(azureGit, "getActivePullRequests").mockResolvedValueOnce([]);
    await expect(
      completePullRequest({} as any, mockRequestContext, HLD_REPO)
    ).rejects.toThrow(
      getErrorMessage("setup-cmd-cannot-locate-pr-for-approval")
    );
  });
  it("negative test: active pull request with no id", async () => {
    jest
      .spyOn(azureGit, "getActivePullRequests")
      .mockResolvedValueOnce([{} as any]);
    await expect(
      completePullRequest({} as any, mockRequestContext, HLD_REPO)
    ).rejects.toThrow(
      getErrorMessage("setup-cmd-cannot-locate-pr-for-approval")
    );
  });
  it("positve test", async () => {
    jest
      .spyOn(azureGit, "getActivePullRequests")
      .mockResolvedValueOnce([{ pullRequestId: 123 } as any]);
    jest.spyOn(azureGit, "completePullRequest").mockResolvedValueOnce();
    await completePullRequest({} as any, mockRequestContext, HLD_REPO);
  });
});
