import { write } from "../../config";
import * as config from "../../config";
import { DEFAULT_CONTENT as BedrockMockedContent } from "../../lib/bedrockYaml";
import * as azure from "../../lib/git/azure";
import * as gitutils from "../../lib/gitutils";
import { createTempDir } from "../../lib/ioUtil";
import { BedrockFile } from "../../types";
import {
  execute,
  getDefaultRings,
  getRemoteUrl,
  getSourceBranch,
  makePullRequest,
} from "./create-revision";
import * as createRevision from "./create-revision";

jest
  .spyOn(gitutils, "getCurrentBranch")
  .mockReturnValueOnce(Promise.resolve("prod"))
  .mockReturnValue(Promise.resolve(""));
jest.spyOn(config, "Config").mockReturnValue({});
jest.spyOn(config, "Bedrock").mockReturnValue(BedrockMockedContent);

describe("test makePullRequest function", () => {
  it("sanity test", async (done) => {
    const createPullRequestFunc = jest.spyOn(azure, "createPullRequest");

    // two times because there are two branches: master and stable
    createPullRequestFunc.mockReturnValue(Promise.resolve({}));

    await makePullRequest(["master", "stable"], {
      description: "description",
      orgName: "testOrg",
      personalAccessToken: "testToken",
      remoteUrl: "testUrl",
      sourceBranch: "testBranch",
      targetBranch: "master",
      title: undefined,
    });

    expect(createPullRequestFunc).toBeCalledTimes(2);
    done();
  });
});

describe("Default rings", () => {
  test("Get multiple default rings", () => {
    const randomTmpDir = createTempDir();
    const validBedrockYaml: BedrockFile = {
      rings: {
        master: { isDefault: true },
        prod: { isDefault: false },
        westus: { isDefault: true },
      },
      services: {
        "foo/a": {
          helm: {
            chart: {
              chart: "elastic",
              repository: "some-repo",
            },
          },
          k8sBackend: "backendservice",
          k8sBackendPort: 1337,
          pathPrefix: "servicepath",
          pathPrefixMajorVersion: "v1",
        },
      },
      version: "1.0",
    };

    write(validBedrockYaml, randomTmpDir);
    const defaultRings = getDefaultRings(undefined, validBedrockYaml);
    expect(defaultRings.length).toBe(2);
    expect(defaultRings[0]).toBe("master");
    expect(defaultRings[1]).toBe("westus");
  });

  test("No default rings", () => {
    const randomTmpDir = createTempDir();
    const validBedrockYaml: BedrockFile = {
      rings: {
        master: { isDefault: false },
        prod: { isDefault: false },
        westus: { isDefault: false },
      },
      services: {
        "foo/a": {
          helm: {
            chart: {
              chart: "elastic",
              repository: "some-repo",
            },
          },
          k8sBackend: "backendservice",
          k8sBackendPort: 1337,
          pathPrefix: "servicepath",
          pathPrefixMajorVersion: "v1",
        },
      },
      version: "1.0",
    };

    write(validBedrockYaml, randomTmpDir);
    let hasError = false;

    try {
      getDefaultRings(undefined, validBedrockYaml);
    } catch (err) {
      hasError = true;
    }
    expect(hasError).toBe(true);
  });
});

describe("Source branch", () => {
  test("Defined source branch", async (done) => {
    const branch = "master";
    const sourceBranch = await getSourceBranch(branch);
    expect(sourceBranch).toBe("master");
    done();
  });
  test("Defined source branch", async (done) => {
    const branch = undefined;
    const sourceBranch = await getSourceBranch(branch);
    expect(sourceBranch).toBe("prod");
    done();
  });
  test("No source branch", async (done) => {
    const branch = undefined;
    let hasError = false;
    try {
      await getSourceBranch(branch);
    } catch (err) {
      hasError = true;
    }
    expect(hasError).toBe(true);
    done();
  });
});

describe("Create pull request", () => {
  test("invalid parameters", async (done) => {
    for (const i of Array(4).keys()) {
      const exitFn = jest.fn();
      jest
        .spyOn(createRevision, "makePullRequest")
        .mockReturnValueOnce(Promise.resolve());
      await execute(
        {
          description: "description",
          orgName: i === 0 ? undefined : "org",
          personalAccessToken: i === 1 ? undefined : "token",
          remoteUrl: i === 2 ? undefined : "url",
          sourceBranch: i === 3 ? undefined : "master",
          targetBranch: undefined,
          title: "testTitle",
        },
        exitFn
      );
      expect(exitFn).toBeCalledTimes(1);
      expect(exitFn.mock.calls).toEqual([[1]]); // status code 1 = error condition
      done();
    }
  });
  test("Invalid parameters: target include source git", async (done) => {
    const exitFn = jest.fn();
    jest
      .spyOn(createRevision, "makePullRequest")
      .mockReturnValueOnce(Promise.resolve());
    await execute(
      {
        description: "testDescription",
        orgName: "testOrg",
        personalAccessToken: "testToken",
        remoteUrl: "testUrl",
        sourceBranch: "master",
        targetBranch: "master",
        title: "testTitle",
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
    done();
  });
  test("Valid parameters", async (done) => {
    const exitFn = jest.fn();
    jest
      .spyOn(createRevision, "makePullRequest")
      .mockReturnValueOnce(Promise.resolve());
    await execute(
      {
        description: "testDescription",
        orgName: "testOrg",
        personalAccessToken: "testToken",
        remoteUrl: "testUrl",
        sourceBranch: "testBranch",
        targetBranch: "master",
        title: "testTitle",
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
    done();
  });
  test("Default description", async (done) => {
    const exitFn = jest.fn();
    jest
      .spyOn(createRevision, "makePullRequest")
      .mockReturnValueOnce(Promise.resolve());
    await execute(
      {
        description: undefined,
        orgName: "testOrg",
        personalAccessToken: "testToken",
        remoteUrl: "testUrl",
        sourceBranch: "testBranch",
        targetBranch: "master",
        title: "testTitle",
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
    done();
  });
  it("Default title", async (done) => {
    const exitFn = jest.fn();
    jest
      .spyOn(createRevision, "makePullRequest")
      .mockReturnValueOnce(Promise.resolve());
    await execute(
      {
        description: "description",
        orgName: "testOrg",
        personalAccessToken: "testToken",
        remoteUrl: "testUrl",
        sourceBranch: "testBranch",
        targetBranch: "master",
        title: undefined,
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
    done();
  });
});

describe("test getRemoteUrl function", () => {
  it("sanity test: get original url", async (done) => {
    const res = await getRemoteUrl(undefined);
    expect(!!res.match(/(.*?)\/spk/i)).toBe(true);
    done();
  });
  it("sanity test", async (done) => {
    const res = await getRemoteUrl("https://github.com/CatalystCode/spk1");
    expect(res).toBe("https://github.com/CatalystCode/spk1");
    done();
  });
});
