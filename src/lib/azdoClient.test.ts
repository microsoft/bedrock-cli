// Mocks
jest.mock("azure-devops-node-api");
jest.mock("../config");

// Imports
import { IBuildApi } from "azure-devops-node-api/BuildApi";
import { RestClient } from "typed-rest-client";
import uuid from "uuid/v4";
import { Config } from "../config";
import { azdoUrl, getBuildApi, getRestClient, getWebApi } from "./azdoClient";

// Tests
describe("AzDo Pipeline utility functions", () => {
  test("azdo url is well formed", () => {
    const org = "test";
    expect(azdoUrl(org)).toBe("https://dev.azure.com/test");
  });
});

describe("getWebApi", () => {
  test("should fail when personal access toekn is not set", async () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {}
    });

    let error: Error | undefined;
    try {
      await getWebApi();
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
  });

  test("should fail when org is not set", async () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {
        access_token: uuid()
      }
    });

    let error: Error | undefined;
    try {
      await getWebApi();
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
  });

  test("should pass when org and personal access toekn are set", async () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {
        access_token: uuid(),
        org: uuid()
      }
    });

    let error: Error | undefined;

    try {
      await getWebApi();
    } catch (err) {
      error = err;
    }
    expect(error).toBeUndefined();
  });
});

describe("getRestClient", () => {
  test("should fail when personal access toekn is not set", async () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {}
    });

    let api: RestClient | undefined;
    try {
      api = await getRestClient();
    } catch (_) {
      // ignore
    }
    expect(api).toBeUndefined();
  });

  test("should fail when org is not set", async () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {
        access_token: uuid()
      }
    });

    let api: RestClient | undefined;
    try {
      api = await getRestClient();
    } catch (_) {
      // ignore
    }
    expect(api).toBeUndefined();
  });

  test("should pass when org and personal access toekn are set", async () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {
        access_token: uuid(),
        org: uuid()
      }
    });

    let api: RestClient | undefined;

    try {
      api = await getRestClient();
    } catch (_) {
      // ignore
    }
    expect(api).toBeUndefined();
  });
});

describe("getBuildApi", () => {
  test("should fail when personal access toekn is not set", async () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {}
    });

    let error: Error | undefined;
    try {
      await getBuildApi();
      expect(true).toBe(false);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
  });

  test("should fail when org is not set", async () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {
        access_token: uuid()
      }
    });

    let api: IBuildApi | undefined;

    try {
      api = await getBuildApi();
    } catch (_) {
      // ignore
    }
    expect(api).toBeUndefined();
  });

  test("should pass when org and personal access toekn are set", async () => {
    (Config as jest.Mock).mockReturnValue({
      azure_devops: {
        access_token: uuid(),
        org: uuid()
      }
    });

    let api: IBuildApi | undefined;

    try {
      api = await getBuildApi();
    } catch (_) {
      // ignored
    }
    expect(api).toBeUndefined();
  });
});
