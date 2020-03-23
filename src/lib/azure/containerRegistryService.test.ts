import {
  RegistriesCreateResponse,
  RegistriesListResponse,
} from "@azure/arm-containerregistry/src/models";

import * as restAuth from "@azure/ms-rest-nodeauth";
import {
  create,
  getContainerRegistries,
  getContainerRegistry,
  isExist,
} from "./containerRegistryService";
import * as containerRegistryService from "./containerRegistryService";

jest.mock("@azure/arm-containerregistry", () => {
  class MockClient {
    constructor() {
      return {
        registries: {
          create: async (): Promise<RegistriesCreateResponse> => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return {} as any;
          },
          list: (): Promise<RegistriesListResponse> => {
            return [
              {
                id:
                  "/subscriptions/dd831253-787f-4dc8-8eb0-ac9d052177d9/resourceGroups/bedrockSPK/providers/Microsoft.ContainerRegistry/registries/acrWest",
                name: "acrWest",
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ] as any;
          },
        },
      };
    }
  }
  return {
    ContainerRegistryManagementClient: MockClient,
  };
});

const servicePrincipalId = "1eba2d04-1506-4278-8f8c-b1eb2fc462a8";
const servicePrincipalPassword = "e4c19d72-96d6-4172-b195-66b3b1c36db1";
const servicePrincipalTenantId = "72f988bf-86f1-41af-91ab-2d7cd011db47";
const subscriptionId = "test";
const RESOURCE_GROUP = "quick-start-rg";
const RESOURCE_GROUP_LOCATION = "westus2";

describe("test container registries function", () => {
  it("negative test", async () => {
    jest
      .spyOn(restAuth, "loginWithServicePrincipalSecret")
      .mockImplementationOnce(() => {
        throw Error("fake");
      });
    await expect(
      getContainerRegistries(
        servicePrincipalId,
        servicePrincipalPassword,
        servicePrincipalTenantId,
        subscriptionId
      )
    ).rejects.toThrow();
  });
  it("positive test: one value", async () => {
    jest
      .spyOn(restAuth, "loginWithServicePrincipalSecret")
      .mockImplementationOnce(async () => {
        return {};
      });
    const result = await getContainerRegistries(
      servicePrincipalId,
      servicePrincipalPassword,
      servicePrincipalTenantId,
      subscriptionId
    );
    expect(result).toStrictEqual([
      {
        id:
          "/subscriptions/dd831253-787f-4dc8-8eb0-ac9d052177d9/resourceGroups/bedrockSPK/providers/Microsoft.ContainerRegistry/registries/acrWest",
        name: "acrWest",
        resourceGroup: "bedrockSPK",
      },
    ]);
  });
  it("cache test", async () => {
    const fnAuth = jest.spyOn(restAuth, "loginWithServicePrincipalSecret");
    fnAuth.mockReset();
    await getContainerRegistries(
      servicePrincipalId,
      servicePrincipalPassword,
      servicePrincipalTenantId,
      subscriptionId
    );
    expect(fnAuth).toBeCalledTimes(0);
  });
  it("isExist: group already exist", async () => {
    jest
      .spyOn(containerRegistryService, "getContainerRegistries")
      .mockResolvedValueOnce([
        {
          id: "fakeId",
          name: "test",
          resourceGroup: RESOURCE_GROUP,
        },
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
    jest
      .spyOn(containerRegistryService, "getContainerRegistries")
      .mockResolvedValueOnce([]);
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
    jest
      .spyOn(containerRegistryService, "getContainerRegistries")
      .mockResolvedValueOnce([
        {
          id: "fakeId",
          name: "test1",
          resourceGroup: RESOURCE_GROUP,
        },
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
  it("create: positive test: acr already exist", async () => {
    jest.spyOn(containerRegistryService, "isExist").mockResolvedValueOnce(true);
    const created = await create(
      servicePrincipalId,
      servicePrincipalPassword,
      servicePrincipalTenantId,
      subscriptionId,
      RESOURCE_GROUP,
      "test",
      RESOURCE_GROUP_LOCATION
    );
    expect(created).toBeFalsy();
  });
  it("create: positive test: acr did not exist", async () => {
    jest
      .spyOn(containerRegistryService, "isExist")
      .mockResolvedValueOnce(false);
    const created = await create(
      servicePrincipalId,
      servicePrincipalPassword,
      servicePrincipalTenantId,
      subscriptionId,
      RESOURCE_GROUP,
      "test",
      RESOURCE_GROUP_LOCATION
    );
    expect(created).toBeTruthy();
  });
});

describe("test getContainerRegistry function", () => {
  it("match", async () => {
    const entry = {
      id:
        "/subscriptions/dd831253-787f-4dc8-8eb0-ac9d052177d9/resourceGroups/quick-start-rg/providers/Microsoft.ContainerRegistry/registries/quickStartACR",
      name: "quickStartACR",
      resourceGroup: "quick-start-rg",
    };
    jest
      .spyOn(containerRegistryService, "getContainerRegistries")
      .mockResolvedValueOnce([entry]);
    const reg = await getContainerRegistry(
      servicePrincipalId,
      servicePrincipalPassword,
      servicePrincipalTenantId,
      subscriptionId,
      RESOURCE_GROUP,
      "quickStartACR"
    );
    expect(reg).toStrictEqual(entry);
  });
  it("no matches", async () => {
    jest
      .spyOn(containerRegistryService, "getContainerRegistries")
      .mockResolvedValueOnce([]);
    const reg = await getContainerRegistry(
      servicePrincipalId,
      servicePrincipalPassword,
      servicePrincipalTenantId,
      subscriptionId,
      RESOURCE_GROUP,
      "quickStartACR"
    );
    expect(reg).toBeUndefined();
  });
});
