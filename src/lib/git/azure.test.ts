////////////////////////////////////////////////////////////////////////////////
// Mocks
////////////////////////////////////////////////////////////////////////////////
jest.mock("azure-devops-node-api");
jest.mock("../../commands/init");

////////////////////////////////////////////////////////////////////////////////
// Imports
////////////////////////////////////////////////////////////////////////////////
import { WebApi } from "azure-devops-node-api";
import uuid from "uuid/v4";
import { Config } from "../../commands/init";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { createPullRequest, GitAPI } from "./azure";

////////////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////////////
beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("GitAPI", () => {
  test("should fail when PAT not set", async () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {}
    });

    let invalidPatError: Error | undefined;
    try {
      await GitAPI();
    } catch (err) {
      invalidPatError = err;
    }
    expect(invalidPatError).toBeDefined();
  });

  test("should fail when DevOps org is invalid", async () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {
        access_token: uuid()
      }
    });

    let invalidOrgError: Error | undefined;
    try {
      await GitAPI();
    } catch (err) {
      invalidOrgError = err;
    }
    expect(invalidOrgError).toBeDefined();
  });

  test("should pass if org url and PAT set", async () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {
        access_token: uuid(),
        org: uuid()
      }
    });

    let error: Error | undefined;
    try {
      await GitAPI();
    } catch (err) {
      error = err;
    }
    expect(error).toBeUndefined();
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
      org: uuid()
    }
  }));
  // Mutable copy of the gitApi
  const gitApi: { [name: string]: (...args: any) => Promise<any> } = {
    createPullRequest: async () => ({
      pullRequestId: 123,
      repository: { id: 456 }
    }),
    getBranches: async () => [{ name: "sourceRef" }, { name: "targetRef" }],
    getPullRequests: async () => [],
    getRepositories: async () => [{ url: "my-git-url" }],
    getRepository: async () => ({ webUrl: "http://foobar.com" })
  };
  // Keep a reference to the original gitApi functions so they be reused to reset the mocks
  const originalGitApi = { ...gitApi };
  ((WebApi as unknown) as jest.Mock).mockImplementation(() => ({
    getGitApi: async () => gitApi
  }));

  beforeEach(() => {
    // Reset the gitApi to a the default working state
    for (const [key, func] of Object.entries(originalGitApi)) {
      gitApi[key] = func;
    }
  });

  test("should throw an error when 0 repositories found ", async () => {
    // local mock
    const originalRepos = gitApi.getRepositories;
    gitApi.getRepositories = async () => [];

    let err: Error | undefined;
    try {
      await createPullRequest(uuid(), uuid(), uuid(), {
        description: uuid(),
        originPushUrl: uuid()
      });
    } catch (e) {
      err = e;
    }
    expect(err).not.toBeUndefined();
    expect(err!.message).toMatch(
      /0 repositories found in Azure DevOps associated with PAT/
    );
  });

  test("should fail when source ref for PR is not in DevOps instance", async () => {
    // mock such that the 'sourceRef' has not been pushed to the azdo git
    const originalBranches = gitApi.getBranches;
    gitApi.getBranches = async () => [{ name: "targetRef" }];

    let err: any;
    try {
      await createPullRequest("random title", "sourceRef", "targetRef", {
        description: uuid(),
        originPushUrl: "my-git-url"
      });
    } catch (e) {
      err = e;
    }
    expect(err).not.toBeUndefined();
    expect(err!.message).toMatch(/0 repositories found with remote url/);

    gitApi.getBranches = originalBranches;
  });

  test("should pass when source and target refs exist in azure git and the PR is generated in the DevOps instance", async () => {
    let err: any;
    try {
      await createPullRequest("random title", "sourceRef", "targetRef", {
        description: uuid(),
        originPushUrl: "my-git-url"
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeUndefined();
  });
});
