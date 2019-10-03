import { logger } from "../../../logger";

const storageAccounts: string[] = [];

export const setStorageAccounts = async (accounts: string[]) => {
  for (const account of accounts) {
    storageAccounts.push(account);
  }
};

export const createStorageAccountIfNotExists = async (
  resourceGroup: string,
  accountName: string,
  location: string
) => {
  logger.info(
    `called mock with resource group ${resourceGroup}, account name ${accountName}, and location ${location}"`
  );
  if (storageAccounts.includes(accountName)) {
    logger.info(`Storage account${accountName} already exists`);
  }
};

export const getStorageAccountKey = async (
  resourceGroup: string,
  accountName: string
): Promise<string | undefined> => {
  logger.info(
    `called mock with resource group ${resourceGroup} and account name ${accountName}"`
  );
  return "mock access key";
};
