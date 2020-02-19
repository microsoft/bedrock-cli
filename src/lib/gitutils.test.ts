import { when } from "jest-when";
import {
  checkoutBranch,
  commitPath,
  deleteBranch,
  getAzdoOriginUrl,
  getCurrentBranch,
  getOriginUrl,
  getPullRequestLink,
  getRepositoryName,
  getRepositoryUrl,
  pushBranch,
  safeGitUrlForLogging
} from "../lib/gitutils";
import { disableVerboseLogging, enableVerboseLogging } from "../logger";
import { exec } from "./shell";

jest.mock("./shell");

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

beforeEach(() => {
  jest.resetAllMocks();
});

describe("safeGitUrlForLogging", () => {
  it("should return a git url without access tokens when given a url with access tokens", async () => {
    const testUrl =
      "https://service_account:token@github.com/microsoft/spk.git";
    const expected = "https://github.com/microsoft/spk.git";

    expect(safeGitUrlForLogging(testUrl)).toEqual(expected);
  });

  it("should return the same git url when given a url without access tokens", async () => {
    const testUrl = "https://github.com/microsoft/spk.git";
    const expected = "https://github.com/microsoft/spk.git";

    expect(safeGitUrlForLogging(testUrl)).toEqual(expected);
  });
});

describe("getCurrentBranch", () => {
  it("should call exec with the proper git arguments", async () => {
    (exec as jest.Mock).mockReturnValue("currentBranch");

    const currentBranch = await getCurrentBranch();

    expect(currentBranch).toEqual("currentBranch");
    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledWith("git", ["branch", "--show-current"], {
      cwd: process.cwd()
    });
  });

  it("should return an error when exec throws an error", async () => {
    (exec as jest.Mock).mockImplementation(() => {
      throw new Error("sample error.");
    });

    let error: Error | undefined;
    try {
      const currentBranch = await getCurrentBranch();
    } catch (_) {
      error = _;
    }

    expect(error).not.toBeUndefined();
  });
});

describe("checkoutBranch", () => {
  it("should call exec with the proper git arguments", async () => {
    (exec as jest.Mock).mockClear();

    const branchName = "mynewbranch";
    await checkoutBranch(branchName, false);

    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledWith("git", ["checkout", `${branchName}`]);
  });

  it("should call exec with the proper git arguments; creating a new branch", async () => {
    (exec as jest.Mock).mockClear();
    const branchName = "mynewbranch";
    await checkoutBranch(branchName, true);

    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledWith("git", [
      "checkout",
      "-b",
      `${branchName}`
    ]);
  });

  it("should return an error when exec throws an error", async () => {
    (exec as jest.Mock).mockImplementation(() => {
      throw new Error("sample error.");
    });

    let error: Error | undefined;
    try {
      await checkoutBranch("branchName", false);
    } catch (_) {
      error = _;
    }

    expect(error).not.toBeUndefined();
  });
});

describe("deleteBranch", () => {
  it("should call exec with the proper git arguments", async () => {
    (exec as jest.Mock).mockClear();
    const branchName = "mynewbranch";
    await deleteBranch(branchName);

    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledWith("git", ["branch", "-D", `${branchName}`]);
  });

  it("should return an error when exec throws an error", async () => {
    (exec as jest.Mock).mockImplementation(() => {
      throw new Error("sample error.");
    });

    let error: Error | undefined;
    try {
      await deleteBranch("branchName");
    } catch (_) {
      error = _;
    }

    expect(error).not.toBeUndefined();
  });
});

describe("commitDir", () => {
  it("should call exec with the proper git arguments", async () => {
    (exec as jest.Mock).mockClear();
    const directory = "./my/service/dir";
    const bedrockFile = "./my/service/bedrock.yaml";
    const maintainersFile = "./my/service/maintainers.yaml";
    const branchName = "mynewbranch";
    await commitPath(branchName, directory, bedrockFile, maintainersFile);

    expect(exec).toHaveBeenCalledTimes(2);
    expect(exec).toHaveBeenCalledWith("git", [
      "add",
      directory,
      bedrockFile,
      maintainersFile
    ]);
    expect(exec).toHaveBeenCalledWith("git", [
      "commit",
      "-m",
      `Adding new service: ${branchName}`
    ]);
  });

  it("should return an error when exec throws an error", async () => {
    (exec as jest.Mock).mockImplementation(() => {
      throw new Error("sample error.");
    });

    let error: Error | undefined;
    try {
      await commitPath("branchName", "directory");
    } catch (_) {
      error = _;
    }

    expect(error).not.toBeUndefined();
  });
});

describe("pushBranch", () => {
  it("should call exec with the proper git arguments", async () => {
    (exec as jest.Mock).mockClear();
    const branchName = "mynewbranch";
    await pushBranch(branchName);

    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledWith("git", [
      "push",
      "-u",
      "origin",
      `${branchName}`
    ]);
  });

  it("should return an error when exec throws an error", async () => {
    (exec as jest.Mock).mockImplementation(() => {
      throw new Error("sample error.");
    });

    let error: Error | undefined;
    try {
      await pushBranch("branchName");
    } catch (_) {
      error = _;
    }

    expect(error).not.toBeUndefined();
  });
});

describe("getOriginUrl", () => {
  it("should call exec with the proper git arguments", async () => {
    const originUrl = "foo";

    when(exec as jest.Mock)
      .calledWith("git", ["config", "--get", "remote.origin.url"])
      .mockReturnValue(originUrl);

    const originUrlResponse = await getOriginUrl();

    expect(originUrlResponse).toEqual(originUrl);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledWith(
      "git",
      ["config", "--get", "remote.origin.url"],
      { cwd: "." }
    );
  });

  it("should call exec with the proper git arguments with a repo path", async () => {
    const originUrl = "foo";
    const repoPath = "/repo/path";

    when(exec as jest.Mock)
      .calledWith("git", ["config", "--get", "remote.origin.url"], {
        cwd: repoPath
      })
      .mockReturnValue(originUrl);

    const originUrlResponse = await getOriginUrl(repoPath);

    expect(originUrlResponse).toEqual(originUrl);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledWith(
      "git",
      ["config", "--get", "remote.origin.url"],
      { cwd: repoPath }
    );
  });

  it("should return an error when exec throws an error", async () => {
    (exec as jest.Mock).mockImplementation(() => {
      throw new Error("sample error.");
    });

    let error: Error | undefined;
    try {
      await getOriginUrl();
    } catch (_) {
      error = _;
    }

    expect(error).not.toBeUndefined();
  });
});

describe("getAzdoOriginUrl", () => {
  it("should call exec with the proper git arguments", async () => {
    const originUrl = "foo";

    when(exec as jest.Mock)
      .calledWith("echo", ["$(Build.Repository.Uri)"])
      .mockReturnValue(originUrl);

    const originUrlResponse = await getAzdoOriginUrl();

    expect(originUrlResponse).toEqual(originUrl);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledWith("echo", ["$(Build.Repository.Uri)"]);
  });

  it("should return an error when exec throws an error", async () => {
    (exec as jest.Mock).mockImplementation(() => {
      throw new Error("sample error.");
    });

    let error: Error | undefined;
    try {
      await getAzdoOriginUrl();
    } catch (_) {
      error = _;
    }

    expect(error).not.toBeUndefined();
  });
});

describe("getRepositoryName", () => {
  it("returns the repository name for a visualstudio.com HTTPS origin url.", async () => {
    const originUrl =
      "https://some-org.visualstudio.com/some-project/_git/some-repo";
    const repositoryName = getRepositoryName(originUrl);

    expect(repositoryName).toEqual(`some-repo`);
  });

  it("returns the repository name for a visualstudio.com SSH origin url.", async () => {
    const originUrl =
      "foobar@vs-ssh.visualstudio.com:v3/some-org/some-project/some-repo";
    const repositoryName = getRepositoryName(originUrl);

    expect(repositoryName).toEqual(`some-repo`);
  });

  it("returns the repository name for an AzDo HTTPS origin url.", async () => {
    const originUrl =
      "https://user@dev.azure.com/myorg/spk-test-project/_git/new-repo";
    const repositoryName = getRepositoryName(originUrl);

    expect(repositoryName).toEqual(`new-repo`);
  });

  it("returns the repository name for an AzDo SSH origin url.", async () => {
    const originUrl =
      "git@ssh.dev.azure.com:v3/mitarng/spk-test-project/new-repo";
    const repositoryName = getRepositoryName(originUrl);

    expect(repositoryName).toEqual(`new-repo`);
  });

  it("returns the repository name for a GitHub HTTPS origin url.", async () => {
    const originUrl = "https://github.com/CatalystCode/spk.git";
    const repositoryName = getRepositoryName(originUrl);

    expect(repositoryName).toEqual(`spk`);
  });

  it("returns the repository name for a GitHub SSH origin url.", async () => {
    const originUrl = "git@github.com:CatalystCode/spk.git";
    const repositoryName = getRepositoryName(originUrl);

    expect(repositoryName).toEqual(`spk`);
  });

  it("Returns a help message for unknown or unsupported git providers.", async () => {
    const originUrl = "git@bitbucket.com:org/spk.git";
    let threwError = false;
    try {
      getRepositoryName(originUrl);
    } catch (e) {
      threwError = true;
    }
    expect(threwError).toEqual(true);
  });
});

describe("getRepositoryUrl", () => {
  it("return a proper repo url for a visualstudio.com HTTP origin url.", async () => {
    const originUrl =
      "https://some-org.visualstudio.com/some-project/_git/some-repo";
    const repositoryUrl = getRepositoryUrl(originUrl);

    expect(repositoryUrl).toEqual(
      `https://some-org.visualstudio.com/some-project/_git/some-repo`
    );
  });

  it("return a proper repo url for a visualstudio.com SSH origin url.", async () => {
    const originUrl =
      "foobar@vs-ssh.visualstudio.com:v3/some-org/some-project/some-repo";
    const repositoryUrl = getRepositoryUrl(originUrl);

    expect(repositoryUrl).toEqual(
      `https://some-org.visualstudio.com/some-project/_git/some-repo`
    );
  });

  it("return a proper repo url for an AzDo HTTP origin url.", async () => {
    const originUrl =
      "https://user@dev.azure.com/myorg/spk-test-project/_git/new-repo";
    const repositoryUrl = getRepositoryUrl(originUrl);

    expect(repositoryUrl).toEqual(
      `https://dev.azure.com/myorg/spk-test-project/_git/new-repo`
    );
  });

  it("return a proper repo url for an AzDo SSH origin url.", async () => {
    const originUrl =
      "git@ssh.dev.azure.com:v3/mitarng/spk-test-project/new-repo";
    const repositoryUrl = getRepositoryUrl(originUrl);

    expect(repositoryUrl).toEqual(
      `https://dev.azure.com/mitarng/spk-test-project/_git/new-repo`
    );
  });

  it("return a proper repo url for a GitHub HTTP origin url.", async () => {
    const originUrl = "https://github.com/CatalystCode/spk.git";
    const repositoryUrl = getRepositoryUrl(originUrl);

    expect(repositoryUrl).toEqual(`https://github.com/CatalystCode/spk`);
  });

  it("return a proper repo url for a GitHub SSH origin url.", async () => {
    const originUrl = "git@github.com:CatalystCode/spk.git";
    const repositoryUrl = getRepositoryUrl(originUrl);

    expect(repositoryUrl).toEqual(`https://github.com/CatalystCode/spk`);
  });

  it("Returns a help message for unknown or unsupported git providers.", async () => {
    const originUrl = "git@bitbucket.com:org/spk.git";
    let threwError = false;
    try {
      getRepositoryUrl(originUrl);
    } catch (e) {
      threwError = true;
    }
    expect(threwError).toEqual(true);
  });
});

describe("getPullRequestLink", () => {
  it("return a proper PR url for a visualstudio.com SSH origin url.", async () => {
    const originUrl =
      "foobar@vs-ssh.visualstudio.com:v3/some-org/some-project/some-repo";
    const branchName = "master";
    const newBranchName = "foobar";
    const pullRequestUrl = await getPullRequestLink(
      branchName,
      newBranchName,
      originUrl
    );

    expect(pullRequestUrl).toEqual(
      `https://some-org.visualstudio.com/some-project/_git/some-repo/pullrequestcreate?sourceRef=${newBranchName}&targetRef=${branchName}`
    );
  });

  it("return a proper PR url for a visualstudio.com HTTP origin url.", async () => {
    const originUrl =
      "https://some-org.visualstudio.com/some-project/_git/some-repo";
    const branchName = "master";
    const newBranchName = "foobar";
    const pullRequestUrl = await getPullRequestLink(
      branchName,
      newBranchName,
      originUrl
    );

    expect(pullRequestUrl).toEqual(
      `https://some-org.visualstudio.com/some-project/_git/some-repo/pullrequestcreate?sourceRef=${newBranchName}&targetRef=${branchName}`
    );
  });

  it("return a proper PR url for an AzDo HTTP origin url.", async () => {
    const originUrl =
      "https://user@dev.azure.com/myorg/spk-test-project/_git/new-repo";
    const branchName = "oldbranchname";
    const newBranchName = "newbranchname";
    const pullRequestUrl = await getPullRequestLink(
      branchName,
      newBranchName,
      originUrl
    );

    expect(pullRequestUrl).toEqual(
      `https://dev.azure.com/myorg/spk-test-project/_git/new-repo/pullrequestcreate?sourceRef=${newBranchName}&targetRef=${branchName}`
    );
  });

  it("return a proper PR url for an AzDo SSH origin url.", async () => {
    const originUrl =
      "git@ssh.dev.azure.com:v3/mitarng/spk-test-project/new-repo";
    const branchName = "oldbranchname";
    const newBranchName = "newbranchname";
    const pullRequestUrl = await getPullRequestLink(
      branchName,
      newBranchName,
      originUrl
    );

    expect(pullRequestUrl).toEqual(
      `https://dev.azure.com/mitarng/spk-test-project/_git/new-repo/pullrequestcreate?sourceRef=${newBranchName}&targetRef=${branchName}`
    );
  });

  it("return a proper PR url for a GitHub HTTP origin url.", async () => {
    const originUrl = "https://github.com/CatalystCode/spk.git";
    const branchName = "oldbranchname";
    const newBranchName = "newbranchname";
    const pullRequestUrl = await getPullRequestLink(
      branchName,
      newBranchName,
      originUrl
    );

    expect(pullRequestUrl).toEqual(
      `https://github.com/CatalystCode/spk/compare/${branchName}...${newBranchName}?expand=1`
    );
  });

  it("return a proper PR url for a GitHub SSH origin url.", async () => {
    const originUrl = "git@github.com:CatalystCode/spk.git";
    const branchName = "oldbranchname";
    const newBranchName = "newbranchname";
    const pullRequestUrl = await getPullRequestLink(
      branchName,
      newBranchName,
      originUrl
    );

    expect(pullRequestUrl).toEqual(
      `https://github.com/CatalystCode/spk/compare/${branchName}...${newBranchName}?expand=1`
    );
  });

  it("Returns a help message for unknown or unsupported git providers.", async () => {
    const originUrl = "git@bitbucket.com:Org/spk.git";
    const branchName = "oldbranchname";
    const newBranchName = "newbranchname";
    const pullRequestUrl = await getPullRequestLink(
      branchName,
      newBranchName,
      originUrl
    );

    expect(pullRequestUrl).toEqual(
      "Could not determine origin repository, or it is not a supported provider. Please check for the newly pushed branch and open a PR manually."
    );
  });
});
