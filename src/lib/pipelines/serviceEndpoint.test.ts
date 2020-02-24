// Mocks
jest.mock("azure-devops-node-api");
jest.mock("../../config");
jest.mock("../azdoClient");

// Imports
import uuid from "uuid/v4";
import { Config, readYaml } from "../../config";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { IVariableGroupData } from "../../types";
import {
  addServiceEndpoint,
  createServiceEndPointParams
} from "./serviceEndpoint";

// Tests
const serviceEndpointName: string = uuid();
const subscriptionId: string = uuid();
const subscriptionName: string = uuid();
const servicePrincipalId: string = uuid();
const servicePrincipalSecret: string = uuid();
const tenantId: string = uuid();

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
    const input = readYaml<IVariableGroupData>("");

    const data = createServiceEndPointParams(
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
    const input = readYaml<IVariableGroupData>("");

    let invalidPatError: Error | undefined;
    try {
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
    const input = readYaml<IVariableGroupData>("");

    let invalidPatError: Error | undefined;
    try {
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
    const input = readYaml<IVariableGroupData>("");

    let invalidPatError: Error | undefined;
    try {
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
    const input = readYaml<IVariableGroupData>("");

    let invalidPatError: Error | undefined;
    try {
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
    const input = readYaml<IVariableGroupData>("");

    let invalidPatError: Error | undefined;
    try {
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
    const input = readYaml<IVariableGroupData>("");

    let invalidPatError: Error | undefined;
    try {
      createServiceEndPointParams(input.key_vault_provider!.service_endpoint);
    } catch (err) {
      invalidPatError = err;
    }
    expect(invalidPatError).toBeDefined();
  });
});

describe("addServiceEndpoint", () => {
  test("should pass when service endpoint config is set", async () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {
        orrg: uuid()
      }
    });

    (readYaml as jest.Mock).mockReturnValue({
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
    });
    const input = readYaml<IVariableGroupData>("");

    let invalidGroupError: Error | undefined;
    try {
      logger.info("calling add variable group");
      await addServiceEndpoint(input.key_vault_provider!.service_endpoint);
    } catch (err) {
      invalidGroupError = err;
    }
    expect(invalidGroupError).toBeDefined();
  });
});
