// Mocks
jest.mock("../../config");

import { Config } from "../../config";
import { exec } from "../../lib/shell";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { validatePrereqs } from "../infra/validate";
import {
  extractManifestRepositoryInformation,
  getEnvVars,
  launchDashboard
} from "./dashboard";

import uuid from "uuid/v4";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("Validate dashboard container pull", () => {
  test("Pull dashboard container if docker is installed", async () => {
    try {
      const dashboardContainerId = await launchDashboard(2020, false);
      const dockerInstalled = await validatePrereqs(["docker"], false);
      if (dockerInstalled) {
        const dockerId = await exec("docker", [
          "images",
          "-q",
          Config().introspection!.dashboard!.image!
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
      const dashboardContainerId = await launchDashboard(2020, true);
      const dockerInstalled = await validatePrereqs(["docker"], false);
      if (dockerInstalled) {
        const dockerId = await exec("docker", [
          "images",
          "-q",
          Config().introspection!.dashboard!.image!
        ]);

        expect(dockerId).toBeDefined();
        expect(dashboardContainerId).not.toBe("");
        logger.info("Verified that docker image has been pulled.");
        const dashboardContainerId2 = await launchDashboard(2020, true);
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
    (Config as jest.Mock).mockReturnValue({
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
    const envVars = (await getEnvVars()).toString();
    logger.info(
      `spin: ${envVars}, act: ${
        Config().introspection!.azure!.source_repo_access_token
      }`
    );
    const expectedSubstring = "REACT_APP_SOURCE_REPO_ACCESS_TOKEN=test_token";
    expect(envVars.includes(expectedSubstring)).toBeTruthy();
  });

  test("No repo_access_token was specified", async () => {
    const sourceRepoAccessToken = uuid();
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {
        access_token: sourceRepoAccessToken,
        org: uuid(),
        project: uuid()
      },
      introspection: {
        azure: {
          account_name: uuid(),
          key: uuid(),
          partition_key: uuid(),
          source_repo_access_token: undefined,
          table_name: uuid()
        }
      }
    });
    const envVars = (await getEnvVars()).toString();
    const expectedSubstring =
      "REACT_APP_SOURCE_REPO_ACCESS_TOKEN=" + sourceRepoAccessToken;
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

    let manifestInfo = extractManifestRepositoryInformation();
    expect(manifestInfo).toBeDefined();
    expect(manifestInfo!.githubUsername).toBeUndefined();
    expect(manifestInfo!.manifestRepoName).toBe("materialized");
    const config = Config();
    config.azure_devops!.manifest_repository =
      "https://github.com/username/manifest";
    manifestInfo = extractManifestRepositoryInformation();
    expect(manifestInfo).toBeDefined();
    expect(manifestInfo!.githubUsername).toBe("username");
    expect(manifestInfo!.manifestRepoName).toBe("manifest");

    logger.info("Verified that manifest repository extraction works");
  });
});
