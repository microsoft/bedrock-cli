import { create, createVariableData } from "./variableGroup";
import * as service from "../pipelines/variableGroup";
import { RequestContext } from "./constants";
import { deepClone } from "../util";

const mockRequestContext: RequestContext = {
  orgName: "dummy",
  projectName: "dummy",
  accessToken: "notused",
  workspace: "notused",
  acrName: "acrName",
  servicePrincipalId: "servicePrincipalId",
  servicePrincipalPassword: "servicePrincipalPassword",
  servicePrincipalTenantId: "servicePrincipalTenantId",
  storageAccountAccessKey: "storageAccountAccessKey",
  storageAccountName: "storageAccountName",
  storageTableName: "storageTableName",
};

describe("test create function", () => {
  it("sanity test", async () => {
    jest.spyOn(service, "addVariableGroup").mockResolvedValueOnce({});
    await create(mockRequestContext, "name");
  });
});

describe("test createVariableData function", () => {
  it("sanity test", () => {
    createVariableData(mockRequestContext);
  });
  it("negative test", () => {
    const properties = [
      "orgName",
      "projectName",
      "accessToken",
      "acrName",
      "servicePrincipalId",
      "servicePrincipalPassword",
      "servicePrincipalTenantId",
      "storageAccountAccessKey",
      "storageAccountName",
      "storageTableName",
    ];
    properties.forEach((prop) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clone = deepClone(mockRequestContext) as any;
      delete clone[prop];
      expect(() => {
        createVariableData(clone);
      }).toThrow();
    });
  });
});
