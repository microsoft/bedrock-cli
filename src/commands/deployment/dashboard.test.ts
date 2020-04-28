import child_process from "child_process";
jest.mock("open");
import open from "open";
jest.mock("../../config");
import { Config } from "../../config";
import { exec } from "../../lib/shell";
import * as shell from "../../lib/shell";
import { validatePrereqs } from "../../lib/validator";
import * as validator from "../../lib/validator";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger,
} from "../../logger";
import {
  cleanDashboardContainers,
  DashboardConfig,
  execute,
  extractManifestRepositoryInformation,
  getEnvVars,
  launchDashboard,
  validateValues,
} from "./dashboard";
import * as dashboard from "./dashboard";

import uuid from "uuid/v4";
import { deepClone } from "../../lib/util";
import { getErrorMessage } from "../../lib/errorBuilder";

const dashboardConf: DashboardConfig = {
  port: 2020,
  image: "mcr.microsoft.com/k8s/bedrock/spektate:latest",
  org: "testOrg",
  project: "testProject",
  key: "fakeKey",
  accountName: "fakeAccount",
  tableName: "fakeTable",
  partitionKey: "fakePartitionKey",
  accessToken: "accessToken",
  sourceRepoAccessToken: "test_token",
};

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

const mockedConf = {
  azure_devops: {
    access_token: uuid(),
    org: uuid(),
    project: uuid(),
  },
  introspection: {
    dashboard: {
      image: "mcr.microsoft.com/k8s/bedrock/spektate:latest",
      name: "spektate",
    },
    azure: {
      account_name: uuid(),
      key: uuid(),
      partition_key: uuid(),
      source_repo_access_token: "test_token",
      table_name: uuid(),
    },
  },
};

const mockConfig = (): void => {
  (Config as jest.Mock).mockReturnValueOnce(mockedConf);
};

describe("Test validateValues function", () => {
  it("Invalid Port Number", () => {
    const config = Config();
    try {
      validateValues(config, {
        port: "abc",
        removeAll: false,
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e.message).toBe(
        "introspect-dashboard-cmd-invalid-port: value for port option has to be a valid port number. Enter a valid port number."
      );
    }
  });
  it("Invalid Configuration", () => {
    try {
      validateValues(
        {},
        {
          port: "4000",
          removeAll: false,
        }
      );
      expect(true).toBe(false);
    } catch (e) {
      expect(e.message).toBe(
        "introspect-dashboard-cmd-missing-vals: Configuration for storage account and DevOps pipeline were missing. Initialize the bedrock tool with the right configuration."
      );
    }
  });
  it("positive test", () => {
    mockConfig();
    validateValues(Config(), {
      port: "4000",
      removeAll: false,
    });
  });
});

describe("Test execute function", () => {
  it("positive test", async () => {
    mockConfig();
    const exitFn = jest.fn();
    jest.spyOn(dashboard, "launchDashboard").mockResolvedValueOnce(uuid());
    jest.spyOn(dashboard, "validateValues").mockReturnValueOnce(dashboardConf);
    (open as jest.Mock).mockReturnValueOnce(Promise.resolve());
    await execute(
      {
        port: "4000",
        removeAll: false,
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
  it("negative test", async () => {
    const exitFn = jest.fn();
    await execute(
      {
        port: "4000",
        removeAll: false,
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
});

describe("Validate dashboard container pull", () => {
  test("Pull dashboard container if docker is installed", async () => {
    try {
      const dashboardContainerId = await launchDashboard(dashboardConf, false);
      const dockerInstalled = validatePrereqs(["docker"], false);
      if (dockerInstalled) {
        const dockerId = await exec("docker", [
          "images",
          "-q",
          dashboardConf.image,
        ]);
        expect(dockerId).toBeDefined();
        expect(dashboardContainerId).not.toBe("");
        logger.info("Verified that docker image has been pulled.");
        await exec("docker", ["container", "stop", dashboardContainerId]);
      } else {
        expect(dashboardContainerId).toBe("");
      }
    } catch (err) {
      logger.error(err);
    }
  }, 30000);
});

describe("Validate dashboard clean up", () => {
  test("Launch the dashboard two times", async () => {
    try {
      const dashboardContainerId = await launchDashboard(dashboardConf, true);
      const dockerInstalled = validatePrereqs(["docker"], false);
      if (dockerInstalled) {
        const dockerId = await exec("docker", [
          "images",
          "-q",
          dashboardConf.image,
        ]);

        expect(dockerId).toBeDefined();
        expect(dashboardContainerId).not.toBe("");
        logger.info("Verified that docker image has been pulled.");
        const dashboardContainerId2 = await launchDashboard(
          dashboardConf,
          true
        );
        expect(dashboardContainerId).not.toBe(dashboardContainerId2);
        await exec("docker", ["container", "stop", dashboardContainerId2]);
      } else {
        expect(dashboardContainerId).toBe("");
      }
    } catch (err) {
      logger.error(err);
    }
  }, 30000);
});

describe("Fallback to azure devops access token", () => {
  test("with repo_access_token and without sourceRepoAccessToken", async () => {
    const conf = deepClone(dashboardConf);
    delete conf.sourceRepoAccessToken;
    const envVars = getEnvVars(conf).toString();

    expect(
      envVars.includes(`REACT_APP_PIPELINE_ACCESS_TOKEN=${conf.accessToken}`)
    ).toBeTruthy();
    expect(
      envVars.includes(`REACT_APP_SOURCE_REPO_ACCESS_TOKEN=${conf.accessToken}`)
    ).toBeTruthy();
    expect(
      envVars.includes(`REACT_APP_MANIFEST_ACCESS_TOKEN=${conf.accessToken}`)
    ).toBeTruthy();
  });
  test("without repo_access_token and with sourceRepoAccessToken", async () => {
    const conf = deepClone(dashboardConf);
    delete conf.accessToken;
    const envVars = getEnvVars(conf).toString();

    expect(envVars.includes("REACT_APP_PIPELINE_ACCESS_TOKEN")).toBeFalsy();
    expect(
      envVars.includes(
        `REACT_APP_SOURCE_REPO_ACCESS_TOKEN=${dashboardConf.sourceRepoAccessToken}`
      )
    ).toBeTruthy();
    expect(
      envVars.includes(
        `REACT_APP_MANIFEST_ACCESS_TOKEN=${dashboardConf.sourceRepoAccessToken}`
      )
    ).toBeTruthy();
  });
  test("with manifest repository information", async () => {
    jest
      .spyOn(dashboard, "extractManifestRepositoryInformation")
      .mockReturnValueOnce({
        manifestRepoName: "mName",
        githubUsername: "gitUser",
      });
    const envVars = getEnvVars(dashboardConf).toString();

    expect(envVars.includes("REACT_APP_MANIFEST=mName")).toBeTruthy();
    expect(
      envVars.includes("REACT_APP_GITHUB_MANIFEST_USERNAME=gitUser")
    ).toBeTruthy();
  });
  test("negative test", async () => {
    jest
      .spyOn(dashboard, "extractManifestRepositoryInformation")
      .mockImplementationOnce(() => {
        throw Error("fake");
      });
    expect(() => {
      getEnvVars(dashboardConf);
    }).toThrow(getErrorMessage("introspect-dashboard-cmd-get-env"));
  });
});

describe("Extract manifest repository information", () => {
  test("Manifest repository information is successfully extracted", () => {
    const config = deepClone(dashboardConf);
    config.manifestRepository =
      "https://dev.azure.com/bhnook/fabrikam/_git/materialized";

    let manifestInfo = extractManifestRepositoryInformation(config);
    expect(manifestInfo).toBeDefined();

    if (manifestInfo) {
      expect(manifestInfo.githubUsername).toBeUndefined();
      expect(manifestInfo.manifestRepoName).toBe("materialized");
    }

    config.manifestRepository = "https://github.com/username/manifest";
    manifestInfo = extractManifestRepositoryInformation(config);

    expect(manifestInfo).toBeDefined();
    if (manifestInfo) {
      expect(manifestInfo.githubUsername).toBe("username");
      expect(manifestInfo.manifestRepoName).toBe("manifest");
    }

    logger.info("Verified that manifest repository extraction works");
  });
});

describe("test cleanDashboardContainers function", () => {
  it("positive test", async () => {
    const containerIds = ["f5ad0bff2448", "f5ad0bff2449"];
    jest.spyOn(shell, "exec").mockResolvedValueOnce(containerIds.join("\n"));

    jest.spyOn(shell, "exec").mockImplementationOnce(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (
        cmd: string,
        args?: string[],
        opts?: child_process.SpawnOptions
      ): Promise<string> => {
        expect(args).toStrictEqual(["kill", ...containerIds]);
        return "";
      }
    );
    await cleanDashboardContainers({
      image: "fake",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });
  it("negative test: cannot get docker image ids", async () => {
    jest.spyOn(shell, "exec").mockRejectedValueOnce(Error("fake"));

    await expect(
      cleanDashboardContainers({
        image: "fake",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    ).rejects.toThrow(
      getErrorMessage("introspect-dashboard-cmd-kill-docker-container")
    );
  });
  it("negative test: cannot kill images", async () => {
    const containerIds = ["f5ad0bff2448", "f5ad0bff2449"];
    jest.spyOn(shell, "exec").mockResolvedValueOnce(containerIds.join("\n"));

    jest.spyOn(shell, "exec").mockRejectedValueOnce(Error("fake"));
    await expect(
      cleanDashboardContainers({
        image: "fake",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    ).rejects.toThrow(
      getErrorMessage("introspect-dashboard-cmd-kill-docker-container")
    );
  });
});

describe("test launchDashboard function", () => {
  it("postive test", async () => {
    jest.spyOn(validator, "validatePrereqs").mockReturnValueOnce(true);
    jest.spyOn(dashboard, "cleanDashboardContainers").mockResolvedValueOnce();
    jest.spyOn(shell, "exec").mockResolvedValueOnce("ok");
    jest.spyOn(shell, "exec").mockResolvedValueOnce("container-identifier");
    const res = await launchDashboard(dashboardConf, true);
    expect(res).toBe("container-identifier");
  });
  it("negative test", async () => {
    jest.spyOn(validator, "validatePrereqs").mockReturnValueOnce(false);
    await expect(launchDashboard(dashboardConf, true)).rejects.toThrow(
      getErrorMessage("introspect-dashboard-cmd-launch-err")
    );
  });
});
