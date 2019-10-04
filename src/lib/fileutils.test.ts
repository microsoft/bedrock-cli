import fs from "fs";
import mockFs from "mock-fs";

import yaml from "js-yaml";
import { createTestMaintainersYaml } from "../test/mockFactory";

import path from "path";

import { disableVerboseLogging, enableVerboseLogging, logger } from "../logger";
import { IMaintainersFile, IUser } from "../types";
import {
  addNewServiceToMaintainersFile,
  generateGitIgnoreFile
} from "./fileutils";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("Adding a new service", () => {
  beforeAll(() => {
    mockFs({
      "maintainers.yml": createTestMaintainersYaml() as any
    });
  });

  afterAll(() => {
    mockFs.restore();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should update existing maintainers.yml with new service maintainers", async () => {
    const maintainersFilePath = "maintainers.yml";

    const servicePath = "packages/my-new-service";
    const newUser = {
      email: "hello@example.com",
      name: "testUser"
    };

    const writeSpy = jest.spyOn(fs, "writeFileSync");
    await addNewServiceToMaintainersFile(maintainersFilePath, servicePath, [
      newUser
    ]);

    const defaultMaintainersFileObject = createTestMaintainersYaml(false);

    const expected: IMaintainersFile = {
      services: {
        ...((defaultMaintainersFileObject as any) as IMaintainersFile).services,
        ["./" + servicePath]: {
          maintainers: [newUser]
        }
      }
    };

    expect(writeSpy).toBeCalledWith(
      maintainersFilePath,
      yaml.safeDump(expected),
      "utf8"
    );
  });
});

describe("generating service gitignore file", () => {
  const targetDirectory = "my-new-service";

  beforeEach(() => {
    mockFs({
      "my-new-service": {}
    });
  });
  afterEach(() => {
    mockFs.restore();
  });

  const content = "hello world";

  it("should not do anything if file exist", async () => {
    const mockFsOptions = {
      [`${targetDirectory}/.gitignore`]: "foobar"
    };
    mockFs(mockFsOptions);

    const writeSpy = jest.spyOn(fs, "writeFileSync");
    generateGitIgnoreFile(targetDirectory, content);
    expect(writeSpy).not.toBeCalled();
  });

  it("should generate the file if one does not exist", async () => {
    const writeSpy = jest.spyOn(fs, "writeFileSync");
    generateGitIgnoreFile(targetDirectory, content);

    const absTargetPath = path.resolve(targetDirectory);
    const expedtedGitIgnoreFilePath = `${absTargetPath}/.gitignore`;

    expect(writeSpy).toBeCalledWith(expedtedGitIgnoreFilePath, content, "utf8");
  });
});
