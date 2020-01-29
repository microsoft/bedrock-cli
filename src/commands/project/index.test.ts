// imports
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("isBedrockFileExists", () => {
  test("Should fail when empty file directory is passed", async () => {
    logger.info("placeholder");
  });
});
