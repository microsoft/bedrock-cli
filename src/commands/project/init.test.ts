import fs from "fs";
import os from "os";
import path from "path";
import shell from "shelljs";
import uuid from "uuid/v4";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { initialize } from "./init";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("Initializing a blank standard repo", () => {
  test("bedrock.yaml, maintainers.yaml, and azure-pipelines.yaml gets generated in the project root on init for standard repository", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    // init
    await initialize(randomTmpDir);

    // bedrock.yaml, maintainers.yaml, and azure-pipelines.yaml should be in a the root for a 'standard' project
    const filepaths = [
      "bedrock.yaml",
      "maintainers.yaml",
      "azure-pipelines.yaml"
    ].map(filename => path.join(randomTmpDir, filename));

    for (const filepath of filepaths) {
      expect(fs.existsSync(filepath)).toBe(true);
    }
  });
});

describe("Initializing a blank mono-repo", () => {
  test("bedrock.yaml and maintainers.yaml get generated in the project root and azure-pipelines.yaml gets generated in all package directories in a mono-repo", async () => {
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    // Create some empty service directories
    const randomPackagesDir = uuid();
    const randomSubProjectDirs = Array.from({ length: 3 }, (_, i) => {
      const projectDir = path.join(
        randomTmpDir,
        randomPackagesDir,
        i.toString()
      );
      expect(shell.mkdir("-p", projectDir).code).toBe(0);
      return projectDir;
    });

    // Initialize the monorepo
    await initialize(randomTmpDir, {
      monoRepo: true,
      packagesDir: randomPackagesDir
    });

    // root should have bedrock.yaml and maintainers.yaml and should not be in the the package dirs
    for (const file of ["bedrock.yaml", "maintainers.yaml"]) {
      const filepath = path.join(randomTmpDir, file);
      // Should be in package dir
      expect(fs.existsSync(filepath)).toBe(true);

      // Should not be in project-root dir
      for (const subProjectDir of randomSubProjectDirs) {
        const filepathInPackage = path.join(subProjectDir, file);
        expect(fs.existsSync(filepathInPackage)).toBe(false);
      }
    }

    // All package directories should have an azure-pipelines.yaml
    for (const subProjectDir of randomSubProjectDirs) {
      const filepath = path.join(subProjectDir, "azure-pipelines.yaml");
      expect(fs.existsSync(filepath)).toBe(true);
    }

    // azure-pipelines.yaml should not be in the root
    expect(fs.existsSync(path.join(randomTmpDir, "azure-pipelines.yaml"))).toBe(
      false
    );
  });
});
