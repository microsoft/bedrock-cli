import * as path from "path";
import { Config, loadConfiguration } from "../../config";
import { exec } from "../../lib/shell";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { validatePrereqs } from "../infra/validate";
import { getEnvVars, launchDashboard } from "./dashboard";

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
    const expectedEnvVars =
      "-e,REACT_APP_PIPELINE_ORG=https://dev.azure.com/bhnook,-e,REACT_APP_PIPELINE_PROJECT=fabrikam,-e,REACT_APP_STORAGE_ACCOUNT_NAME=my_storage_account,-e,REACT_APP_STORAGE_PARTITION_KEY=partition-key,-e,REACT_APP_STORAGE_TABLE_NAME=table-name,-e,REACT_APP_STORAGE_ACCESS_KEY=my_storage_key,-e,REACT_APP_PIPELINE_ACCESS_TOKEN=hpe3a9oiswgcodtfdpzfiek3saxbrh5if1fp673xihgc5ap467a,-e,REACT_APP_SOURCE_REPO_ACCESS_TOKEN=test_token";
    expect(envVars).toBe(expectedEnvVars);
  });
  test("No repo_access_token was specified", () => {
    Config().introspection!.azure!.source_repo_access_token = undefined;
    const envVars = getEnvVars().toString();
    const expectedEnvVars =
      "-e,REACT_APP_PIPELINE_ORG=https://dev.azure.com/bhnook,-e,REACT_APP_PIPELINE_PROJECT=fabrikam,-e,REACT_APP_STORAGE_ACCOUNT_NAME=my_storage_account,-e,REACT_APP_STORAGE_PARTITION_KEY=partition-key,-e,REACT_APP_STORAGE_TABLE_NAME=table-name,-e,REACT_APP_STORAGE_ACCESS_KEY=my_storage_key,-e,REACT_APP_PIPELINE_ACCESS_TOKEN=hpe3a9oiswgcodtfdpzfiek3saxbrh5if1fp673xihgc5ap467a,-e,REACT_APP_SOURCE_REPO_ACCESS_TOKEN=hpe3a9oiswgcodtfdpzfiek3saxbrh5if1fp673xihgc5ap467a";
    expect(envVars).toBe(expectedEnvVars);
  });
});
