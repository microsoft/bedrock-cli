import * as msRestNodeAuth from "@azure/ms-rest-nodeauth";
import * as config from "../../config";
import { IConfigYaml } from "../../types";
import { getCredentials, getManagementCredentials } from "./azurecredentials";

describe("test getCredentials function", () => {
  it("missing values", async done => {
    jest.spyOn(config, "Config").mockReturnValueOnce({
      introspection: {}
    });
    const cred = await getCredentials({});
    expect(cred).toBe(undefined);
    done();
  });
  it("positive tests: taking values from config", async done => {
    jest.spyOn(config, "Config").mockReturnValueOnce({
      introspection: {
        azure: {
          service_principal_id: "servicePrincipalId",
          service_principal_secret: "servicePrincipalPassword",
          tenant_id: "tenantId"
        }
      }
    } as IConfigYaml);
    const cred = await getCredentials({});
    expect(cred).toBeDefined();
    done();
  });
  it("positive tests", async done => {
    jest.spyOn(config, "Config").mockReturnValueOnce({
      introspection: {}
    });
    const cred = await getCredentials({
      servicePrincipalId: "servicePrincipalId",
      servicePrincipalPassword: "servicePrincipalPassword",
      tenantId: "tenantId"
    });
    expect(cred).toBeDefined();
    done();
  });
});

describe("test getManagementCredentials function", () => {
  it("missing values", async done => {
    jest.spyOn(config, "Config").mockReturnValueOnce({
      introspection: {}
    });
    const cred = await getManagementCredentials({});
    expect(cred).toBe(undefined);
    done();
  });
  it("positive tests: taking values from config", async done => {
    jest.spyOn(config, "Config").mockReturnValueOnce({
      introspection: {
        azure: {
          service_principal_id: "servicePrincipalId",
          service_principal_secret: "servicePrincipalPassword",
          tenant_id: "tenantId"
        }
      }
    } as IConfigYaml);
    jest
      .spyOn(msRestNodeAuth, "loginWithServicePrincipalSecret")
      .mockReturnValueOnce();
    const cred = await getManagementCredentials({});
    expect(cred).toBeUndefined(); // not defined because loginWithServicePrincipalSecret mock is returing undefined
    done();
  });
  it("positive tests", async done => {
    jest.spyOn(config, "Config").mockReturnValueOnce({
      introspection: {}
    });
    jest
      .spyOn(msRestNodeAuth, "loginWithServicePrincipalSecret")
      .mockReturnValueOnce();
    const cred = await getManagementCredentials({
      servicePrincipalId: "servicePrincipalId",
      servicePrincipalPassword: "servicePrincipalPassword",
      tenantId: "tenantId"
    });
    expect(cred).toBeUndefined(); // not defined because loginWithServicePrincipalSecret mock is returing undefined
    done();
  });
});
