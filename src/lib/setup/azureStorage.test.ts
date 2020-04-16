import inquirer from "inquirer";
import {
  createStorage,
  createStorageAccount,
  tryToCreateStorageAccount,
  waitForStorageAccountToBeProvisioned,
} from "./azureStorage";
import * as azureStorage from "./azureStorage";
import { RequestContext, STORAGE_ACCOUNT_NAME } from "./constants";
import * as azure from "../azure/storage";
import { getErrorMessage } from "../errorBuilder";

const testCreateStorage = async (positive: boolean): Promise<void> => {
  jest.spyOn(azureStorage, "tryToCreateStorageAccount").mockImplementationOnce(
    (rc: RequestContext): Promise<void> => {
      return new Promise((resolve) => {
        rc.createdStorageAccount = true;
        resolve();
      });
    }
  );
  if (positive) {
    jest.spyOn(azure, "getStorageAccountKey").mockResolvedValueOnce("key===");
    jest.spyOn(azure, "createTableIfNotExists").mockResolvedValueOnce(true);
  } else {
    jest.spyOn(azure, "getStorageAccountKey").mockResolvedValueOnce(undefined);
  }

  const rc: RequestContext = {
    orgName: "notUsed",
    projectName: "notUsed",
    accessToken: "notUsed",
    workspace: "notUsed",
  };

  if (positive) {
    await createStorage(rc);
    expect(rc.createdStorageAccount).toBeTruthy();
    expect(rc.createdStorageTable).toBeTruthy();
  } else {
    await expect(createStorage(rc)).rejects.toThrow();
  }
};

describe("test createStorage function", () => {
  it("positive test", async () => {
    testCreateStorage(true);
  });
  it("negative test", async () => {
    testCreateStorage(false);
  });
});

describe("test tryToCreateStorageAccount function", () => {
  it("positive test", async () => {
    jest
      .spyOn(azureStorage, "createStorageAccount")
      .mockResolvedValueOnce(true);
    jest
      .spyOn(azureStorage, "waitForStorageAccountToBeProvisioned")
      .mockResolvedValueOnce();

    const rc: RequestContext = {
      orgName: "notUsed",
      projectName: "notUsed",
      accessToken: "notUsed",
      workspace: "notUsed",
    };
    await tryToCreateStorageAccount(rc);
    expect(rc.createdStorageAccount).toBeTruthy();
  });
  it("positive test: name used", async () => {
    jest
      .spyOn(azureStorage, "createStorageAccount")
      .mockResolvedValueOnce(undefined);
    jest
      .spyOn(azureStorage, "createStorageAccount")
      .mockResolvedValueOnce(true);
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce({
      // eslint-disable-next-line @typescript-eslint/camelcase
      azdo_storage_account_name: "teststore",
    });
    jest
      .spyOn(azureStorage, "waitForStorageAccountToBeProvisioned")
      .mockResolvedValueOnce();

    const rc: RequestContext = {
      orgName: "notUsed",
      projectName: "notUsed",
      accessToken: "notUsed",
      workspace: "notUsed",
    };
    await tryToCreateStorageAccount(rc);
    expect(rc.createdStorageAccount).toBeTruthy();
    expect(rc.storageAccountName).toBe("teststore");
  });
  it("negative test", async () => {
    jest
      .spyOn(azureStorage, "createStorageAccount")
      .mockRejectedValueOnce(Error());
    const rc: RequestContext = {
      orgName: "notUsed",
      projectName: "notUsed",
      accessToken: "notUsed",
      workspace: "notUsed",
    };
    await expect(tryToCreateStorageAccount(rc)).rejects.toThrow(
      getErrorMessage({
        errorKey: "storage-account-cannot-be-created",
        values: [STORAGE_ACCOUNT_NAME],
      })
    );
  });
});

describe("test createStorageAccount function", () => {
  it("positive test: account already exist", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(azure, "getStorageAccount").mockResolvedValueOnce({} as any);
    const result = await createStorageAccount("temp");
    expect(result).toBeFalsy();
  });
  it("positive test: account doe not exist", async () => {
    jest.spyOn(azure, "getStorageAccount").mockResolvedValueOnce(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(azure, "createStorageAccount").mockResolvedValueOnce({} as any);

    const result = await createStorageAccount("temp");
    expect(result).toBeTruthy();
  });
  it("negative test", async () => {
    jest.spyOn(azure, "getStorageAccount").mockResolvedValueOnce(undefined);
    jest
      .spyOn(azure, "createStorageAccount")
      .mockRejectedValueOnce(Error("fake"));

    const result = await createStorageAccount("temp");
    expect(result).toBeUndefined();
  });
});

describe("test waitForStorageAccountToBeProvisioned function", () => {
  it("sanity test", async () => {
    const fn = jest.spyOn(azure, "getStorageAccount");
    fn.mockReset();
    fn.mockResolvedValueOnce({
      provisioningState: "Succeeded",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await waitForStorageAccountToBeProvisioned("dummy");
    expect(fn).toBeCalledTimes(1);
  });
  it("sanity test: poll twicw", async () => {
    const fn = jest.spyOn(azure, "getStorageAccount");
    fn.mockReset();

    fn.mockResolvedValueOnce({
      provisioningState: "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    fn.mockResolvedValueOnce({
      provisioningState: "Succeeded",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await waitForStorageAccountToBeProvisioned("dummy");
    expect(fn).toBeCalledTimes(2);
  });
});
