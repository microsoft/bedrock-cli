import {
  RequestContext,
  RESOURCE_GROUP,
  STORAGE_ACCOUNT_NAME,
  STORAGE_TABLE_NAME,
  RESOURCE_GROUP_LOCATION
} from "./constants";
import {
  createStorageAccount as createAccount,
  createTableIfNotExists,
  getStorageAccount,
  getStorageAccountKey
} from "../azure/storage";
import * as promptBuilder from "../promptBuilder";
import inquirer from "inquirer";

export const createStorageAccount = async (
  name: string
): Promise<boolean | undefined> => {
  const oStorage = await getStorageAccount(RESOURCE_GROUP, name);
  if (!oStorage) {
    try {
      await createAccount(RESOURCE_GROUP, name, RESOURCE_GROUP_LOCATION);
      return true;
    } catch (e) {
      return undefined;
    }
  } else {
    return false;
  }
};

export const waitForStorageAccountToBeProvisioned = async (
  name: string
): Promise<void> => {
  let oStorage = await getStorageAccount(RESOURCE_GROUP, name);
  while (oStorage && oStorage.provisioningState !== "Succeeded") {
    oStorage = await getStorageAccount(RESOURCE_GROUP, name);
  }
};

export const tryToCreateStorageAccount = async (
  rc: RequestContext
): Promise<void> => {
  rc.storageAccountName = rc.storageAccountName || STORAGE_ACCOUNT_NAME;
  let res = await createStorageAccount(rc.storageAccountName);
  while (res === undefined) {
    const ans = await inquirer.prompt([
      promptBuilder.azureStorageAccountName()
    ]);
    rc.storageAccountName = ans.azdo_storage_account_name as string;
    res = await createStorageAccount(rc.storageAccountName);
  }
  await waitForStorageAccountToBeProvisioned(rc.storageAccountName);
  rc.createdStorageAccount = !!res;
};

export const createStorage = async (rc: RequestContext): Promise<void> => {
  await tryToCreateStorageAccount(rc);

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const accountName = rc.storageAccountName!;
  const key = await getStorageAccountKey(RESOURCE_GROUP, accountName);
  if (!key) {
    throw Error("cannot get storage access key.");
  }
  rc.storageAccountAccessKey = key;
  rc.storageTableName = STORAGE_TABLE_NAME;
  rc.createdStorageTable = await createTableIfNotExists(
    accountName,
    STORAGE_TABLE_NAME,
    key
  );
};
