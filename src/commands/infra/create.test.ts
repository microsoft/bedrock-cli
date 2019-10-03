import child_process from "child_process";
import fs, { chmod } from "fs";
import path from "path";
import shell from "shelljs";
import { exec } from "../../lib/shell";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { templateInit, validateInit } from "./create";

beforeAll(async () => {
  enableVerboseLogging();
  // Remove once check for Bedrock source is integrated with `spk infra init`
  if (!fs.existsSync(".bedrock")) {
    await exec("git", [
      "clone",
      "https://github.com/microsoft/bedrock.git",
      ".bedrock"
    ]);
  }
  // Increasing time for Terraform Init
  jest.setTimeout(20000);
});
afterAll(() => {
  disableVerboseLogging();
  // Remove .bedrock after testing
  if (fs.existsSync(".bedrock")) {
    shell.rm("-rf", ".bedrock");
  }
  jest.setTimeout(5000);
});

describe("Validating Bedrock source repo path", () => {
  test("Static bedrock path to spk root is passed", async () => {
    // Pass a static path to Bedrock source
    const bedrockTestDir = path.join(
      process.cwd(),
      ".bedrock/cluster/environments"
    );
    logger.info(`Using test Bedrock Source Template Path : ${bedrockTestDir}`);
    const test1 = await validateInit(bedrockTestDir);
    expect(test1).toBe(true);
  });
});
describe("Validating Bedrock source repo path with invalid test", () => {
  test("Static bedrock path to spk root is passed that is invalid", async () => {
    // Pass an invalid static path to Bedrock source
    const bedrockTestDir = path.join(process.cwd(), ".bedrock/invalid/path");
    logger.info(`Using test Bedrock Source Template Path : ${bedrockTestDir}`);
    const test2 = await validateInit(bedrockTestDir);
    expect(test2).toBe(false);
  });
});
describe("Validating Bedrock environment template with Terraform init", () => {
  test("Pass a Bedrock Environment to run a terraform init on the directory", async () => {
    // Pass a Bedrock template to run terraform init
    const bedrockTestDir = path.join(
      process.cwd(),
      ".bedrock/cluster/environments"
    );
    const bedrockTestEnv = "azure-simple";
    logger.info(`Using test Bedrock Template Environment : ${bedrockTestEnv}`);
    const test3 = await templateInit(bedrockTestDir, bedrockTestEnv);
    expect(test3).toContain("Terraform has been successfully initialized!");
  });
});
