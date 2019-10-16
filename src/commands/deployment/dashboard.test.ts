import * as path from "path";
import { Config, loadConfiguration } from "../../config";
import { exec } from "../../lib/shell";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { validatePrereqs } from "../infra/validate";
import { launchDashboard } from "./dashboard";

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
      const dashboardContainerId = await launchDashboard(2020);
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
