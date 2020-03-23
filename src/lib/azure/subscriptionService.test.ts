import uuid = require("uuid");
import * as restAuth from "@azure/ms-rest-nodeauth";
import { getSubscriptions } from "./subscriptionService";

const principalId = uuid();
const principalPassword = uuid();
const principalTenantId = uuid();

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
                subscriptionId: "1234567890-abcdef",
              },
            ];
          },
        },
      };
    }
  }

  return {
    SubscriptionClient: MockClient,
  };
});

describe("test getSubscriptions function", () => {
  it("positive test: one value", async () => {
    jest
      .spyOn(restAuth, "loginWithServicePrincipalSecret")
      .mockImplementationOnce(async () => {
        return {};
      });

    const result = await getSubscriptions(
      principalId,
      principalPassword,
      principalTenantId
    );

    expect(result).toStrictEqual([
      {
        id: "1234567890-abcdef",
        name: "test",
      },
    ]);
  });
  it("negative test: missing values", async () => {
    await expect(getSubscriptions("", "", "")).rejects.toThrow();
  });
  it("negative test", async () => {
    jest
      .spyOn(restAuth, "loginWithServicePrincipalSecret")
      .mockImplementationOnce(async () => {
        throw Error("fake");
      });
    await expect(
      getSubscriptions(principalId, principalPassword, principalTenantId)
    ).rejects.toThrow();
  });
});
