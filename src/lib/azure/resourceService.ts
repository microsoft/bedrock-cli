import { ResourceManagementClient } from "@azure/arm-resources";
import { loginWithServicePrincipalSecret } from "@azure/ms-rest-nodeauth";
import { logger } from "../../logger";

let client: ResourceManagementClient;

export interface ResourceGroupItem {
  id: string;
  name: string;
  location: string;
}

/**
 * Returns the resource management client. It is cached once it is created.
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
): Promise<ResourceManagementClient> => {
  if (client) {
    return client;
  }
  const creds = await loginWithServicePrincipalSecret(
    servicePrincipalId,
    servicePrincipalPassword,
    servicePrincipalTenantId
  );
  client = new ResourceManagementClient(creds, subscriptionId, {});
  return client;
};

/**
 * Returns a list of resource group for a subscription.
 *
 * @param servicePrincipalId Service Principal Id
 * @param servicePrincipalPassword Service Principal Password
 * @param servicePrincipalTenantId Service Principal Tenant Id
 * @param subscriptionId Subscription Id
 */
export const getResourceGroups = async (
  servicePrincipalId: string,
  servicePrincipalPassword: string,
  servicePrincipalTenantId: string,
  subscriptionId: string
): Promise<ResourceGroupItem[]> => {
  logger.info("attempting to get resource groups");
  await getClient(
    servicePrincipalId,
    servicePrincipalPassword,
    servicePrincipalTenantId,
    subscriptionId
  );
  const groups = await client.resourceGroups.list();
  logger.info("Successfully acquired resource groups");
  return groups.map((g) => {
    return {
      id: g.id as string,
      location: g.location as string,
      name: g.name as string,
    };
  });
};

/**
 * Returns true of resource group exists
 *
 * @param servicePrincipalId Service Principal Id
 * @param servicePrincipalPassword Service Principal Password
 * @param servicePrincipalTenantId Service Principal Tenant Id
 * @param subscriptionId Subscription Id
 * @param name Resource group name
 */
export const isExist = async (
  servicePrincipalId: string,
  servicePrincipalPassword: string,
  servicePrincipalTenantId: string,
  subscriptionId: string,
  name: string
): Promise<boolean> => {
  const groups = await getResourceGroups(
    servicePrincipalId,
    servicePrincipalPassword,
    servicePrincipalTenantId,
    subscriptionId
  );
  return (groups || []).some((g) => g.name === name);
};

/**
 * Creates resource group if it does not exists
 *
 * @param servicePrincipalId Service Principal Id
 * @param servicePrincipalPassword Service Principal Password
 * @param servicePrincipalTenantId Service Principal Tenant Id
 * @param subscriptionId Subscription Id
 * @param name Resource group name
 * @param location Location of tenant
 */
export const create = async (
  servicePrincipalId: string,
  servicePrincipalPassword: string,
  servicePrincipalTenantId: string,
  subscriptionId: string,
  name: string,
  location: string
): Promise<boolean> => {
  logger.info(`attempting to create resource group ${name}`);
  const exist = await isExist(
    servicePrincipalId,
    servicePrincipalPassword,
    servicePrincipalTenantId,
    subscriptionId,
    name
  );

  if (exist) {
    logger.info(`Resource group ${name} already existed`);
    return false;
  }
  await getClient(
    servicePrincipalId,
    servicePrincipalPassword,
    servicePrincipalTenantId,
    subscriptionId
  );
  await client.resourceGroups.createOrUpdate(name, {
    location,
  });
  logger.info(`Successfully create resource group ${name}.`);
  return true;
};
