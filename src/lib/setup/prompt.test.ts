import fs from "fs";
import inquirer from "inquirer";
import os from "os";
import path from "path";
import uuid from "uuid/v4";
import { createTempDir } from "../../lib/ioUtil";
import { DEFAULT_PROJECT_NAME, RequestContext, WORKSPACE } from "./constants";
import {
  getAnswerFromFile,
  getSubscriptionId,
  prompt,
  promptForACRName,
  promptForServicePrincipalCreation,
  validationServicePrincipalInfoFromFile,
} from "./prompt";
import * as promptInstance from "./prompt";
import * as gitService from "./gitService";
import * as servicePrincipalService from "../azure/servicePrincipalService";
import * as subscriptionService from "../azure/subscriptionService";

describe("test prompt function", () => {
  it("positive test: No App Creation", async () => {
    const answers = {
      azdo_org_name: "org",
      azdo_pat: "pat",
      azdo_project_name: "project",
      create_app_repo: false,
    };
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce(answers);
    const ans = await prompt();
    expect(ans).toStrictEqual({
      accessToken: "pat",
      orgName: "org",
      projectName: "project",
      toCreateAppRepo: false,
      workspace: WORKSPACE,
    });
  });
  it("positive test: create SP", async () => {
    const answers = {
      azdo_org_name: "org",
      azdo_pat: "pat",
      azdo_project_name: "project",
      create_app_repo: true,
    };
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce(answers);
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce({
      create_service_principal: true,
    });

    jest.spyOn(servicePrincipalService, "azCLILogin").mockResolvedValueOnce([
      {
        id: "72f988bf-86f1-41af-91ab-2d7cd011db48",
        name: "subname",
      },
    ]);
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce({
      az_subscription: "subname",
    });

    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce({
      acr_name: "testACR",
    });

    jest
      .spyOn(servicePrincipalService, "createWithAzCLI")
      .mockResolvedValueOnce({
        id: "b510c1ff-358c-4ed4-96c8-eb23f42bb65b",
        password: "a510c1ff-358c-4ed4-96c8-eb23f42bbc5b",
        tenantId: "72f988bf-86f1-41af-91ab-2d7cd011db47",
      });

    const ans = await prompt();
    expect(ans).toStrictEqual({
      accessToken: "pat",
      createServicePrincipal: true,
      acrName: "testACR",
      orgName: "org",
      projectName: "project",
      servicePrincipalId: "b510c1ff-358c-4ed4-96c8-eb23f42bb65b",
      servicePrincipalPassword: "a510c1ff-358c-4ed4-96c8-eb23f42bbc5b",
      servicePrincipalTenantId: "72f988bf-86f1-41af-91ab-2d7cd011db47",
      subscriptionId: "72f988bf-86f1-41af-91ab-2d7cd011db48",
      toCreateAppRepo: true,
      toCreateSP: true,
      workspace: WORKSPACE,
    });
  });
  it("positive test: no create SP", async () => {
    const answers = {
      azdo_org_name: "org",
      azdo_pat: "pat",
      azdo_project_name: "project",
      create_app_repo: true,
    };
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce(answers);
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce({
      create_service_principal: false,
    });
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce({
      az_sp_id: "b510c1ff-358c-4ed4-96c8-eb23f42bb65b",
      az_sp_password: "a510c1ff-358c-4ed4-96c8-eb23f42bbc5b",
      az_sp_tenant: "72f988bf-86f1-41af-91ab-2d7cd011db47",
    });
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce({
      acr_name: "testACR",
    });
    jest.spyOn(subscriptionService, "getSubscriptions").mockResolvedValueOnce([
      {
        id: "72f988bf-86f1-41af-91ab-2d7cd011db48",
        name: "test",
      },
    ]);
    const ans = await prompt();
    expect(ans).toStrictEqual({
      accessToken: "pat",
      acrName: "testACR",
      orgName: "org",
      projectName: "project",
      servicePrincipalId: "b510c1ff-358c-4ed4-96c8-eb23f42bb65b",
      servicePrincipalPassword: "a510c1ff-358c-4ed4-96c8-eb23f42bbc5b",
      servicePrincipalTenantId: "72f988bf-86f1-41af-91ab-2d7cd011db47",
      subscriptionId: "72f988bf-86f1-41af-91ab-2d7cd011db48",
      toCreateAppRepo: true,
      toCreateSP: false,
      workspace: WORKSPACE,
    });
  });
});

describe("test getAnswerFromFile function", () => {
  it("positive test", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = [
      "azdo_org_name=orgname",
      "azdo_pat=pat",
      "azdo_project_name=project",
      "az_storage_account_name=teststore",
      "az_storage_table=storagetable",
    ];
    fs.writeFileSync(file, data.join("\n"));
    const requestContext = getAnswerFromFile(file);
    expect(requestContext.orgName).toBe("orgname");
    expect(requestContext.accessToken).toBe("pat");
    expect(requestContext.projectName).toBe("project");
    expect(requestContext.storageAccountName).toBe("teststore");
  });
  it("positive test: without project name", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = [
      "azdo_org_name=orgname",
      "azdo_pat=pat",
      "az_storage_account_name=teststore",
      "az_storage_table=storagetable",
    ];
    fs.writeFileSync(file, data.join("\n"));
    const requestContext = getAnswerFromFile(file);
    expect(requestContext.orgName).toBe("orgname");
    expect(requestContext.accessToken).toBe("pat");
    expect(requestContext.projectName).toBe(DEFAULT_PROJECT_NAME);
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
      "azdo_pat=pat",
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
  it("positive test: with app creation, without SP creation", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = [
      "azdo_org_name=orgname",
      "azdo_pat=pat",
      "azdo_project_name=project",
      "az_create_app=true",
      "az_sp_id=b510c1ff-358c-4ed4-96c8-eb23f42bb65b",
      "az_sp_password=a510c1ff-358c-4ed4-96c8-eb23f42bbc5b",
      "az_sp_tenant=72f988bf-86f1-41af-91ab-2d7cd011db47",
      "az_subscription_id=72f988bf-86f1-41af-91ab-2d7cd011db48",
      "az_storage_account_name=teststore",
      "az_storage_table=storagetable",
    ];
    fs.writeFileSync(file, data.join("\n"));
    const requestContext = getAnswerFromFile(file);
    expect(requestContext.orgName).toBe("orgname");
    expect(requestContext.accessToken).toBe("pat");
    expect(requestContext.projectName).toBe("project");
    expect(requestContext.toCreateAppRepo).toBeTruthy();
    expect(requestContext.toCreateSP).toBeFalsy();
    expect(requestContext.servicePrincipalId).toBe(
      "b510c1ff-358c-4ed4-96c8-eb23f42bb65b"
    );
    expect(requestContext.servicePrincipalPassword).toBe(
      "a510c1ff-358c-4ed4-96c8-eb23f42bbc5b"
    );
    expect(requestContext.servicePrincipalTenantId).toBe(
      "72f988bf-86f1-41af-91ab-2d7cd011db47"
    );
    expect(requestContext.subscriptionId).toBe(
      "72f988bf-86f1-41af-91ab-2d7cd011db48"
    );
  });
  it("negative test: with app creation, incorrect SP values", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = [
      "azdo_org_name=orgname",
      "azdo_pat=pat",
      "azdo_project_name=project",
      "az_create_app=true",
      "az_storage_account_name=abc1234",
      "az_storage_table=abc1234",
      "az_subscription_id=72f988bf-86f1-41af-91ab-2d7cd011db48",
    ];
    [".", ".##", ".abc"].forEach((v, i) => {
      if (i === 0) {
        data.push(`az_sp_id=${v}`);
      } else if (i === 1) {
        data.pop();
        data.push("az_sp_id=b510c1ff-358c-4ed4-96c8-eb23f42bb65b");
        data.push(`az_sp_password=${v}`);
      } else {
        data.pop();
        data.push("az_sp_password=a510c1ff-358c-4ed4-96c8-eb23f42bbc5b");
        data.push(`az_sp_tenant=${v}`);
      }
      fs.writeFileSync(file, data.join("\n"));
      expect(() => {
        getAnswerFromFile(file);
      }).toThrow();
    });
  });
  it("negative test: with app creation, incorrect storage account name", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = [
      "azdo_org_name=orgname",
      "azdo_pat=pat",
      "azdo_project_name=project",
      "az_create_app=true",
      "az_storage_account_name=ab",
      "az_storage_table=abc1234",
      "az_subscription_id=72f988bf-86f1-41af-91ab-2d7cd011db48",
    ];
    fs.writeFileSync(file, data.join("\n"));
    expect(() => {
      getAnswerFromFile(file);
    }).toThrow();
  });
  it("negative test: with app creation, incorrect storage table name", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = [
      "azdo_org_name=orgname",
      "azdo_pat=pat",
      "azdo_project_name=project",
      "az_create_app=true",
      "az_storage_account_name=abx1234",
      "az_storage_table=*a",
      "az_subscription_id=72f988bf-86f1-41af-91ab-2d7cd011db48",
    ];
    fs.writeFileSync(file, data.join("\n"));
    expect(() => {
      getAnswerFromFile(file);
    }).toThrow();
  });
  it("negative test: with app creation, incorrect subscription id value", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = [
      "azdo_org_name=orgname",
      "azdo_pat=pat",
      "azdo_project_name=project",
      "az_create_app=true",
      "az_sp_id=b510c1ff-358c-4ed4-96c8-eb23f42bb65b",
      "az_sp_password=a510c1ff-358c-4ed4-96c8-eb23f42bbc5b",
      "az_sp_tenant=72f988bf-86f1-41af-91ab-2d7cd011db47",
      "az_subscription_id=xyz",
    ];
    fs.writeFileSync(file, data.join("\n"));
    expect(() => {
      getAnswerFromFile(file);
    }).toThrow();
  });
});

describe("test getSubscriptions function", () => {
  it("no subscriptions", async () => {
    jest
      .spyOn(subscriptionService, "getSubscriptions")
      .mockResolvedValueOnce([]);
    const mockRc: RequestContext = {
      accessToken: "pat",
      orgName: "org",
      projectName: "project",
      workspace: WORKSPACE,
    };
    await expect(getSubscriptionId(mockRc)).rejects.toThrow();
  });
  it("2 subscriptions", async () => {
    jest.spyOn(subscriptionService, "getSubscriptions").mockResolvedValueOnce([
      {
        id: "123345",
        name: "subscription1",
      },
      {
        id: "12334567890",
        name: "subscription2",
      },
    ]);
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce({
      az_subscription: "subscription2",
    });
    const mockRc: RequestContext = {
      accessToken: "pat",
      orgName: "org",
      projectName: "project",
      workspace: WORKSPACE,
    };
    await getSubscriptionId(mockRc);
    expect(mockRc.subscriptionId).toBe("12334567890");
  });
  it("no subscriptions selected", async () => {
    jest.spyOn(subscriptionService, "getSubscriptions").mockResolvedValueOnce([
      {
        id: "123345",
        name: "subscription1",
      },
      {
        id: "12334567890",
        name: "subscription2",
      },
    ]);
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce({
      az_subscription: "subscription3",
    });
    const mockRc: RequestContext = {
      accessToken: "pat",
      orgName: "org",
      projectName: "project",
      workspace: WORKSPACE,
    };
    await expect(getSubscriptionId(mockRc)).rejects.toThrow();
  });
});

describe("test promptForACRName function", () => {
  it("positive test", async () => {
    const mockRc: RequestContext = {
      accessToken: "pat",
      orgName: "org",
      projectName: "project",
      workspace: WORKSPACE,
    };
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce({
      acr_name: "testACR",
    });
    await promptForACRName(mockRc);
    expect(mockRc.acrName).toBe("testACR");
  });
});

describe("test promptForServicePrincipalCreation function", () => {
  it("covering the test gap: negative test", async () => {
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce({
      create_service_principal: true,
    });
    jest.spyOn(servicePrincipalService, "azCLILogin").mockResolvedValueOnce([
      {
        id: "72f988bf-86f1-41af-91ab-2d7cd011db48",
        name: "subname",
      },
    ]);
    jest
      .spyOn(promptInstance, "promptForSubscriptionId")
      .mockResolvedValueOnce(undefined);
    const mockRc: RequestContext = {
      accessToken: "pat",
      orgName: "org",
      projectName: "project",
      workspace: WORKSPACE,
    };
    await expect(promptForServicePrincipalCreation(mockRc)).rejects.toThrow();
  });
});

const testValidationServicePrincipalInfoFromFile = (vals: {
  [key: string]: string;
}): void => {
  validationServicePrincipalInfoFromFile(
    {
      orgName: "orgName",
      projectName: "project",
      accessToken: "notuse",
      workspace: "notused",
      toCreateAppRepo: true,
      toCreateSP: false,
    },
    vals
  );
};

describe("test validationServicePrincipalInfoFromFile function", () => {
  it("positive test", () => {
    testValidationServicePrincipalInfoFromFile({
      az_sp_id: "f2f988bf-86f1-41af-91ab-2d7cd011db48",
      az_sp_password: "d2f988bf-86f1-41af-91ab-2d7cd011db48",
      az_sp_tenant: "b2f988bf-86f1-41af-91ab-2d7cd011db48",
      az_subscription_id: "a2f988bf-86f1-41af-91ab-2d7cd011db45",
    });
  });
  it("negative test: sp id is invalid", () => {
    expect(() => {
      testValidationServicePrincipalInfoFromFile({
        az_sp_id: "id",
        az_sp_password: "d2f988bf-86f1-41af-91ab-2d7cd011db48",
        az_sp_tenant: "b2f988bf-86f1-41af-91ab-2d7cd011db48",
        az_subscription_id: "a2f988bf-86f1-41af-91ab-2d7cd011db45",
      });
    }).toThrow();
  });
  it("negative test: sp password is invalid", () => {
    expect(() => {
      testValidationServicePrincipalInfoFromFile({
        az_sp_id: "f2f988bf-86f1-41af-91ab-2d7cd011db48",
        az_sp_password: "pwd",
        az_sp_tenant: "b2f988bf-86f1-41af-91ab-2d7cd011db48",
        az_subscription_id: "a2f988bf-86f1-41af-91ab-2d7cd011db45",
      });
    }).toThrow();
  });
  it("negative test: sp id is invalid", () => {
    expect(() => {
      testValidationServicePrincipalInfoFromFile({
        az_sp_id: "f2f988bf-86f1-41af-91ab-2d7cd011db48",
        az_sp_password: "d2f988bf-86f1-41af-91ab-2d7cd011db48",
        az_sp_tenant: "tenant",
        az_subscription_id: "a2f988bf-86f1-41af-91ab-2d7cd011db45",
      });
    }).toThrow();
  });
  it("negative test: sp id is invalid", () => {
    expect(() => {
      testValidationServicePrincipalInfoFromFile({
        az_sp_id: "f2f988bf-86f1-41af-91ab-2d7cd011db48",
        az_sp_password: "d2f988bf-86f1-41af-91ab-2d7cd011db48",
        az_sp_tenant: "b2f988bf-86f1-41af-91ab-2d7cd011db48",
        az_subscription_id: "subid",
      });
    }).toThrow();
  });
});
