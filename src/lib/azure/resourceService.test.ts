import {
  ResourceGroup,
  ResourceGroupsCreateOrUpdateResponse,
  ResourceManagementClientOptions
} from "@azure/arm-resources/src/models";
import { RequestOptionsBase } from "@azure/ms-rest-js";
import { ApplicationTokenCredentials } from "@azure/ms-rest-nodeauth";
import * as restAuth from "@azure/ms-rest-nodeauth";
import { create, getResourceGroups, isExist } from "./resourceService";
import * as resourceService from "./resourceService";

const RESOURCE_GROUP_LOCATION = "westus2";

jest.mock("@azure/arm-resources", () => {
  class MockClient {
    constructor(
      cred: ApplicationTokenCredentials,
      subId: string,
      options?: ResourceManagementClientOptions
    ) {
      return {
        resourceGroups: {
          createOrUpdate: async (
            resourceGroupName: string,
            parameters: ResourceGroup,
            opts?: RequestOptionsBase
          ): Promise<ResourceGroupsCreateOrUpdateResponse> => {
            return {} as any;
          },
          list: () => {
            return [
              {
                id: "1234567890-abcdef",
                location: RESOURCE_GROUP_LOCATION,
                name: "test"
              }
            ];
          }
        }
      };
    }
  }
  return {
    ResourceManagementClient: MockClient
  };
});

const accessToken = "pat";
const orgName = "org";
const projectName = "project";
const servicePrincipalId = "1eba2d04-1506-4278-8f8c-b1eb2fc462a8";
const servicePrincipalPassword = "e4c19d72-96d6-4172-b195-66b3b1c36db1";
const servicePrincipalTenantId = "72f988bf-86f1-41af-91ab-2d7cd011db47";
const subscriptionId = "test";
const workspace = "test";
const RESOURCE_GROUP = "quick-start-rg";

describe("Resource Group tests", () => {
  it("getResourceGroups: negative test", async () => {
    jest
      .spyOn(restAuth, "loginWithServicePrincipalSecret")
      .mockImplementationOnce(() => {
        throw Error("fake");
      });
    await expect(
      getResourceGroups(
        servicePrincipalId,
        servicePrincipalPassword,
        servicePrincipalTenantId,
        subscriptionId
      )
    ).rejects.toThrow();
  });
  it("getResourceGroups: positive test: one value", async () => {
    jest
      .spyOn(restAuth, "loginWithServicePrincipalSecret")
      .mockImplementationOnce(async () => {
        return {};
      });
    const result = await getResourceGroups(
      servicePrincipalId,
      servicePrincipalPassword,
      servicePrincipalTenantId,
      subscriptionId
    );
    expect(result).toStrictEqual([
      {
        id: "1234567890-abcdef",
        location: RESOURCE_GROUP_LOCATION,
        name: "test"
      }
    ]);
  });
  it("getResourceGroups: cache test", async () => {
    const fnAuth = jest.spyOn(restAuth, "loginWithServicePrincipalSecret");
    fnAuth.mockReset();
    await getResourceGroups(
      servicePrincipalId,
      servicePrincipalPassword,
      servicePrincipalTenantId,
      subscriptionId
    );
    expect(fnAuth).toBeCalledTimes(0);
  });
  it("isExist: group already exist", async () => {
    jest.spyOn(resourceService, "getResourceGroups").mockResolvedValueOnce([
      {
        id: "fakeId",
        location: RESOURCE_GROUP_LOCATION,
        name: "test"
      }
    ]);
    const res = await isExist(
      servicePrincipalId,
      servicePrincipalPassword,
      servicePrincipalTenantId,
      subscriptionId,
      "test"
    );
    expect(res).toBeTruthy();
  });
  it("isExist: no groups", async () => {
    jest.spyOn(resourceService, "getResourceGroups").mockResolvedValueOnce([]);
    const res = await isExist(
      servicePrincipalId,
      servicePrincipalPassword,
      servicePrincipalTenantId,
      subscriptionId,
      "test"
    );
    expect(res).toBeFalsy();
  });
  it("isExist: group does not exist", async () => {
    jest.spyOn(resourceService, "getResourceGroups").mockResolvedValueOnce([
      {
        id: "fakeId",
        location: RESOURCE_GROUP_LOCATION,
        name: "test1"
      }
    ]);
    const res = await isExist(
      servicePrincipalId,
      servicePrincipalPassword,
      servicePrincipalTenantId,
      subscriptionId,
      "test"
    );
    expect(res).toBeFalsy();
  });
  it("create: positive test: group already exist", async () => {
    jest.spyOn(resourceService, "isExist").mockResolvedValueOnce(true);
    const created = await create(
      servicePrincipalId,
      servicePrincipalPassword,
      servicePrincipalTenantId,
      subscriptionId,
      RESOURCE_GROUP,
      RESOURCE_GROUP_LOCATION
    );
    expect(created).toBeFalsy();
  });
  it("create: positive test: group did not exist", async () => {
    jest.spyOn(resourceService, "isExist").mockResolvedValueOnce(false);
    const created = await create(
      servicePrincipalId,
      servicePrincipalPassword,
      servicePrincipalTenantId,
      subscriptionId,
      RESOURCE_GROUP,
      RESOURCE_GROUP_LOCATION
    );
    expect(created).toBeTruthy();
  });
});
