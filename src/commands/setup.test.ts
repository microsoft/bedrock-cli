import path from "path";
import { readYaml } from "../config";
import * as config from "../config";
import * as azdoClient from "../lib/azdoClient";
import * as azureContainerRegistryService from "../lib/azure/containerRegistryService";
import * as resourceService from "../lib/azure/resourceService";
import { getErrorMessage as errorMessage } from "../lib/errorBuilder";
import { createTempDir } from "../lib/ioUtil";
import { RequestContext, WORKSPACE } from "../lib/setup/constants";
import * as fsUtil from "../lib/setup/fsUtil";
import * as gitService from "../lib/setup/gitService";
import * as pipelineService from "../lib/setup/pipelineService";
import * as projectService from "../lib/setup/projectService";
import * as promptInstance from "../lib/setup/prompt";
import * as scaffold from "../lib/setup/scaffold";
import * as setupLog from "../lib/setup/setupLog";
import * as azureStorage from "../lib/setup/azureStorage";
import { deepClone } from "../lib/util";
import { ConfigYaml } from "../types";
import {
  createAppRepoTasks,
  createSPKConfig,
  execute,
  getAPIClients,
  getErrorMessage,
} from "./setup";
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
  workspace: WORKSPACE,
};

describe("test createSPKConfig function", () => {
  it("positive test", () => {
    const tmpFile = path.join(createTempDir(), "config.yaml");
    jest.spyOn(config, "defaultConfigFile").mockReturnValueOnce(tmpFile);
    createSPKConfig(mockRequestContext);
    const data = readYaml<ConfigYaml>(tmpFile);
    expect(data.azure_devops).toStrictEqual({
      access_token: "pat",
      hld_repository:
        "https://dev.azure.com/orgname/project/_git/quick-start-hld",
      manifest_repository:
        "https://dev.azure.com/orgname/project/_git/quick-start-manifest",
      org: "orgname",
      project: "project",
    });
  });
  it("positive test with toCreateAppRepo = false", () => {
    const tmpFile = path.join(createTempDir(), "config.yaml");
    jest.spyOn(config, "defaultConfigFile").mockReturnValueOnce(tmpFile);
    const oData = deepClone(mockRequestContext);
    oData.toCreateAppRepo = false;
    createSPKConfig(oData);
    const data = readYaml<ConfigYaml>(tmpFile);
    expect(data.azure_devops).toStrictEqual({
      access_token: "pat",
      hld_repository:
        "https://dev.azure.com/orgname/project/_git/quick-start-hld",
      manifest_repository:
        "https://dev.azure.com/orgname/project/_git/quick-start-manifest",
      org: "orgname",
      project: "project",
    });
  });
  it("positive test: with service principal", () => {
    const tmpFile = path.join(createTempDir(), "config.yaml");
    jest.spyOn(config, "defaultConfigFile").mockReturnValueOnce(tmpFile);
    const rc: RequestContext = deepClone(mockRequestContext);
    rc.toCreateAppRepo = true;
    rc.toCreateSP = true;
    (rc.storageAccountName = "storageAccount"),
      (rc.storageTableName = "storageTable"),
      (rc.storageAccountAccessKey = "storageAccessKey"),
      (rc.servicePrincipalId = "1eba2d04-1506-4278-8f8c-b1eb2fc462a8");
    rc.servicePrincipalPassword = "e4c19d72-96d6-4172-b195-66b3b1c36db1";
    rc.servicePrincipalTenantId = "72f988bf-86f1-41af-91ab-2d7cd011db47";
    rc.subscriptionId = "72f988bf-86f1-41af-91ab-2d7cd011db48";
    createSPKConfig(rc);

    const data = readYaml<ConfigYaml>(tmpFile);
    expect(data.azure_devops).toStrictEqual({
      access_token: "pat",
      hld_repository:
        "https://dev.azure.com/orgname/project/_git/quick-start-hld",
      manifest_repository:
        "https://dev.azure.com/orgname/project/_git/quick-start-manifest",
      org: "orgname",
      project: "project",
    });
    expect(data.introspection).toStrictEqual({
      dashboard: {
        image: "mcr.microsoft.com/k8s/bedrock/spektate:latest",
        name: "spektate",
      },
      azure: {
        service_principal_id: rc.servicePrincipalId,
        service_principal_secret: rc.servicePrincipalPassword,
        subscription_id: rc.subscriptionId,
        tenant_id: rc.servicePrincipalTenantId,
        account_name: "storageAccount",
        table_name: "storageTable",
        key: "storageAccessKey",
        partition_key: "quick-start-part-key",
      },
    });
  });
});

const testExecuteFunc = async (
  usePrompt = true,
  hasProject = true
): Promise<void> => {
  jest
    .spyOn(gitService, "getGitApi")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockResolvedValueOnce({} as any);
  jest.spyOn(fsUtil, "createDirectory").mockReturnValueOnce();
  jest.spyOn(scaffold, "hldRepo").mockResolvedValueOnce();
  jest.spyOn(scaffold, "manifestRepo").mockResolvedValueOnce();
  jest
    .spyOn(pipelineService, "createHLDtoManifestPipeline")
    .mockResolvedValueOnce();
  jest.spyOn(resourceService, "create").mockResolvedValue(true);
  jest.spyOn(azureContainerRegistryService, "create").mockResolvedValue(true);
  jest.spyOn(setupLog, "create").mockReturnValueOnce();

  const exitFn = jest.fn();

  if (usePrompt) {
    jest
      .spyOn(promptInstance, "prompt")
      .mockResolvedValueOnce(mockRequestContext);
  } else {
    jest
      .spyOn(promptInstance, "getAnswerFromFile")
      .mockReturnValueOnce(mockRequestContext);
  }
  jest.spyOn(setup, "createSPKConfig").mockReturnValueOnce();
  jest.spyOn(azdoClient, "getWebApi").mockResolvedValueOnce({
    getCoreApi: async () => {
      return {};
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  jest
    .spyOn(azdoClient, "getBuildApi")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockResolvedValueOnce({} as any);
  if (hasProject) {
    jest
      .spyOn(projectService, "getProject")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({} as any);
  } else {
    jest
      .spyOn(projectService, "getProject")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(undefined as any);
  }
  const fncreateProject = jest
    .spyOn(projectService, "createProject")
    .mockResolvedValueOnce();

  if (usePrompt) {
    await execute(
      {
        file: undefined,
      },
      exitFn
    );
  } else {
    await execute(
      {
        file: "dummy",
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
      .mockResolvedValueOnce(mockRequestContext);
    jest.spyOn(setup, "createSPKConfig").mockReturnValueOnce();
    jest.spyOn(azdoClient, "getWebApi").mockResolvedValueOnce({
      getCoreApi: () => {
        throw {
          message: "Authentication failure",
          statusCode: 401,
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    jest.spyOn(setupLog, "create").mockReturnValueOnce();

    await execute(
      {
        file: undefined,
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
      .mockResolvedValueOnce(mockRequestContext);
    jest.spyOn(setup, "createSPKConfig").mockReturnValueOnce();
    jest.spyOn(azdoClient, "getWebApi").mockResolvedValueOnce({
      getCoreApi: () => {
        throw {
          message: "VS402392: ",
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    jest.spyOn(setupLog, "create").mockReturnValueOnce();

    await execute(
      {
        file: undefined,
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
      .mockResolvedValueOnce(mockRequestContext);
    jest.spyOn(setup, "createSPKConfig").mockReturnValueOnce();
    jest.spyOn(azdoClient, "getWebApi").mockResolvedValueOnce({
      getCoreApi: () => {
        throw {
          message: "other error",
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    jest.spyOn(setupLog, "create").mockReturnValueOnce();

    await execute(
      {
        file: undefined,
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
      .mockResolvedValueOnce(mockRequestContext);
    jest.spyOn(setup, "createSPKConfig").mockReturnValueOnce();
    jest.spyOn(azdoClient, "getWebApi").mockResolvedValueOnce({
      getCoreApi: () => {
        throw {
          message: "other error",
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await execute(
      {
        file: undefined,
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
        workspace: WORKSPACE,
      },
      {
        message: "VS402392: ",
        statusCode: 400,
      }
    );
    expect(res).toBe(
      "Project, projectName might have been deleted less than 28 days ago. Choose a different project name."
    );
  });
});

const testCreateAppRepoTasks = async (): Promise<void> => {
  const mockRc: RequestContext = {
    orgName: "org",
    projectName: "project",
    accessToken: "pat",
    toCreateAppRepo: true,
    servicePrincipalId: "fakeId",
    servicePrincipalPassword: "fakePassword",
    servicePrincipalTenantId: "tenant",
    subscriptionId: "12344",
    acrName: "acr",
    storageAccountName: "storage",
    workspace: "dummy",
  };

  jest.spyOn(resourceService, "create").mockResolvedValueOnce(true);
  jest.spyOn(azureStorage, "createStorage").mockResolvedValueOnce();
  jest
    .spyOn(azureContainerRegistryService, "create")
    .mockResolvedValueOnce(true);
  jest.spyOn(scaffold, "helmRepo").mockResolvedValueOnce();
  jest.spyOn(scaffold, "appRepo").mockResolvedValueOnce();
  jest
    .spyOn(pipelineService, "createLifecyclePipeline")
    .mockResolvedValueOnce();
  jest.spyOn(gitService, "completePullRequest").mockResolvedValueOnce();

  jest.spyOn(pipelineService, "createBuildPipeline").mockResolvedValueOnce();
  jest.spyOn(gitService, "completePullRequest").mockResolvedValueOnce();

  const res = await createAppRepoTasks(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {} as any, // gitAPI
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {} as any, // buildAPI
    mockRc
  );
  expect(res).toBe(true);
};

describe("test createAppRepoTasks function", () => {
  it("positive test", async () => {
    await testCreateAppRepoTasks();
  });
});

describe("test getAPIClients function", () => {
  it("negative test: getGitAPI failed", async () => {
    jest.spyOn(azdoClient, "getWebApi").mockResolvedValueOnce({
      getCoreApi: async () => {
        return {};
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    jest
      .spyOn(gitService, "getGitApi")
      .mockRejectedValueOnce(new Error("fake"));

    await expect(getAPIClients()).rejects.toThrow(
      errorMessage("setup-cmd-git-api-err")
    );
  });
  it("negative test: getGitAPI failed", async () => {
    jest.spyOn(azdoClient, "getWebApi").mockResolvedValueOnce({
      getCoreApi: async () => {
        return {};
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(gitService, "getGitApi").mockResolvedValueOnce({} as any);

    jest
      .spyOn(azdoClient, "getBuildApi")
      .mockRejectedValueOnce(new Error("fake"));

    await expect(getAPIClients()).rejects.toThrow(
      errorMessage("setup-cmd-build-api-err")
    );
  });
});
