jest.mock("open");
import open from "open";
jest.mock("../../config");
import { Config } from "../../config";
import { exec } from "../../lib/shell";
import { validatePrereqs } from "../../lib/validator";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger,
} from "../../logger";
import {
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
        "value for port option has to be a valid port number"
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
        "You need to specify configuration for your introspection storage account and DevOps pipeline to run this dashboard. Please initialize the spk tool with the right configuration"
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
    jest
      .spyOn(dashboard, "launchDashboard")
      .mockReturnValueOnce(Promise.resolve(uuid()));
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
  test("Has repo_access_token specified", async () => {
    const envVars = (await getEnvVars(dashboardConf)).toString();
    logger.info(
      `spin: ${envVars}, act: ${mockedConf.introspection.azure.source_repo_access_token}`
    );
    const expectedSubstring = "REACT_APP_SOURCE_REPO_ACCESS_TOKEN=test_token";
    expect(envVars.includes(expectedSubstring)).toBeTruthy();
  });

  it("No repo_access_token was specified", async () => {
    const envVars = (await getEnvVars(dashboardConf)).toString();
    const expectedSubstring = `REACT_APP_SOURCE_REPO_ACCESS_TOKEN=${dashboardConf.sourceRepoAccessToken}`;
    expect(envVars.includes(expectedSubstring)).toBeTruthy();
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
