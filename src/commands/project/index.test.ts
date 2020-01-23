// imports
import fs from "fs";
import yaml from "js-yaml";
import os from "os";
import path from "path";
import uuid from "uuid/v4";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { IBedrockFile } from "../../types";
import { isBedrockFileExists } from "././create-variable-group";

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
