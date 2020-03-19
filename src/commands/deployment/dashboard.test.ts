/* eslint-disable @typescript-eslint/camelcase */
jest.mock("open");
import open from "open";
jest.mock("../../config");
import { Config } from "../../config";
import { exec } from "../../lib/shell";
import { validatePrereqs } from "../../lib/validator";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import {
  execute,
  extractManifestRepositoryInformation,
  getEnvVars,
  launchDashboard,
  validateValues
} from "./dashboard";
import * as dashboard from "./dashboard";

import uuid from "uuid/v4";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

const mockConfig = (): void => {
  (Config as jest.Mock).mockReturnValueOnce({
    azure_devops: {
      access_token: uuid(),
      org: uuid(),
      project: uuid()
    },
    introspection: {
      azure: {
        account_name: uuid(),
        key: uuid(),
        partition_key: uuid(),
        source_repo_access_token: "test_token",
        table_name: uuid()
      }
    }
  });
};

describe("Test validateValues function", () => {
  it("Invalid Port Number", () => {
    const config = Config();
    try {
      validateValues(config, {
        port: "abc",
        removeAll: false
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
          removeAll: false
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
    const config = Config();
    validateValues(config, {
      port: "4000",
      removeAll: false
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
    jest.spyOn(dashboard, "validateValues").mockReturnValueOnce();
    (open as jest.Mock).mockReturnValueOnce(Promise.resolve());
    await execute(
      {
        port: "4000",
        removeAll: false
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
        removeAll: false
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
      mockConfig();
      const config = Config();
      const dashboardContainerId = await launchDashboard(config, 2020, false);
      const dockerInstalled = validatePrereqs(["docker"], false);
      if (dockerInstalled) {
        const dockerId = await exec("docker", [
          "images",
          "-q",
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          config.introspection!.dashboard!.image!
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
      mockConfig();
      const config = Config();
      const dashboardContainerId = await launchDashboard(config, 2020, true);
      const dockerInstalled = validatePrereqs(["docker"], false);
      if (dockerInstalled) {
        const dockerId = await exec("docker", [
          "images",
          "-q",
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          config.introspection!.dashboard!.image!
        ]);

        expect(dockerId).toBeDefined();
        expect(dashboardContainerId).not.toBe("");
        logger.info("Verified that docker image has been pulled.");
        const dashboardContainerId2 = await launchDashboard(config, 2020, true);
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
    mockConfig();
    const config = Config();
    const envVars = (await getEnvVars(config)).toString();
    logger.info(
      `spin: ${envVars}, act: ${
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        config.introspection!.azure!.source_repo_access_token
      }`
    );
    const expectedSubstring = "REACT_APP_SOURCE_REPO_ACCESS_TOKEN=test_token";
    expect(envVars.includes(expectedSubstring)).toBeTruthy();
  });

  it("No repo_access_token was specified", async () => {
    mockConfig();
    const config = Config();
    const envVars = (await getEnvVars(config)).toString();
    const expectedSubstring =
      "REACT_APP_SOURCE_REPO_ACCESS_TOKEN=" +
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      config.introspection!.azure!.source_repo_access_token!;
    expect(envVars.includes(expectedSubstring)).toBeTruthy();
  });
});

describe("Extract manifest repository information", () => {
  test("Manifest repository information is successfully extracted", () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {
        manifest_repository:
          "https://dev.azure.com/bhnook/fabrikam/_git/materialized"
      }
    });
    const config = Config();
    let manifestInfo = extractManifestRepositoryInformation(config);
    expect(manifestInfo).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(manifestInfo!.githubUsername).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(manifestInfo!.manifestRepoName).toBe("materialized");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    config.azure_devops!["manifest_repository"] =
      "https://github.com/username/manifest";
    manifestInfo = extractManifestRepositoryInformation(config);
    expect(manifestInfo).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(manifestInfo!.githubUsername).toBe("username");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(manifestInfo!.manifestRepoName).toBe("manifest");

    logger.info("Verified that manifest repository extraction works");
  });
});
