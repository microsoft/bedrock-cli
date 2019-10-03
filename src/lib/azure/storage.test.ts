import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import {
  createStorageAccountIfNotExists,
  getStorageAccountKey
} from "./storage";

jest.mock("./storage");

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("create storage account if not exists", () => {
  it("should create storage account", async () => {
    await createStorageAccountIfNotExists(
      "epi-test",
      "testsarathp3",
      "westus2"
    );
  }, 50000);

  it("should not create storage account", async () => {
    await createStorageAccountIfNotExists(
      "epi-test",
      "testsarathp3",
      "westus2"
    );
  }, 50000);
});

describe("get storage account key", () => {
  it("should create storage account", async () => {
    logger.info(`called mock get key`);
    const key = await getStorageAccountKey("epi-test", "testsarathp3");
    expect(key).toBe("mock access key");
  });
});
