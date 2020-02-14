import { write } from "../../config";
import * as azure from "../../lib/git/azure";
import * as gitutils from "../../lib/gitutils";
import { createTempDir } from "../../lib/ioUtil";
import { IBedrockFile } from "../../types";
import {
  getDefaultRings,
  getSourceBranch,
  makePullRequest
} from "./create-revision";

jest
  .spyOn(gitutils, "getCurrentBranch")
  .mockReturnValueOnce(Promise.resolve("prod"))
  .mockReturnValue(Promise.resolve(""));
const prSpy = jest
  .spyOn(azure, "createPullRequest")
  .mockReturnValue(Promise.resolve("done"));

describe("Default rings", () => {
  test("Get multiple default rings", () => {
    const randomTmpDir = createTempDir();
    const validBedrockYaml: IBedrockFile = {
      rings: {
        master: { isDefault: true },
        prod: { isDefault: false },
        westus: { isDefault: true }
      },
      services: {
        "foo/a": {
          helm: {
            chart: {
              chart: "elastic",
              repository: "some-repo"
            }
          },
          k8sBackend: "backendservice",
          k8sBackendPort: 1337,
          pathPrefix: "servicepath",
          pathPrefixMajorVersion: "v1"
        }
      }
    };

    write(validBedrockYaml, randomTmpDir);
    const defaultRings = getDefaultRings(undefined, validBedrockYaml);
    expect(defaultRings.length).toBe(2);
    expect(defaultRings[0]).toBe("master");
    expect(defaultRings[1]).toBe("westus");
  });

  test("No default rings", () => {
    const randomTmpDir = createTempDir();
    const validBedrockYaml: IBedrockFile = {
      rings: {
        master: { isDefault: false },
        prod: { isDefault: false },
        westus: { isDefault: false }
      },
      services: {
        "foo/a": {
          helm: {
            chart: {
              chart: "elastic",
              repository: "some-repo"
            }
          },
          k8sBackend: "backendservice",
          k8sBackendPort: 1337,
          pathPrefix: "servicepath",
          pathPrefixMajorVersion: "v1"
        }
      }
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
  test("Defined source branch", async () => {
    const branch = "master";
    const sourceBranch = await getSourceBranch(branch);
    expect(sourceBranch).toBe("master");
  });
  test("Defined source branch", async () => {
    const branch = undefined;
    const sourceBranch = await getSourceBranch(branch);
    expect(sourceBranch).toBe("prod");
  });
  test("No source branch", async () => {
    const branch = undefined;
    let hasError = false;
    try {
      await getSourceBranch(branch);
    } catch (err) {
      hasError = true;
    }
    expect(hasError).toBe(true);
  });
});

describe("Create pull request", () => {
  test("invalid parameters", async () => {
    for (const i of Array(4).keys()) {
      let hasError = false;
      try {
        await makePullRequest(
          ["master"],
          "testTitle",
          i === 0 ? undefined : "branch",
          "description",
          i === 1 ? undefined : "org",
          i === 2 ? undefined : "url",
          i === 3 ? undefined : "token"
        );
      } catch (err) {
        hasError = true;
      }
      expect(hasError).toBe(true);
    }
  });
  test("Valid parameters", async () => {
    await makePullRequest(
      ["master"],
      "testTitle",
      "testBranch",
      "testDescription",
      "testOrg",
      "testUrl",
      "testToken"
    );
    expect(prSpy).toHaveBeenCalled();
  });
  test("Default description", async () => {
    await makePullRequest(
      ["master"],
      "testTitle",
      "testBranch",
      undefined,
      "testOrg",
      "testUrl",
      "testToken"
    );
    expect(prSpy).toHaveBeenCalled();
  });
  test("Default title", async () => {
    await makePullRequest(
      ["master"],
      undefined,
      "testBranch",
      "description",
      "testOrg",
      "testUrl",
      "testToken"
    );
    expect(prSpy).toHaveBeenCalled();
  });
});
