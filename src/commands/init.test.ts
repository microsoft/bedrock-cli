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
import { IConfigYaml } from "../types";
import {
  execute,
  getConfig,
  handleInteractiveMode,
  prompt,
  validatePersonalAccessToken
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
        interactive: false
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
        interactive: false
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
        interactive: true
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("positive test: with file value", async () => {
    process.env.test_name = "my_storage_account";
    process.env.test_key = "my_storage_key";
    const randomTmpDir = createTempDir();
    const filename = path.resolve(mockFileName);
    saveConfiguration(filename, randomTmpDir);

    const exitFn = jest.fn();
    await execute(
      {
        file: path.join(randomTmpDir, "config.yaml"),
        interactive: false
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
        interactive: true
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
        project: "project"
      }
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
        project: ""
      }
    });
  });
});

describe("test validatePersonalAccessToken function", () => {
  it("positive test", async done => {
    jest.spyOn(axios, "get").mockReturnValueOnce(
      Promise.resolve({
        status: 200
      })
    );
    const result = await validatePersonalAccessToken({
      access_token: "token",
      org: "org",
      project: "project"
    });
    expect(result).toBe(true);
    done();
  });
  it("negative test", async done => {
    jest
      .spyOn(axios, "get")
      .mockReturnValueOnce(Promise.reject(new Error("fake")));
    const result = await validatePersonalAccessToken({
      access_token: "token",
      org: "org",
      project: "project"
    });
    expect(result).toBe(false);
    done();
  });
});

const testHandleInteractiveModeFunc = async (verified: boolean) => {
  jest.spyOn(init, "getConfig").mockReturnValueOnce({
    azure_devops: {
      access_token: "",
      org: "",
      project: ""
    }
  });
  jest.spyOn(init, "prompt").mockReturnValueOnce(
    Promise.resolve({
      azdo_org_name: "org_name",
      azdo_pat: "pat",
      azdo_project_name: "project"
    })
  );
  jest
    .spyOn(init, "validatePersonalAccessToken")
    .mockReturnValueOnce(Promise.resolve(verified));
  const tmpFile = path.join(createTempDir(), "config.yaml");
  jest.spyOn(config, "defaultConfigFile").mockReturnValueOnce(tmpFile);
  await handleInteractiveMode();
  const content = fs.readFileSync(tmpFile, "utf8");
  const data = yaml.safeLoad(content) as IConfigYaml;
  expect(data.azure_devops?.access_token).toBe("pat");
  expect(data.azure_devops?.org).toBe("org_name");
  expect(data.azure_devops?.project).toBe("project");
};

describe("test handleInteractiveMode function", () => {
  it("postive test: verified access token", async done => {
    await testHandleInteractiveModeFunc(true);
    done();
  });
  it("negative test", async done => {
    await testHandleInteractiveModeFunc(false);
    done();
  });
});

describe("test prompt function", () => {
  it("positive test", async done => {
    const answers = {
      azdo_org_name: "org",
      azdo_pat: "pat",
      azdo_project_name: "project"
    };
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce(answers);
    const ans = await prompt({});
    expect(ans).toStrictEqual(answers);
    done();
  });
});
