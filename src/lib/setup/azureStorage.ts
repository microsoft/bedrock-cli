import {
  RequestContext,
  RESOURCE_GROUP,
  STORAGE_ACCOUNT_NAME,
  STORAGE_TABLE_NAME,
  RESOURCE_GROUP_LOCATION,
} from "./constants";
import {
  createStorageAccount as createAccount,
  createTableIfNotExists,
  getStorageAccount,
  getStorageAccountKey,
} from "../azure/storage";
import * as promptBuilder from "../promptBuilder";
import inquirer from "inquirer";
import { build as buildError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";

export const createStorageAccount = async (
  name: string
): Promise<boolean | undefined> => {
  // get storage account by account name by reosource group under
  // the subscription
  const oStorage = await getStorageAccount(RESOURCE_GROUP, name);

  if (!oStorage) {
    try {
      await createAccount(RESOURCE_GROUP, name, RESOURCE_GROUP_LOCATION);
      // return true if account is successfully created
      return true;
    } catch (e) {
      // return undefined to indicate the account cannot be created
      // may be because the account name is not unique
      // prompt user for another account name.
      return undefined;
    }
  } else {
    // found it return false to indicate the it is not created
    // because it already exists.
    return false;
  }
};

export const waitForStorageAccountToBeProvisioned = async (
  name: string
): Promise<void> => {
  // it may take a while for the storage account to be provisioned
  // after it is created.
  let oStorage = await getStorageAccount(RESOURCE_GROUP, name);
  while (oStorage && oStorage.provisioningState !== "Succeeded") {
    oStorage = await getStorageAccount(RESOURCE_GROUP, name);
  }
};

export const tryToCreateStorageAccount = async (
  rc: RequestContext
): Promise<void> => {
  rc.storageAccountName = rc.storageAccountName || STORAGE_ACCOUNT_NAME;

  try {
    let res = await createStorageAccount(rc.storageAccountName);
    while (res === undefined) {
      const ans = await inquirer.prompt([
        promptBuilder.azureStorageAccountName(),
      ]);
      rc.storageAccountName = ans.azdo_storage_account_name as string;
      res = await createStorageAccount(rc.storageAccountName);
    }
    await waitForStorageAccountToBeProvisioned(rc.storageAccountName);
    rc.createdStorageAccount = !!res;
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_STORAGE_OP_ERR,
      {
        errorKey: "storage-account-cannot-be-created",
        values: [rc.storageAccountName],
      },
      err
    );
  }
};

export const createStorage = async (rc: RequestContext): Promise<void> => {
  await tryToCreateStorageAccount(rc);

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const accountName = rc.storageAccountName!;
  const key = await getStorageAccountKey(RESOURCE_GROUP, accountName);
  if (!key) {
    throw buildError(
      errorStatusCode.AZURE_STORAGE_OP_ERR,
      "storage-account-key-err"
    );
  }
  rc.storageAccountAccessKey = key;
  rc.storageTableName = STORAGE_TABLE_NAME;
  rc.createdStorageTable = await createTableIfNotExists(
    accountName,
    STORAGE_TABLE_NAME,
    key
  );
};
