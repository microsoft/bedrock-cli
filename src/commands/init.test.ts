import fs from "fs";
import os from "os";
import path from "path";
import shell from "shelljs";
import uuid from "uuid/v4";
import { disableVerboseLogging, enableVerboseLogging } from "../logger";
import { initialize } from "./init";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

test("bedrock.yaml, maintainers.yaml, and azure-pipelines.yaml gets generated on init for non mono-repo", async () => {
  // Create random directory to initialize
  const randomTmpDir = path.join(os.tmpdir(), uuid());
  fs.mkdirSync(randomTmpDir);

  // init
  await initialize(randomTmpDir);

  // Ensure all necessary are created
  const filepaths = [
    "bedrock.yaml",
    "maintainers.yaml",
    "azure-pipelines.yaml"
  ].map(filename => path.join(randomTmpDir, filename));

  for (const filepath of filepaths) {
    expect(fs.existsSync(filepath)).toBe(true);
  }
});

test("bedrock.yaml, maintainers.yaml, and azure-pipelines.yaml gets generated for all package directories in a mono-repo", async () => {
  const randomTmpDir = path.join(os.tmpdir(), uuid());
  fs.mkdirSync(randomTmpDir);

  // Create 3 empty stub project
  const randomPackagesDir = uuid();
  const randomSubProjectDirs = Array.from({ length: 3 }, (_, i) => {
    const projectDir = path.join(randomTmpDir, randomPackagesDir, i.toString());
    expect(shell.mkdir("-p", projectDir).code).toBe(0);
    return projectDir;
  });

  // Initialize the monorepo
  await initialize(randomTmpDir, {
    monoRepo: true,
    packagesDir: randomPackagesDir
  });

  for (const subProjectDir of randomSubProjectDirs) {
    // Ensure all sub-projects have the necessary files
    const filepaths = [
      "bedrock.yaml",
      "maintainers.yaml",
      "azure-pipelines.yaml"
    ].map(filename => path.join(subProjectDir, filename));

    for (const filepath of filepaths) {
      expect(fs.existsSync(filepath)).toBe(true);
    }
  }
});
