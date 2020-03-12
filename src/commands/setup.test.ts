/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/camelcase */
import path from "path";
import { readYaml } from "../config";
import * as config from "../config";
import * as azdoClient from "../lib/azdoClient";
import * as azureContainerRegistryService from "../lib/azure/containerRegistryService";
import * as resourceService from "../lib/azure/resourceService";
import { createTempDir } from "../lib/ioUtil";
import { RequestContext, WORKSPACE } from "../lib/setup/constants";
import * as fsUtil from "../lib/setup/fsUtil";
import * as gitService from "../lib/setup/gitService";
import * as pipelineService from "../lib/setup/pipelineService";
import * as projectService from "../lib/setup/projectService";
import * as promptInstance from "../lib/setup/prompt";
import * as scaffold from "../lib/setup/scaffold";
import * as setupLog from "../lib/setup/setupLog";
import { deepClone } from "../lib/util";
import { ConfigYaml } from "../types";
import { createSPKConfig, execute, getErrorMessage } from "./setup";
import * as setup from "./setup";

const mockRequestContext: RequestContext = {
  accessToken: "pat",
  orgName: "orgname",
  projectName: "project",
  servicePrincipalId: "1eba2d04-1506-4278-8f8c-b1eb2fc462a8",
  servicePrincipalPassword: "e4c19d72-96d6-4172-b195-66b3b1c36db1",
  servicePrincipalTenantId: "72f988bf-86f1-41af-91ab-2d7cd011db47",
  subscriptionId: "72f988bf-86f1-41af-91ab-2d7cd011db48",
  toCreateAppRepo: true,
  workspace: WORKSPACE
};

describe("test createSPKConfig function", () => {
  it("positive test", () => {
    const tmpFile = path.join(createTempDir(), "config.yaml");
    jest.spyOn(config, "defaultConfigFile").mockReturnValueOnce(tmpFile);
    createSPKConfig(mockRequestContext);
    const data = readYaml<ConfigYaml>(tmpFile);
    expect(data.azure_devops).toStrictEqual({
      access_token: "pat",
      org: "orgname",
      project: "project"
    });
  });
  it("positive test: with service principal", () => {
    const tmpFile = path.join(createTempDir(), "config.yaml");
    jest.spyOn(config, "defaultConfigFile").mockReturnValueOnce(tmpFile);
    const rc: RequestContext = deepClone(mockRequestContext);
    rc.toCreateAppRepo = true;
    rc.toCreateSP = true;
    rc.servicePrincipalId = "1eba2d04-1506-4278-8f8c-b1eb2fc462a8";
    rc.servicePrincipalPassword = "e4c19d72-96d6-4172-b195-66b3b1c36db1";
    rc.servicePrincipalTenantId = "72f988bf-86f1-41af-91ab-2d7cd011db47";
    rc.subscriptionId = "72f988bf-86f1-41af-91ab-2d7cd011db48";
    createSPKConfig(rc);

    const data = readYaml<ConfigYaml>(tmpFile);
    expect(data.azure_devops).toStrictEqual({
      access_token: "pat",
      org: "orgname",
      project: "project"
    });
    expect(data.introspection).toStrictEqual({
      azure: {
        service_principal_id: rc.servicePrincipalId,
        service_principal_secret: rc.servicePrincipalPassword,
        subscription_id: rc.subscriptionId,
        tenant_id: rc.servicePrincipalTenantId
      }
    });
  });
});

const testExecuteFunc = async (
  usePrompt = true,
  hasProject = true
): Promise<void> => {
  jest
    .spyOn(gitService, "getGitApi")
    .mockReturnValueOnce(Promise.resolve({} as any));
  jest.spyOn(fsUtil, "createDirectory").mockReturnValueOnce();
  jest.spyOn(scaffold, "hldRepo").mockReturnValueOnce(Promise.resolve());
  jest.spyOn(scaffold, "manifestRepo").mockReturnValueOnce(Promise.resolve());
  jest
    .spyOn(pipelineService, "createHLDtoManifestPipeline")
    .mockReturnValueOnce(Promise.resolve());
  jest.spyOn(resourceService, "create").mockResolvedValue(true);
  jest.spyOn(azureContainerRegistryService, "create").mockResolvedValue(true);
  jest.spyOn(setupLog, "create").mockReturnValueOnce();

  const exitFn = jest.fn();

  if (usePrompt) {
    jest
      .spyOn(promptInstance, "prompt")
      .mockReturnValueOnce(Promise.resolve(mockRequestContext));
  } else {
    jest
      .spyOn(promptInstance, "getAnswerFromFile")
      .mockReturnValueOnce(mockRequestContext);
  }
  jest.spyOn(setup, "createSPKConfig").mockReturnValueOnce();
  jest.spyOn(azdoClient, "getWebApi").mockReturnValueOnce(
    Promise.resolve({
      getCoreApi: async () => {
        return {};
      }
    } as any)
  );
  jest
    .spyOn(azdoClient, "getBuildApi")
    .mockReturnValueOnce(Promise.resolve({} as any));
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
    jest
      .spyOn(promptInstance, "prompt")
      .mockReturnValueOnce(Promise.resolve(mockRequestContext));
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
    jest.spyOn(setupLog, "create").mockReturnValueOnce();

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

    jest
      .spyOn(promptInstance, "prompt")
      .mockReturnValueOnce(Promise.resolve(mockRequestContext));
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
    jest.spyOn(setupLog, "create").mockReturnValueOnce();

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

    jest
      .spyOn(promptInstance, "prompt")
      .mockReturnValueOnce(Promise.resolve(mockRequestContext));
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
    jest.spyOn(setupLog, "create").mockReturnValueOnce();

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

    jest
      .spyOn(promptInstance, "prompt")
      .mockReturnValueOnce(Promise.resolve(mockRequestContext));
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

describe("test getErrorMessage function", () => {
  it("without request context", () => {
    const res = getErrorMessage(undefined, new Error("test"));
    expect(res).toBe("Error: test");
  });
  it("with VS402392 error", () => {
    const res = getErrorMessage(
      {
        accessToken: "pat",
        orgName: "orgName",
        projectName: "projectName",
        workspace: WORKSPACE
      },
      {
        message: "VS402392: ",
        statusCode: 400
      }
    );
    expect(res).toBe(
      "Project, projectName might have been deleted less than 28 days ago. Choose a different project name."
    );
  });
});
