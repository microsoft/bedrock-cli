import * as path from "path";
import { Config, loadConfiguration } from "../../config";
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

beforeAll(() => {
  process.env.test_name = "my_storage_account";
  process.env.test_key = "my_storage_key";
  const mockFileName = "src/commands/mocks/spk-config.yaml";
  const filename = path.resolve(mockFileName);
  loadConfiguration(filename);
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
  test("Has repo_access_token specified", () => {
    Config().introspection!.azure!.source_repo_access_token = "test_token";
    const envVars = getEnvVars().toString();
    const expectedSubstring = "REACT_APP_SOURCE_REPO_ACCESS_TOKEN=test_token";
    expect(envVars.includes(expectedSubstring)).toBeTruthy();
  });
  test("No repo_access_token was specified", () => {
    const config = Config();
    config.introspection!.azure!.source_repo_access_token = undefined;
    const envVars = getEnvVars().toString();
    const expectedSubstring =
      "REACT_APP_SOURCE_REPO_ACCESS_TOKEN=" +
      config.azure_devops!.access_token!;
    expect(envVars.includes(expectedSubstring)).toBeTruthy();
  });
});

describe("Extract manifest repository information", () => {
  test("Manifest repository information is successfully extracted", () => {
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
