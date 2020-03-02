import path from "path";
import { readYaml } from "../config";
import * as config from "../config";
import * as azdoClient from "../lib/azdoClient";
import { createTempDir } from "../lib/ioUtil";
import * as projectService from "../lib/setup/projectService";
import * as promptInstance from "../lib/setup/prompt";
import { IConfigYaml } from "../types";
import { createSPKConfig, execute } from "./setup";
import * as setup from "./setup";

describe("test createSPKConfig function", () => {
  it("positive test", () => {
    const tmpFile = path.join(createTempDir(), "config.yaml");
    jest.spyOn(config, "defaultConfigFile").mockReturnValueOnce(tmpFile);
    const input = {
      azdo_org_name: "orgname",
      azdo_pat: "pat",
      azdo_project_name: "project"
    };
    createSPKConfig(input);
    const data = readYaml<IConfigYaml>(tmpFile);
    expect(data.azure_devops).toStrictEqual({
      access_token: "pat",
      org: "orgname",
      project: "project"
    });
  });
});

const testExecuteFunc = async (usePrompt = true, hasProject = true) => {
  const exitFn = jest.fn();

  if (usePrompt) {
    jest.spyOn(promptInstance, "prompt").mockReturnValueOnce(
      Promise.resolve({
        azdo_org_name: "orgname",
        azdo_pat: "pat",
        azdo_project_name: "project"
      })
    );
  } else {
    jest.spyOn(promptInstance, "getAnswerFromFile").mockReturnValueOnce({
      azdo_org_name: "orgname",
      azdo_pat: "pat",
      azdo_project_name: "project"
    });
  }
  jest.spyOn(setup, "createSPKConfig").mockReturnValueOnce();
  jest.spyOn(azdoClient, "getWebApi").mockReturnValueOnce(
    Promise.resolve({
      getCoreApi: async () => {
        return {};
      }
    } as any)
  );
  if (hasProject) {
    jest
      .spyOn(projectService, "getProject")
      .mockReturnValueOnce(Promise.resolve({} as any));
  } else {
    jest
      .spyOn(projectService, "getProject")
      .mockReturnValueOnce(Promise.resolve(undefined as any));
  }
  const fncreateProject = jest
    .spyOn(projectService, "createProject")
    .mockReturnValueOnce(Promise.resolve());

  if (usePrompt) {
    await execute(
      {
        file: undefined
      },
      exitFn
    );
  } else {
    await execute(
      {
        file: "dummy"
      },
      exitFn
    );
  }

  if (hasProject) {
    expect(fncreateProject).toBeCalledTimes(0);
  } else {
    expect(fncreateProject).toBeCalledTimes(1);
  }
  fncreateProject.mockReset();
  expect(exitFn).toBeCalledTimes(1);
  expect(exitFn.mock.calls).toEqual([[0]]);
};

describe("test execute function", () => {
  it("positive test: interactive mode: project already exist", async () => {
    await testExecuteFunc();
  });
  it("positive test: interactive mode: project do not exist", async () => {
    await testExecuteFunc(true, false);
  });
  it("positive test: file mode: project already exist", async () => {
    await testExecuteFunc(false);
  });
  it("positive test: file mode: project do not exist", async () => {
    await testExecuteFunc(false, false);
  });
  it("negative test: 401 status code", async () => {
    const exitFn = jest.fn();

    jest.spyOn(promptInstance, "prompt").mockReturnValueOnce(
      Promise.resolve({
        azdo_org_name: "orgname",
        azdo_pat: "pat",
        azdo_project_name: "project"
      })
    );
    jest.spyOn(setup, "createSPKConfig").mockReturnValueOnce();
    jest.spyOn(azdoClient, "getWebApi").mockReturnValueOnce(
      Promise.resolve({
        getCoreApi: () => {
          throw {
            message: "Authentication failure",
            statusCode: 401
          };
        }
      } as any)
    );
    await execute(
      {
        file: undefined
      },
      exitFn
    );

    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("negative test: VS402392 error", async () => {
    const exitFn = jest.fn();

    jest.spyOn(promptInstance, "prompt").mockReturnValueOnce(
      Promise.resolve({
        azdo_org_name: "orgname",
        azdo_pat: "pat",
        azdo_project_name: "project"
      })
    );
    jest.spyOn(setup, "createSPKConfig").mockReturnValueOnce();
    jest.spyOn(azdoClient, "getWebApi").mockReturnValueOnce(
      Promise.resolve({
        getCoreApi: () => {
          throw {
            message: "VS402392: "
          };
        }
      } as any)
    );
    await execute(
      {
        file: undefined
      },
      exitFn
    );

    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("negative test: other error", async () => {
    const exitFn = jest.fn();

    jest.spyOn(promptInstance, "prompt").mockReturnValueOnce(
      Promise.resolve({
        azdo_org_name: "orgname",
        azdo_pat: "pat",
        azdo_project_name: "project"
      })
    );
    jest.spyOn(setup, "createSPKConfig").mockReturnValueOnce();
    jest.spyOn(azdoClient, "getWebApi").mockReturnValueOnce(
      Promise.resolve({
        getCoreApi: () => {
          throw {
            message: "other error"
          };
        }
      } as any)
    );
    await execute(
      {
        file: undefined
      },
      exitFn
    );

    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
});
