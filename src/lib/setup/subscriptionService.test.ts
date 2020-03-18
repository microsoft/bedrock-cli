import * as restAuth from "@azure/ms-rest-nodeauth";
import { RequestContext } from "./constants";
import { getSubscriptions } from "./subscriptionService";

jest.mock("@azure/arm-subscriptions", () => {
  class MockClient {
    constructor() {
      return {
        subscriptions: {
          // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
          list: () => {
            return [
              {
                displayName: "test",
                subscriptionId: "1234567890-abcdef"
              }
            ];
          }
        }
      };
    }
  }

  return {
    SubscriptionClient: MockClient
  };
});

describe("test getSubscriptions function", () => {
  it("positive test: one value", async () => {
    jest
      .spyOn(restAuth, "loginWithServicePrincipalSecret")
      .mockImplementationOnce(async () => {
        return {};
      });
    const rc: RequestContext = {
      accessToken: "pat",
      orgName: "org",
      projectName: "project",
      workspace: "test",
      servicePrincipalId: "fakeId",
      servicePrincipalPassword: "fakePassword",
      servicePrincipalTenantId: "fakeTenantId"
    };
    const result = await getSubscriptions(rc);
    expect(result).toStrictEqual([
      {
        id: "1234567890-abcdef",
        name: "test"
      }
    ]);
  });
  it("negative test", async () => {
    jest
      .spyOn(restAuth, "loginWithServicePrincipalSecret")
      .mockImplementationOnce(async () => {
        throw Error("fake");
      });
    await expect(
      getSubscriptions({
        accessToken: "pat",
        orgName: "org",
        projectName: "project",
        workspace: "test"
      })
    ).rejects.toThrow();
  });
});
