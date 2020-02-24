////////////////////////////////////////////////////////////////////////////////
// !!NOTE!!
// This test suite uses mock-fs to mock out the the file system
// console.log CANNOT be reliably called in this suite
// - https://github.com/facebook/jest/issues/5792
// - https://github.com/tschaub/mock-fs/issues/234
//
// Workaround: The global logger object in `src/logger` does work, so use that
// to debug
////////////////////////////////////////////////////////////////////////////////
import fs from "fs";
import yaml from "js-yaml";
import mockFs from "mock-fs";
import os from "os";
import path from "path";
import shelljs from "shelljs";
import uuid from "uuid/v4";
import {
  ACCESS_FILENAME,
  HLD_COMPONENT_FILENAME,
  PROJECT_PIPELINE_FILENAME,
  RENDER_HLD_PIPELINE_FILENAME,
  SERVICE_PIPELINE_FILENAME,
  VM_IMAGE
} from "../lib/constants";
import { disableVerboseLogging, enableVerboseLogging } from "../logger";
import {
  createTestComponentYaml,
  createTestHldAzurePipelinesYaml,
  createTestHldLifecyclePipelineYaml,
  createTestMaintainersYaml,
  createTestServiceBuildAndUpdatePipelineYaml
} from "../test/mockFactory";
import { IAccessYaml, IAzurePipelinesYaml, IMaintainersFile } from "../types";
import {
  addNewServiceToMaintainersFile,
  generateAccessYaml,
  generateDefaultHldComponentYaml,
  generateDockerfile,
  generateGitIgnoreFile,
  generateHldAzurePipelinesYaml,
  generateHldLifecyclePipelineYaml,
  generateServiceBuildAndUpdatePipelineYaml,
  generateYamlScript,
  serviceBuildAndUpdatePipeline
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

describe("generateAccessYaml", () => {
  const targetDirectory = "hld-repository";
  const serviceDirectory = "my-service";
  const writeSpy = jest.spyOn(fs, "writeFileSync");

  beforeEach(() => {
    mockFs({
      "hld-repository": {
        "my-service": {}
      }
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it("if no access.yaml exists, it should generate the access.yaml in the filepath.", async () => {
    const absTargetPath = path.resolve(
      path.join(targetDirectory, serviceDirectory)
    );
    const expectedFilePath = path.join(absTargetPath, ACCESS_FILENAME);
    const gitRepoUrl =
      "https://fabrikam@dev.azure.com/someorg/someproject/_git/fabrikam2019";

    const accessYaml: IAccessYaml = {};
    accessYaml[gitRepoUrl] = "ACCESS_TOKEN_SECRET";

    generateAccessYaml(absTargetPath, gitRepoUrl);

    expect(writeSpy).toBeCalledWith(
      expectedFilePath,
      yaml.safeDump(accessYaml),
      "utf8"
    );
    expect(writeSpy).toBeCalled();
  });

  it("if an access.yaml already exists, it should update access.yaml in the filepath", async () => {
    const mockFsOptions = {
      [`${targetDirectory}/${serviceDirectory}/${ACCESS_FILENAME}`]: "'https://fabrikam@dev.azure.com/someorg/someproject/_git/fabrikam2019': ACCESS_TOKEN_SECRET"
    };
    mockFs(mockFsOptions);

    const absTargetPath = path.resolve(
      path.join(targetDirectory, serviceDirectory)
    );
    const expectedFilePath = path.join(absTargetPath, ACCESS_FILENAME);
    const gitRepoUrl =
      "https://fabrikam@dev.azure.com/someorg/someproject/_git/fabrikam2019";

    const gitRepoUrl2 =
      "https://fabrikam@dev.azure.com/someorg/someproject/_git/private-helm-repo";
    const accessYaml: IAccessYaml = {};
    accessYaml[gitRepoUrl2] = "ACCESS_TOKEN_SECRET";
    accessYaml[gitRepoUrl] = "ACCESS_TOKEN_SECRET";

    generateAccessYaml(absTargetPath, gitRepoUrl2);

    expect(writeSpy).toBeCalledWith(
      expectedFilePath,
      yaml.safeDump(accessYaml),
      "utf8"
    );
    expect(writeSpy).toBeCalled();
  });

  it("if an access.yaml already exists, it should update access.yaml in the filepath, but not overwrite anything that exists.", async () => {
    const mockFsOptions = {
      [`${targetDirectory}/${serviceDirectory}/${ACCESS_FILENAME}`]: "'https://fabrikam@dev.azure.com/someorg/someproject/_git/fabrikam2019': MY_CUSTOM_SECRET"
    };
    mockFs(mockFsOptions);

    const absTargetPath = path.resolve(
      path.join(targetDirectory, serviceDirectory)
    );
    const expectedFilePath = path.join(absTargetPath, ACCESS_FILENAME);
    const gitRepoUrl =
      "https://fabrikam@dev.azure.com/someorg/someproject/_git/fabrikam2019";

    const accessYaml: IAccessYaml = {};
    accessYaml[gitRepoUrl] = "MY_CUSTOM_SECRET";

    generateAccessYaml(absTargetPath, gitRepoUrl);

    expect(writeSpy).toBeCalledWith(
      expectedFilePath,
      yaml.safeDump(accessYaml),
      "utf8"
    );
    expect(writeSpy).toBeCalled();
  });
});

describe("generateServiceBuildAndUpdatePipelineYaml", () => {
  const targetDirectory = "app-repository";
  const serviceDirectory = "my-service";
  const writeSpy = jest.spyOn(fs, "writeFileSync");

  beforeEach(() => {
    mockFs({
      "app-repository": {
        "my-service": {}
      }
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it("should not do anything if build-update-hld.yaml exists", async () => {
    const mockFsOptions = {
      [`${targetDirectory}/${serviceDirectory}/${SERVICE_PIPELINE_FILENAME}`]: "existing pipeline"
    };
    mockFs(mockFsOptions);

    generateServiceBuildAndUpdatePipelineYaml(
      targetDirectory,
      [],
      "my-service",
      path.join(targetDirectory, serviceDirectory),
      []
    );
    expect(writeSpy).not.toBeCalled();
  });

  it("should generate the build-update-hld.yaml if one does not exist", async () => {
    const absTargetPath = path.resolve(targetDirectory);
    const expectedFilePath = `${absTargetPath}/${serviceDirectory}/${SERVICE_PIPELINE_FILENAME}`;

    generateServiceBuildAndUpdatePipelineYaml(
      targetDirectory,
      [],
      "my-service",
      path.join(targetDirectory, serviceDirectory),
      []
    );
    expect(writeSpy).toBeCalledWith(
      expectedFilePath,
      createTestServiceBuildAndUpdatePipelineYaml(
        true,
        "my-service",
        "./my-service",
        [],
        []
      ),
      "utf8"
    );
    expect(writeSpy).toBeCalled();
  });
});

describe("generateHldLifecyclePipelineYaml", () => {
  const targetDirectory = "app-repository";
  const writeSpy = jest.spyOn(fs, "writeFileSync");

  beforeEach(() => {
    mockFs({
      "app-repository": {}
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it("should not do anything if hld-lifecycle.yaml exists", async () => {
    const mockFsOptions = {
      [`${targetDirectory}/${PROJECT_PIPELINE_FILENAME}`]: "existing pipeline"
    };
    mockFs(mockFsOptions);

    generateHldLifecyclePipelineYaml(targetDirectory);
    expect(writeSpy).not.toBeCalled();
  });

  it("should generate the hld-lifecycle.yaml if one does not exist", async () => {
    const expectedFilePath = `${targetDirectory}/${PROJECT_PIPELINE_FILENAME}`;

    generateHldLifecyclePipelineYaml(targetDirectory);
    expect(writeSpy).toBeCalledWith(
      expectedFilePath,
      createTestHldLifecyclePipelineYaml(),
      "utf8"
    );
    expect(writeSpy).toBeCalled();
  });
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
      [`${targetDirectory}/${RENDER_HLD_PIPELINE_FILENAME}`]: "existing pipeline"
    };
    mockFs(mockFsOptions);

    generateHldAzurePipelinesYaml(targetDirectory);
    expect(writeSpy).not.toBeCalled();
  });

  it("should generate the file if one does not exist", async () => {
    const absTargetPath = path.resolve(targetDirectory);
    const expectedFilePath = `${absTargetPath}/${RENDER_HLD_PIPELINE_FILENAME}`;

    generateHldAzurePipelinesYaml(targetDirectory);
    expect(writeSpy).toBeCalledWith(
      expectedFilePath,
      createTestHldAzurePipelinesYaml(),
      "utf8"
    );
    expect(writeSpy).toBeCalled();
  });
});

describe("generateDefaultHldComponentYaml", () => {
  const targetDirectory = "hld-repository";
  const writeSpy = jest.spyOn(fs, "writeFileSync");

  const componentRepo =
    "https://github.com/microsoft/fabrikate-definitions.git";
  const componentName = "traefik2";
  const componentPath = "definitions/traefik2";
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
      [`${targetDirectory}/component.yaml`]: "existing component"
    };
    mockFs(mockFsOptions);

    generateDefaultHldComponentYaml(
      targetDirectory,
      componentRepo,
      componentName,
      componentPath
    );
    expect(writeSpy).not.toBeCalled();
  });

  it("should generate the file if one does not exist", async () => {
    const absTargetPath = path.resolve(targetDirectory);
    const expectedFilePath = `${absTargetPath}/${HLD_COMPONENT_FILENAME}`;
    generateDefaultHldComponentYaml(
      targetDirectory,
      componentRepo,
      componentName,
      componentPath
    );

    expect(writeSpy).toBeCalledWith(
      expectedFilePath,
      createTestComponentYaml(),
      "utf8"
    );
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

describe("generating service Dockerfile", () => {
  const targetDirectory = "my-new-service";

  beforeEach(() => {
    mockFs({
      "my-new-service": {}
    });
  });
  afterEach(() => {
    mockFs.restore();
  });

  it("should not do anything if file exist", async () => {
    const mockFsOptions = {
      [`${targetDirectory}/Dockerfile`]: "hello!!!!"
    };
    mockFs(mockFsOptions);

    const writeSpy = jest.spyOn(fs, "writeFileSync");
    generateDockerfile(targetDirectory);
    expect(writeSpy).not.toBeCalled();
  });

  it("should generate the file if one does not exist", async () => {
    const writeSpy = jest.spyOn(fs, "writeFileSync");
    generateDockerfile(targetDirectory);

    const absTargetPath = path.resolve(targetDirectory);
    const expectedGitIgnoreFilePath = `${absTargetPath}/Dockerfile`;

    expect(writeSpy).toBeCalledWith(
      expectedGitIgnoreFilePath,
      "FROM alpine\nRUN echo 'hello world'",
      "utf8"
    );
  });
});

describe("serviceBuildUpdatePipeline", () => {
  // Create a random workspace dir before every test
  let randomDirPath = "";
  beforeEach(() => {
    randomDirPath = path.join(os.tmpdir(), uuid());
    shelljs.mkdir("-p", randomDirPath);
  });

  test("that the value of the file is the same after (de)serialization", async () => {
    const serviceName = "mycoolservice";
    const servicePath = "./mycoolservice";
    const ringBranches = ["master", "qa", "test"];
    const variableGroups = ["foo", "bar"];
    const buildPipelineYaml = await serviceBuildAndUpdatePipeline(
      serviceName,
      servicePath,
      ringBranches,
      variableGroups
    );
    const serializedYaml = yaml.safeDump(buildPipelineYaml, {
      lineWidth: Number.MAX_SAFE_INTEGER
    });
    const pipelinesPath = path.join(randomDirPath, SERVICE_PIPELINE_FILENAME);
    fs.writeFileSync(pipelinesPath, serializedYaml);
    const deserializedYaml = yaml.safeLoad(
      fs.readFileSync(pipelinesPath, "utf8")
    );

    // should be equal to the initial value
    expect(deserializedYaml).toStrictEqual(buildPipelineYaml);

    // variables should include all groups
    for (const group of variableGroups) {
      expect(buildPipelineYaml.variables!.includes({ group }));
    }
    expect(buildPipelineYaml.variables!.length).toBe(variableGroups.length);

    // trigger branches should include all ring branches
    for (const branch of ringBranches) {
      expect(buildPipelineYaml.trigger!.branches!.include!.includes(branch));
    }
    expect(buildPipelineYaml.trigger!.branches!.include!.length).toBe(
      ringBranches.length
    );

    // verify components of stages
    expect(buildPipelineYaml.stages && buildPipelineYaml.stages.length === 2);
    for (const stage of buildPipelineYaml.stages!) {
      for (const job of stage.jobs) {
        // pool.vmImage should be 'gentoo'
        expect(job.pool!.vmImage).toBe(VM_IMAGE);
        expect(job.steps);
      }
    }
  });

  test("that all services receive an build-update-hld-pipeline.yaml with the correct paths and variable groups have been inserted", async () => {
    // Create service directories
    const serviceReferences = ["serviceA", "serviceB", "serviceC"].map(
      serviceName => {
        const servicePath = path.join(randomDirPath, "packages", serviceName);
        shelljs.mkdir("-p", servicePath);
        return { serviceName, servicePath };
      }
    );

    const ringBranches = ["master", "qa", "test"];
    const variableGroups = [uuid(), uuid()];

    for (const serviceReference of serviceReferences) {
      await generateServiceBuildAndUpdatePipelineYaml(
        randomDirPath,
        ringBranches,
        serviceReference.serviceName,
        serviceReference.servicePath,
        variableGroups
      );

      // file should exist
      expect(fs.existsSync(serviceReference.servicePath)).toBe(true);

      // pipeline triggers should include the relative path to the service
      const azureYaml: IAzurePipelinesYaml = yaml.safeLoad(
        fs.readFileSync(
          path.join(serviceReference.servicePath, SERVICE_PIPELINE_FILENAME),
          "utf8"
        )
      );
      const hasCorrectIncludes = azureYaml.trigger!.paths!.include!.includes(
        "./" + path.relative(randomDirPath, serviceReference.servicePath)
      );
      expect(hasCorrectIncludes).toBe(true);

      let hasCorrectVariableGroup1: boolean = false;
      let hasCorrectVariableGroup2: boolean = false;
      for (const value of Object.values(azureYaml.variables!)) {
        const item = value as { group: string };

        if (item.group === variableGroups[0]) {
          hasCorrectVariableGroup1 = true;
        }

        if (item.group === variableGroups[1]) {
          hasCorrectVariableGroup2 = true;
        }
      }

      expect(hasCorrectIncludes).toBe(true);
      expect(hasCorrectVariableGroup1).toBe(true);
      expect(hasCorrectVariableGroup2).toBe(true);
    }
  });
});

describe("generateYamlScript", () => {
  test("'set -e' is injected as the first line", async () => {
    const generated = generateYamlScript(["foo", "bar", "baz"]);
    expect(generated.startsWith("set -e\n")).toBe(true);
  });
});
