import * as variableGroup from "../../lib/pipelines/variableGroup";
import * as service from "../pipelines/variableGroup";
import * as sVariableGroup from "../setup/variableGroup";
import { RequestContext } from "./constants";
import {
  create,
  createVariableData,
  setupVariableGroup,
} from "./variableGroup";

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
  it("sanity test, only pat", () => {
    createVariableData({
      accessToken: "accessToken",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });
  it("negative test: with storageAccountAccessKey and missing sp", () => {
    expect(() => {
      createVariableData({
        accessToken: "accessToken",
        storageAccountAccessKey: "storageAccountAccessKey",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    }).toThrow();
  });
});

it("sanity test on setupVariableGroup", async () => {
  jest.spyOn(variableGroup, "deleteVariableGroup").mockResolvedValueOnce(true);
  jest.spyOn(sVariableGroup, "create").mockResolvedValueOnce();
  await setupVariableGroup(mockRequestContext);
});
