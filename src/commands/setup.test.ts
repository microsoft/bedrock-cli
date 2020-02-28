import fs from "fs";
import inquirer from "inquirer";
import os from "os";
import path from "path";
import uuid from "uuid/v4";
import { readYaml } from "../config";
import * as config from "../config";
import * as azdoClient from "../lib/azdoClient";
import { createTempDir } from "../lib/ioUtil";
import { IConfigYaml } from "../types";
import {
  createProject,
  createSPKConfig,
  execute,
  getAnswerFromFile,
  getProject,
  PROJECT_NAME,
  prompt
} from "./setup";
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

describe("test getProject function", () => {
  it("positive test", async () => {
    const res = await getProject(
      {
        getProject: async () => {
          return {
            valid: true
          };
        }
      } as any,
      "test"
    );
    expect(res).toBeDefined();
  });
  it("negative test", async () => {
    const res = await getProject(
      {
        getProject: async () => {
          return null;
        }
      } as any,
      "test"
    );
    expect(res).toBeNull();
  });
  it("negative test: Authorization issue", async () => {
    await expect(
      getProject(
        {
          getProject: () => {
            throw {
              message: "Authentication Failed",
              statusCode: 401
            };
          }
        } as any,
        "test"
      )
    ).rejects.toThrow();
  });
  it("negative test: other error", async () => {
    await expect(
      getProject(
        {
          getProject: () => {
            throw new Error("fake");
          }
        } as any,
        "test"
      )
    ).rejects.toThrow();
  });
});

describe("test createProject function", () => {
  it("positive test", async () => {
    await createProject(
      {
        queueCreateProject: async () => {
          return;
        }
      } as any,
      "test"
    );
  });
  it("negative test: Authorization issue", async () => {
    await expect(
      createProject(
        {
          queueCreateProject: () => {
            throw {
              message: "Authentication Failed",
              statusCode: 401
            };
          }
        } as any,
        "test"
      )
    ).rejects.toThrow();
  });
  it("negative test: other error", async () => {
    await expect(
      createProject(
        {
          queueCreateProject: () => {
            throw new Error("fake");
          }
        } as any,
        "test"
      )
    ).rejects.toThrow();
  });
});

describe("test getAnswerFromFile function", () => {
  it("positive test", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = [
      "azdo_org_name=orgname",
      "azdo_pat=pat",
      "azdo_project_name=project"
    ];
    fs.writeFileSync(file, data.join("\n"));
    const answer = getAnswerFromFile(file);
    expect(answer.azdo_org_name).toBe("orgname");
    expect(answer.azdo_pat).toBe("pat");
    expect(answer.azdo_project_name).toBe("project");
  });
  it("positive test: without project name", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = ["azdo_org_name=orgname", "azdo_pat=pat"];
    fs.writeFileSync(file, data.join("\n"));
    const answer = getAnswerFromFile(file);
    expect(answer.azdo_org_name).toBe("orgname");
    expect(answer.azdo_pat).toBe("pat");
    expect(answer.azdo_project_name).toBe(PROJECT_NAME);
  });
  it("negative test: file does not exist", () => {
    const file = path.join(os.tmpdir(), uuid());
    expect(() => {
      getAnswerFromFile(file);
    }).toThrow();
  });
  it("negative test: missing org name", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = ["azdo_pat=pat"];
    fs.writeFileSync(file, data.join("\n"));
    expect(() => {
      getAnswerFromFile(file);
    }).toThrow();
  });
  it("negative test: invalid project name", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = [
      "azdo_org_name=orgname",
      "azdo_project_name=.project",
      "azdo_pat=pat"
    ];
    fs.writeFileSync(file, data.join("\n"));
    expect(() => {
      getAnswerFromFile(file);
    }).toThrow();
  });
  it("negative test: missing pat", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = ["azdo_org_name=orgname"];
    fs.writeFileSync(file, data.join("\n"));
    expect(() => {
      getAnswerFromFile(file);
    }).toThrow();
  });
});

describe("test prompt function", () => {
  it("positive test", async () => {
    const answers = {
      azdo_org_name: "org",
      azdo_pat: "pat",
      azdo_project_name: "project"
    };
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce(answers);
    const ans = await prompt();
    expect(ans).toStrictEqual(answers);
  });
});

const testExecuteFunc = async (usePrompt = true, hasProject = true) => {
  const exitFn = jest.fn();

  if (usePrompt) {
    jest.spyOn(setup, "prompt").mockReturnValueOnce(
      Promise.resolve({
        azdo_org_name: "orgname",
        azdo_pat: "pat",
        azdo_project_name: "project"
      })
    );
  } else {
    jest.spyOn(setup, "getAnswerFromFile").mockReturnValueOnce({
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
      .spyOn(setup, "getProject")
      .mockReturnValueOnce(Promise.resolve({} as any));
  } else {
    jest
      .spyOn(setup, "getProject")
      .mockReturnValueOnce(Promise.resolve(undefined as any));
  }
  const fncreateProject = jest
    .spyOn(setup, "createProject")
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

    jest.spyOn(setup, "prompt").mockReturnValueOnce(
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

    jest.spyOn(setup, "prompt").mockReturnValueOnce(
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
});
