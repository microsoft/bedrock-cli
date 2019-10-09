import * as path from "path";
import { config, loadConfiguration } from "./../init";
import { isValidConfig } from "./validate";

beforeEach(() => {
  process.env.test_name = "my_storage_account";
  process.env.test_key = "my_storage_key";
  const mockFileName = "src/commands/mocks/spk-config.yaml";
  const filename = path.resolve(mockFileName);
  loadConfiguration(filename);
});

describe("Validate deployment configuration", () => {
  test("valid deployment configuration", async () => {
    const isValid = isValidConfig();
    expect(isValid).toBe(true);
  });
});

describe("Validate missing deployment configuration", () => {
  test("no deployment configuration", async () => {
    config.introspection = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage", async () => {
    config.introspection!.azure = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.account_name configuration", async () => {
    config.introspection!.azure!.account_name = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.table_name configuration", async () => {
    config.introspection!.azure!.table_name = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.partition_key configuration", async () => {
    config.introspection!.azure!.partition_key = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.key configuration", async () => {
    config.introspection!.azure!.key = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.pipeline configuration", () => {
  test("missing deployment.pipeline configuration", async () => {
    config.azure_devops = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.pipeline configuration", () => {
  test("missing deployment.pipeline.org configuration", async () => {
    config.azure_devops!.org = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});

describe("Validate missing deployment.pipeline configuration", () => {
  test("missing deployment.pipeline.project configuration", async () => {
    config.azure_devops!.project = undefined;
    const isValid = isValidConfig();

    expect(isValid).toBe(false);
  });
});
