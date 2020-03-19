/* eslint-disable @typescript-eslint/camelcase */
import { IRestResponse } from "typed-rest-client";
import uuid from "uuid/v4";
import { Config, readYaml } from "../../config";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { ServiceEndpointData, VariableGroupData } from "../../types";
import * as azdoClient from "../azdoClient";
import { ServiceEndpoint } from "./azdoInterfaces";
import {
  addServiceEndpoint,
  createServiceEndpointIfNotExists,
  createServiceEndPointParams,
  getServiceEndpointByName
} from "./serviceEndpoint";
import * as serviceEndpoint from "./serviceEndpoint";

// Mocks
jest.mock("azure-devops-node-api");
jest.mock("../../config");
jest.mock("../azdoClient");

const serviceEndpointName: string = uuid();
const subscriptionId: string = uuid();
const subscriptionName: string = uuid();
const servicePrincipalId: string = uuid();
const servicePrincipalSecret: string = uuid();
const tenantId: string = uuid();

const mockedConfig = {
  azure_devops: {
    orrg: uuid()
  }
};

const mockedYaml = {
  description: "mydesc",
  key_vault_provider: {
    name: "vault",
    service_endpoint: {
      name: serviceEndpointName,
      service_principal_id: servicePrincipalId,
      service_principal_secret: servicePrincipalSecret,
      subscription_id: subscriptionId,
      subscription_name: subscriptionName,
      tenant_id: tenantId
    }
  },
  name: "myvg"
};

const mockedMatchServiceEndpointResponse = {
  result: {
    count: 1,
    value: [
      {
        authorization: {
          parameters: {
            authenticationType: "authenticationType",
            serviceprincipalid: "serviceprincipalid",
            serviceprincipalkey: "serviceprincipalkey",
            tenantid: "tenantid"
          },
          scheme: "ssh"
        },
        createdBy: {
          _links: {
            avatar: {
              href: "https://person.com"
            }
          },
          descriptor: "test",
          displayName: "tester",
          id: "test",
          imageUrl: "https://www.test.com",
          uniqueName: "test",
          url: "https://www.tester.com"
        },
        data: {
          creationMode: "creationMode",
          environment: "environment",
          scopeLevel: "scopeLevel",
          subscriptionId: "subscriptionId",
          subscriptionName: "subscriptionName"
        },
        id: "test",
        isReady: true,
        isShared: false,
        name: "test",
        owner: "tester",
        type: "test",
        url: "https://www.test.com"
      }
    ]
  },
  statusCode: 200
};

const mockedNonMatchServiceEndpointResponse = {
  result: {
    count: 0,
    value: []
  },
  statusCode: 200
};

const mockedInvalidServiceEndpointResponse = {
  result: {
    count: 2,
    value: []
  },
  statusCode: 200
};

const createServiceEndpointInput: ServiceEndpointData = {
  name: serviceEndpointName,
  service_principal_id: servicePrincipalId,
  service_principal_secret: servicePrincipalSecret,
  subscription_id: subscriptionId,
  subscription_name: subscriptionName,
  tenant_id: tenantId
};

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("Validate service endpoint parameters creation", () => {
  test("valid service endpoint params", () => {
    (readYaml as jest.Mock).mockReturnValue({
      description: "mydesc",
      key_vault_provider: {
        service_endpoint: {
          name: serviceEndpointName,
          service_principal_id: servicePrincipalId,
          service_principal_secret: servicePrincipalSecret,
          subscription_id: subscriptionId,
          subscription_name: subscriptionName,
          tenant_id: tenantId
        }
      }
    });
    const input = readYaml<VariableGroupData>("");

    const data = createServiceEndPointParams(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      input.key_vault_provider!.service_endpoint
    );

    expect(data.name).toBe(serviceEndpointName);
    expect(data.type).toBe("azurerm");
    expect(data.data.subscriptionId).toBe(subscriptionId);
    expect(data.data.subscriptionName).toBe(subscriptionName);
    expect(data.authorization.parameters.serviceprincipalid).toBe(
      servicePrincipalId
    );
    expect(data.authorization.parameters.serviceprincipalkey).toBe(
      servicePrincipalSecret
    );
    expect(data.authorization.parameters.tenantid).toBe(tenantId);
    expect(data.authorization.parameters.authenticationType).toBe("spnKey");
    expect(data.authorization.scheme).toBe("ServicePrincipal");
  });

  test("should fail creating service endpoint params without the name", () => {
    (readYaml as jest.Mock).mockReturnValue({
      description: "mydesc",
      key_vault_provider: {
        service_endpoint: {
          service_principal_id: servicePrincipalId,
          service_principal_secret: servicePrincipalSecret,
          subscription_id: subscriptionId,
          subscription_name: subscriptionName,
          tenant_id: tenantId
        }
      }
    });
    const input = readYaml<VariableGroupData>("");

    let invalidPatError: Error | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      createServiceEndPointParams(input.key_vault_provider!.service_endpoint);
    } catch (err) {
      invalidPatError = err;
    }
    expect(invalidPatError).toBeDefined();
  });

  test("should fail creating service endpoint params without service principal id", () => {
    (readYaml as jest.Mock).mockReturnValue({
      description: "mydesc",
      key_vault_provider: {
        service_endpoint: {
          name: serviceEndpointName,
          service_principal_secret: servicePrincipalSecret,
          subscription_id: subscriptionId,
          subscription_name: subscriptionName,
          tenant_id: tenantId
        }
      }
    });
    const input = readYaml<VariableGroupData>("");

    let invalidPatError: Error | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      createServiceEndPointParams(input.key_vault_provider!.service_endpoint);
    } catch (err) {
      invalidPatError = err;
    }
    expect(invalidPatError).toBeDefined();
  });

  test("should fail creating service endpoint params without service principal secret", () => {
    (readYaml as jest.Mock).mockReturnValue({
      description: "mydesc",
      key_vault_provider: {
        service_endpoint: {
          name: serviceEndpointName,
          service_principal_id: servicePrincipalId,
          subscription_id: subscriptionId,
          subscription_name: subscriptionName,
          tenant_id: tenantId
        }
      }
    });
    const input = readYaml<VariableGroupData>("");

    let invalidPatError: Error | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      createServiceEndPointParams(input.key_vault_provider!.service_endpoint);
    } catch (err) {
      invalidPatError = err;
    }
    expect(invalidPatError).toBeDefined();
  });

  test("should fail creating service endpoint params without subscription id", () => {
    (readYaml as jest.Mock).mockReturnValue({
      description: "mydesc",
      key_vault_provider: {
        service_endpoint: {
          name: serviceEndpointName,
          service_principal_id: servicePrincipalId,
          service_principal_secret: servicePrincipalSecret,
          subscription_name: subscriptionName,
          tenant_id: tenantId
        }
      }
    });
    const input = readYaml<VariableGroupData>("");

    let invalidPatError: Error | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      createServiceEndPointParams(input.key_vault_provider!.service_endpoint);
    } catch (err) {
      invalidPatError = err;
    }
    expect(invalidPatError).toBeDefined();
  });

  test("should fail creating service endpoint params without subscription name", () => {
    (readYaml as jest.Mock).mockReturnValue({
      description: "mydesc",
      key_vault_provider: {
        service_endpoint: {
          name: serviceEndpointName,
          service_principal_id: servicePrincipalId,
          service_principal_secret: servicePrincipalSecret,
          subscription_id: subscriptionId,
          tenant_id: tenantId
        }
      }
    });
    const input = readYaml<VariableGroupData>("");

    let invalidPatError: Error | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      createServiceEndPointParams(input.key_vault_provider!.service_endpoint);
    } catch (err) {
      invalidPatError = err;
    }
    expect(invalidPatError).toBeDefined();
  });

  test("should fail creating service endpoint params without entire section", () => {
    (readYaml as jest.Mock).mockReturnValue({
      description: "mydesc",
      key_vault_provider: {
        service_endpoint: {}
      }
    });
    const input = readYaml<VariableGroupData>("");

    let invalidPatError: Error | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      createServiceEndPointParams(input.key_vault_provider!.service_endpoint);
    } catch (err) {
      invalidPatError = err;
    }
    expect(invalidPatError).toBeDefined();
  });
});

const testAddServiceEndpoint = async (
  positive = true,
  getRestClientThrowException = false
): Promise<ServiceEndpoint> => {
  (Config as jest.Mock).mockReturnValueOnce(mockedConfig);
  (readYaml as jest.Mock).mockReturnValueOnce(mockedYaml);

  jest.spyOn(azdoClient, "getRestClient").mockReturnValueOnce(
    Promise.resolve({
      create: async (): Promise<IRestResponse<{ [key: string]: string }>> => {
        if (getRestClientThrowException) {
          return new Promise((_, reject) => {
            reject(new Error("fake"));
          });
        }
        return new Promise(resolve => {
          resolve({
            result: {
              status: "OK"
            },
            statusCode: positive ? 200 : 400
          });
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  );

  const input = readYaml<VariableGroupData>("");
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return await addServiceEndpoint(input.key_vault_provider!.service_endpoint);
};

describe("test addServiceEndpoint function", () => {
  it("+ve: should pass when service endpoint config is set", async () => {
    const result = await testAddServiceEndpoint();
    expect(result).toStrictEqual({
      status: "OK"
    });
  });
  it("-ve: create API returns non 200 status code", async () => {
    await expect(testAddServiceEndpoint(false)).rejects.toThrow();
  });
  it("-ve: create API throw exection", async () => {
    await expect(testAddServiceEndpoint(true, true)).rejects.toThrow();
  });
});

const testGetServiceEndpointByName = async (
  positive = true,
  more = false
): Promise<ServiceEndpoint | null> => {
  (Config as jest.Mock).mockReturnValueOnce(mockedConfig);
  (readYaml as jest.Mock).mockReturnValueOnce(mockedYaml);

  jest.spyOn(azdoClient, "getRestClient").mockReturnValueOnce(
    Promise.resolve({
      get: async (): Promise<
        IRestResponse<{
          count: number;
          value: ServiceEndpoint[];
        }>
      > => {
        return new Promise(resolve => {
          if (more) {
            resolve(mockedInvalidServiceEndpointResponse);
          } else if (positive) {
            resolve(mockedMatchServiceEndpointResponse);
          } else {
            resolve(mockedNonMatchServiceEndpointResponse);
          }
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  );

  readYaml<VariableGroupData>("");
  return await getServiceEndpointByName("dummy");
};

describe("test getServiceEndpointByName function", () => {
  it("positive test", async () => {
    const result = await testGetServiceEndpointByName();
    expect(result?.id).toBe("test");
  });
  it("negative test: no match", async () => {
    const result = await testGetServiceEndpointByName(false);
    expect(result).toBeNull();
  });
  it("negative test: too many matches", async () => {
    await expect(testGetServiceEndpointByName(true, true)).rejects.toThrow();
  });
});

describe("test createServiceEndpointIfNotExists function", () => {
  it("+ve", async () => {
    jest
      .spyOn(serviceEndpoint, "getServiceEndpointByName")
      .mockReturnValueOnce(Promise.resolve(null));
    jest
      .spyOn(serviceEndpoint, "addServiceEndpoint")
      .mockReturnValueOnce(
        Promise.resolve(mockedMatchServiceEndpointResponse.result.value[0])
      );
    const endpoint = await createServiceEndpointIfNotExists(
      createServiceEndpointInput
    );
    expect(endpoint).toStrictEqual(
      mockedMatchServiceEndpointResponse.result.value[0]
    );
  });
  it("-ve: missing endpoint", async () => {
    jest
      .spyOn(serviceEndpoint, "getServiceEndpointByName")
      .mockReturnValueOnce(Promise.resolve(null));
    jest
      .spyOn(serviceEndpoint, "addServiceEndpoint")
      .mockReturnValueOnce(Promise.reject(new Error("fake")));
    await expect(
      createServiceEndpointIfNotExists(createServiceEndpointInput)
    ).rejects.toThrow();
  });
});
