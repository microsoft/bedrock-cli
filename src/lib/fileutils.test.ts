import fs, { write } from "fs";
import mockFs from "mock-fs";

import yaml from "js-yaml";
import {
  createTestBedrockYaml,
  createTestHldAzurePipelinesYaml,
  createTestMaintainersYaml
} from "../test/mockFactory";

import path from "path";

import { disableVerboseLogging, enableVerboseLogging } from "../logger";
import { IBedrockFile, IHelmConfig, IMaintainersFile } from "../types";
import {
  addNewServiceToBedrockFile,
  addNewServiceToMaintainersFile,
  generateGitIgnoreFile,
  generateHldAzurePipelinesYaml
} from "./fileutils";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("generateHldAzurePipelinesYaml", () => {
  const targetDirectory = "hld-repository";
  const writeSpy = jest.spyOn(fs, "writeFileSync");
  beforeEach(() => {
    mockFs({
      "hld-repository": {}
    });
  });
  afterEach(() => {
    mockFs.restore();
  });

  it("should not do anything if file exist", async () => {
    const mockFsOptions = {
      [`${targetDirectory}/azure-pipelines.yaml`]: "existing pipeline"
    };
    mockFs(mockFsOptions);

    generateHldAzurePipelinesYaml(targetDirectory);
    expect(writeSpy).not.toBeCalled();
  });

  it("should generate the file if one does not exist", async () => {
    const absTargetPath = path.resolve(targetDirectory);
    const expectedFilePath = `${absTargetPath}/azure-pipelines.yaml`;

    generateHldAzurePipelinesYaml(targetDirectory);
    expect(writeSpy).toBeCalledWith(
      expectedFilePath,
      createTestHldAzurePipelinesYaml(),
      "utf8"
    );
    expect(writeSpy).toBeCalled();
  });
});

describe("Adding a new service to a Maintainer file", () => {
  beforeAll(() => {
    mockFs({
      "maintainers.yaml": createTestMaintainersYaml() as any
    });
  });

  afterAll(() => {
    mockFs.restore();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should update existing maintainers.yml with new service maintainers", async () => {
    const maintainersFilePath = "maintainers.yaml";

    const servicePath = "packages/my-new-service";
    const newUser = {
      email: "hello@example.com",
      name: "testUser"
    };

    const writeSpy = jest.spyOn(fs, "writeFileSync");
    addNewServiceToMaintainersFile(maintainersFilePath, servicePath, [newUser]);

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
    const expectedGitIgnoreFilePath = `${absTargetPath}/.gitignore`;

    expect(writeSpy).toBeCalledWith(expectedGitIgnoreFilePath, content, "utf8");
  });
});

describe("Adding a new service to a Bedrock file", () => {
  beforeAll(() => {
    mockFs({
      "bedrock.yaml": createTestBedrockYaml() as any
    });
  });

  afterAll(() => {
    mockFs.restore();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should update existing bedrock.yml with a new service and its helm chart config", async () => {
    const bedrockFilePath = "bedrock.yaml";

    const servicePath = "packages/my-new-service";
    const helmConfig: IHelmConfig = {
      chart: {
        chart: "somehelmchart",
        repository: "somehelmrepository"
      }
    };

    const writeSpy = jest.spyOn(fs, "writeFileSync");
    addNewServiceToBedrockFile(bedrockFilePath, servicePath, helmConfig);

    const defaultBedrockFileObject = createTestBedrockYaml(false);

    const expected: IBedrockFile = {
      rings: {},
      services: {
        ...((defaultBedrockFileObject as any) as IBedrockFile).services,
        ["./" + servicePath]: {
          helm: helmConfig
        }
      }
    };

    expect(writeSpy).toBeCalledWith(
      bedrockFilePath,
      yaml.safeDump(expected),
      "utf8"
    );
  });
});
