/* eslint-disable @typescript-eslint/camelcase */
import axios from "axios";
import fs from "fs";
import inquirer from "inquirer";
import yaml from "js-yaml";
import path from "path";
import uuid from "uuid";
import { saveConfiguration } from "../config";
import * as config from "../config";
import { createTempDir } from "../lib/ioUtil";
import { disableVerboseLogging, enableVerboseLogging } from "../logger";
import { ConfigYaml } from "../types";
import {
  execute,
  getConfig,
  handleInteractiveMode,
  handleIntrospectionInteractive,
  prompt,
  validatePersonalAccessToken,
} from "./init";
import * as init from "./init";

jest.mock("inquirer");

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

const mockFileName = "src/commands/mocks/spk-config.yaml";

describe("Test execute function", () => {
  it("negative test: missing file value", async () => {
    const exitFn = jest.fn();
    await execute(
      {
        file: undefined,
        interactive: false,
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("negative test: invalid file value", async () => {
    const exitFn = jest.fn();
    await execute(
      {
        file: uuid(),
        interactive: false,
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("negative test: having file value and interactive mode", async () => {
    const exitFn = jest.fn();
    const randomTmpDir = createTempDir();
    await execute(
      {
        file: path.join(randomTmpDir, "config.yaml"),
        interactive: true,
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("positive test: with file value", async () => {
    process.env["test_name"] = "my_storage_account";
    process.env["test_key"] = "my_storage_key";
    const randomTmpDir = createTempDir();
    const filename = path.resolve(mockFileName);
    saveConfiguration(filename, randomTmpDir);

    const exitFn = jest.fn();
    await execute(
      {
        file: path.join(randomTmpDir, "config.yaml"),
        interactive: false,
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
  it("positive test: with interactive mode", async () => {
    jest
      .spyOn(init, "handleInteractiveMode")
      .mockReturnValueOnce(Promise.resolve());
    const exitFn = jest.fn();
    await execute(
      {
        file: "",
        interactive: true,
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
});

describe("test getConfig function", () => {
  it("with configuration file", () => {
    const mockedValues = {
      azure_devops: {
        access_token: "access_token",
        org: "org",
        project: "project",
      },
    };
    jest.spyOn(config, "loadConfiguration").mockReturnValueOnce();
    jest.spyOn(config, "Config").mockReturnValueOnce(mockedValues);
    const cfg = getConfig();
    expect(cfg).toStrictEqual(mockedValues);
  });
  it("without configuration file", () => {
    jest.spyOn(config, "loadConfiguration").mockReturnValueOnce();
    jest.spyOn(config, "Config").mockImplementationOnce(() => {
      throw new Error("fake");
    });
    const cfg = getConfig();
    expect(cfg).toStrictEqual({
      azure_devops: {
        access_token: "",
        org: "",
        project: "",
      },
    });
  });
});

describe("test validatePersonalAccessToken function", () => {
  it("positive test", async (done) => {
    jest.spyOn(axios, "get").mockReturnValueOnce(
      Promise.resolve({
        status: 200,
      })
    );
    const result = await validatePersonalAccessToken({
      access_token: "token",
      org: "org",
      project: "project",
    });
    expect(result).toBe(true);
    done();
  });
  it("negative test", async (done) => {
    jest
      .spyOn(axios, "get")
      .mockReturnValueOnce(Promise.reject(new Error("fake")));
    const result = await validatePersonalAccessToken({
      access_token: "token",
      org: "org",
      project: "project",
    });
    expect(result).toBe(false);
    done();
  });
  it("negative test, no values in parameter", async () => {
    await expect(validatePersonalAccessToken({})).rejects.toThrow();
  });
});

const testHandleInteractiveModeFunc = async (
  verified: boolean
): Promise<void> => {
  jest.spyOn(init, "getConfig").mockReturnValueOnce({
    azure_devops: {
      access_token: "",
      org: "",
      project: "",
    },
    introspection: {
      azure: {},
    },
  });
  jest.spyOn(init, "prompt").mockResolvedValueOnce({
    azdo_org_name: "org_name",
    azdo_pat: "pat",
    azdo_project_name: "project",
    toSetupIntrospectionConfig: true,
  });
  jest
    .spyOn(init, "validatePersonalAccessToken")
    .mockReturnValueOnce(Promise.resolve(verified));
  const tmpFile = path.join(createTempDir(), "config.yaml");

  jest.spyOn(config, "defaultConfigFile").mockReturnValueOnce(tmpFile);
  jest.spyOn(init, "handleIntrospectionInteractive").mockResolvedValueOnce();

  await handleInteractiveMode();
  const content = fs.readFileSync(tmpFile, "utf8");
  const data = yaml.safeLoad(content) as ConfigYaml;
  expect(data.azure_devops?.access_token).toBe("pat");
  expect(data.azure_devops?.org).toBe("org_name");
  expect(data.azure_devops?.project).toBe("project");
};

describe("test handleInteractiveMode function", () => {
  it("postive test: verified access token", async (done) => {
    await testHandleInteractiveModeFunc(true);
    done();
  });
  it("negative test", async (done) => {
    await testHandleInteractiveModeFunc(false);
    done();
  });
});

describe("test prompt function", () => {
  it("positive test", async (done) => {
    const answers = {
      azdo_org_name: "org",
      azdo_pat: "pat",
      azdo_project_name: "project",
      toSetupIntrospectionConfig: true,
    };
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce(answers);
    const ans = await prompt({});
    expect(ans).toStrictEqual(answers);
    done();
  });
});

const testHandleIntrospectionInteractive = async (
  withIntrospection = false,
  withKeyVault = false
): Promise<void> => {
  const config: ConfigYaml = {};
  if (!withIntrospection) {
    config["introspection"] = {
      azure: {},
    };
  }
  jest.spyOn(inquirer, "prompt").mockResolvedValueOnce({
    azdo_storage_account_name: "storagetest",
    azdo_storage_table_name: "storagetabletest",
    azdo_storage_partition_key: "test1234key",
    azdo_storage_access_key: "accessKey",
    azdo_storage_key_vault_name: withKeyVault ? "keyvault" : "",
  });
  await handleIntrospectionInteractive(config);
  expect(config.introspection?.azure?.account_name).toBe("storagetest");
  expect(config.introspection?.azure?.table_name).toBe("storagetabletest");
  expect(config.introspection?.azure?.partition_key).toBe("test1234key");
  expect(config.introspection?.azure?.key).toBe("accessKey");

  if (withKeyVault) {
    expect(config.key_vault_name).toBe("keyvault");
  } else {
    expect(config.key_vault_name).toBeUndefined();
  }
};

describe("test handleIntrospectionInteractive function", () => {
  it("positive test", async () => {
    await testHandleIntrospectionInteractive(false);
    await testHandleIntrospectionInteractive(true);
    await testHandleIntrospectionInteractive(false, true);
    await testHandleIntrospectionInteractive(true, true);
  });
});
