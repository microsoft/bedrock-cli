import child_process from "child_process";
import * as path from "path";
import { promisify } from "util";
import { Config, loadConfiguration } from "../../config";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import {
  validateAzure,
  validateEnvVariables,
  validatePrereqs
} from "./validate";

beforeAll(() => {
  enableVerboseLogging();
  jest.setTimeout(30000);
});

afterAll(() => {
  disableVerboseLogging();
  jest.setTimeout(5000);
});

describe("Validating executable prerequisites", () => {
  test("Validate that array of executables do not exists in PATH", async () => {
    // Iterate through an array of non-existent binaries to create a force fail. If fails, then test pass
    const fakeBinaries: string[] = ["ydawgie"];
    const value = await validatePrereqs(fakeBinaries, false);
    expect(value).toBe(false);
  });
});

describe("Validating executable prerequisites in spk-config", () => {
  test("Validate that exectuable boolean matches in spk-config", async () => {
    // Iterate through an array of non-existent binaries to create a force fail. If fails, then test pass
    const mockFileName = "src/commands/mocks/spk-config.yaml";
    const filename = path.resolve(mockFileName);
    process.env.test_name = "my_storage_account";
    process.env.test_key = "my_storage_key";
    loadConfiguration(filename);
    const fakeBinaries: string[] = ["ydawgie"];
    await validatePrereqs(fakeBinaries, true);
    expect(Config().infra!).toBeDefined();
    expect(Config().infra!.checks!).toBeDefined();
    expect(Config().infra!.checks!.ydawgie!).toBe(false);
  });
});

describe("Validating Azure authentication", () => {
  test("Validate that a logged out user produces a force fail", async () => {
    // Produce an error that requires user to login
    await promisify(child_process.exec)("az logout").catch(err => {
      logger.warn(err);
    });
    const value = await validateAzure(false);
    expect(value).toBe(false);
  });
});

describe("Validating Azure login in spk-config", () => {
  test("Validate that az_login_check boolean matches in spk-config", async () => {
    // Iterate through an array of non-existent binaries to create a force fail. If fails, then test pass
    const mockFileName = "src/commands/mocks/spk-config.yaml";
    const filename = path.resolve(mockFileName);
    process.env.test_name = "my_storage_account";
    process.env.test_key = "my_storage_key";
    loadConfiguration(filename);
    await validateAzure(true);
    expect(Config().infra!).toBeDefined();
    expect(Config().infra!.checks!).toBeDefined();
    expect(Config().infra!.checks!.az_login_check!).toBe(false);
  });
});

describe("Validating environment variables", () => {
  test("Test whether environment variables are set and not null", async () => {
    // Set environment variables to null, and create a force fail scenario
    const variables: string[] = ["ydawgie"];
    process.env.ydawgie = "";
    const value = await validateEnvVariables(variables, false);
    expect(value).toBe(false);
  });
});

describe("Validating environment variables in spk-config", () => {
  test("Validate that env_var_check boolean matches in spk-config", async () => {
    // Iterate through an array of non-existent binaries to create a force fail. If fails, then test pass
    const variables: string[] = ["ydawgie"];
    const mockFileName = "src/commands/mocks/spk-config.yaml";
    const filename = path.resolve(mockFileName);
    process.env.test_name = "my_storage_account";
    process.env.test_key = "my_storage_key";
    loadConfiguration(filename);
    await validateEnvVariables(variables, true);
    expect(Config().infra!).toBeDefined();
    expect(Config().infra!.checks!).toBeDefined();
    expect(Config().infra!.checks!.env_var_check!).toBe(false);
  });
});
