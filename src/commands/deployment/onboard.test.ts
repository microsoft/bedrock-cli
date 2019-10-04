import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { createStorageAccount } from "./onboard";

jest.mock("../../lib/azure/storage");
jest.mock("../../lib/azure/keyvault");
jest.mock("../../lib/azure/azurecredentials");

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("create storage account if not exists", () => {
  it("should create storage account", async () => {
    await createStorageAccount(
      "epi-test",
      "testsarathp1",
      "westus2",
      "sarathpvault"
    );
  }, 50000);

  it("should not create storage account", async () => {
    await createStorageAccount(
      "epi-test",
      "testsarathp1",
      "westus2",
      "sarathpvault"
    );
  }, 50000);
});
