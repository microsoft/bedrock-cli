import { ContainerRegistryManagementClient } from "@azure/arm-containerregistry";
import { loginWithServicePrincipalSecret } from "@azure/ms-rest-nodeauth";
import { logger } from "../../logger";

let client: ContainerRegistryManagementClient;

export interface RegistryItem {
  id: string;
  name: string;
  resourceGroup: string;
}

/**
 * Returns the container registry management client. It is cached once it is created.
 *
 * @param servicePrincipalId Service Principal Id
 * @param servicePrincipalPassword Service Principal Password
 * @param servicePrincipalTenantId Service Principal Tenant Id
 * @param subscriptionId Subscription Id
 */
const getClient = async (
  servicePrincipalId: string,
  servicePrincipalPassword: string,
  servicePrincipalTenantId: string,
  subscriptionId: string
): Promise<ContainerRegistryManagementClient> => {
  if (client) {
    return client;
  }
  // any is used because of a bug.
  // https://github.com/Azure/azure-sdk-for-js/issues/7763
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creds: any = await loginWithServicePrincipalSecret(
    servicePrincipalId,
    servicePrincipalPassword,
    servicePrincipalTenantId
  );
  client = new ContainerRegistryManagementClient(creds, subscriptionId, {});
  return client;
};

/**
 * Returns a list of container registries based on the service principal credentials.
 *
 * @param servicePrincipalId Service Principal Id
 * @param servicePrincipalPassword Service Principal Password
 * @param servicePrincipalTenantId Service Principal Tenant Id
 * @param subscriptionId Subscription Id
 */
export const getContainerRegistries = async (
  servicePrincipalId: string,
  servicePrincipalPassword: string,
  servicePrincipalTenantId: string,
  subscriptionId: string
): Promise<RegistryItem[]> => {
  logger.info("attempting to get Azure container registries");
  await getClient(
    servicePrincipalId,
    servicePrincipalPassword,
    servicePrincipalTenantId,
    subscriptionId
  );
  const registries = await client.registries.list();
  logger.info("Successfully acquired Azure container registries");
  return registries.map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const id = r.id! as string;
    const match = id.match(/\/resourceGroups\/(.+?)\//);
    return {
      id,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      name: r.name!,
      resourceGroup: match ? match[1] : "",
    };
  });
};

/**
 * Returns container registry with matching name
 *
 * @param servicePrincipalId Service Principal Id
 * @param servicePrincipalPassword Service Principal Password
 * @param servicePrincipalTenantId Service Principal Tenant Id
 * @param subscriptionId Subscription Id
 */
export const getContainerRegistry = async (
  servicePrincipalId: string,
  servicePrincipalPassword: string,
  servicePrincipalTenantId: string,
  subscriptionId: string,
  resourceGroup: string,
  name: string
): Promise<RegistryItem | undefined> => {
  const registries = await getContainerRegistries(
    servicePrincipalId,
    servicePrincipalPassword,
    servicePrincipalTenantId,
    subscriptionId
  );
  return registries.find(
    (r) => r.resourceGroup === resourceGroup && r.name === name
  );
};

/**
 * Returns true of container register exists
 *
 * @param servicePrincipalId Service Principal Id
 * @param servicePrincipalPassword Service Principal Password
 * @param servicePrincipalTenantId Service Principal Tenant Id
 * @param subscriptionId Subscription Id
 * @param resourceGroup Resource group name
 * @param name Container registry name
 */
export const isExist = async (
  servicePrincipalId: string,
  servicePrincipalPassword: string,
  servicePrincipalTenantId: string,
  subscriptionId: string,
  name: string
): Promise<boolean> => {
  const registries = await getContainerRegistries(
    servicePrincipalId,
    servicePrincipalPassword,
    servicePrincipalTenantId,
    subscriptionId
  );

  return (registries || []).some(
    (r) => r.name === name // ACR name will be unique across Azure so only check the name.
  );
};

/**
 * Creates a container registry
 *
 * @param servicePrincipalId Service Principal Id
 * @param servicePrincipalPassword Service Principal Password
 * @param servicePrincipalTenantId Service Principal Tenant Id
 * @param subscriptionId Subscription Id
 * @param resourceGroup Resource group name
 * @param name Container registry name
 */
export const create = async (
  servicePrincipalId: string,
  servicePrincipalPassword: string,
  servicePrincipalTenantId: string,
  subscriptionId: string,
  resourceGroup: string,
  name: string,
  location: string
): Promise<boolean> => {
  logger.info(
    `attempting to create Azure container registry, ${name} in ${resourceGroup}`
  );
  const exist = await isExist(
    servicePrincipalId,
    servicePrincipalPassword,
    servicePrincipalTenantId,
    subscriptionId,
    name
  );

  if (exist) {
    logger.info(
      `Azure container registry, ${name} already exists in subscription`
    );
    return false;
  }
  await getClient(
    servicePrincipalId,
    servicePrincipalPassword,
    servicePrincipalTenantId,
    subscriptionId
  );
  await client.registries.create(resourceGroup, name, {
    location,
    sku: { name: "Standard", tier: "Standard" },
  });
  logger.info(
    `Successfully create Azure container registry, ${name} in ${resourceGroup}.`
  );
  return true;
};
