import { SubscriptionClient } from "@azure/arm-subscriptions";
import { loginWithServicePrincipalSecret } from "@azure/ms-rest-nodeauth";
import { logger } from "../../logger";

export interface SubscriptionItem {
  id: string;
  name: string;
}

/**
 * Returns a list of subscriptions based on the service principal credentials.
 *
 * @param servicePrincipalId Service Principal Id
 * @param servicePrincipalPassword Service Principal Password
 * @param servicePrincipalTenantId  Service Principal TenantId
 */
export const getSubscriptions = async (
  servicePrincipalId: string,
  servicePrincipalPassword: string,
  servicePrincipalTenantId: string
): Promise<SubscriptionItem[]> => {
  logger.info("attempting to get subscription list");
  if (
    !servicePrincipalId ||
    !servicePrincipalPassword ||
    !servicePrincipalTenantId
  ) {
    throw Error("Service Principal information was missing.");
  }
  const creds = await loginWithServicePrincipalSecret(
    servicePrincipalId,
    servicePrincipalPassword,
    servicePrincipalTenantId
  );
  const client = new SubscriptionClient(creds);
  const subsciptions = await client.subscriptions.list();
  const result: SubscriptionItem[] = [];

  (subsciptions || []).forEach((s) => {
    if (s.subscriptionId && s.displayName) {
      result.push({
        id: s.subscriptionId,
        name: s.displayName,
      });
    }
  });
  logger.info("Successfully acquired subscription list");
  return result;
};
