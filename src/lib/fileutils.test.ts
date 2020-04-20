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
  VM_IMAGE,
  BEDROCK_FILENAME,
} from "../lib/constants";
import { disableVerboseLogging, enableVerboseLogging } from "../logger";
import {
  createTestComponentYaml,
  createTestHldAzurePipelinesYaml,
  createTestHldAzurePipelinesYamlWithVariableGroup,
  createTestHldLifecyclePipelineYaml,
  createTestMaintainersYaml,
  createTestServiceBuildAndUpdatePipelineYaml,
} from "../test/mockFactory";
import { AccessYaml, AzurePipelinesYaml, MaintainersFile } from "../types";
import { errorStatusCode } from "./errorStatusCode";
import {
  addNewServiceToMaintainersFile,
  appendVariableGroupToPipelineYaml,
  generateAccessYaml,
  generateDefaultHldComponentYaml,
  generateDockerfile,
  generateGitIgnoreFile,
  generateHldAzurePipelinesYaml,
  generateHldLifecyclePipelineYaml,
  generateServiceBuildAndUpdatePipelineYaml,
  generateYamlScript,
  getVersionMessage,
  sanitizeTriggerPath,
  serviceBuildAndUpdatePipeline,
  updateTriggerBranchesForServiceBuildAndUpdatePipeline,
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

jest.mock("../../package.json", () => {
  return { version: "0.5" };
});

describe("generateAccessYaml", () => {
  const targetDirectory = "hld-repository";
  const serviceDirectory = "my-service";
  const writeSpy = jest.spyOn(fs, "writeFileSync");

  beforeEach(() => {
    mockFs({
      "hld-repository": {
        "my-service": {},
      },
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it("if no access.yaml exists, it should generate the access.yaml in the filepath.", () => {
    const absTargetPath = path.resolve(
      path.join(targetDirectory, serviceDirectory)
    );
    const expectedFilePath = path.join(absTargetPath, ACCESS_FILENAME);
    const gitRepoUrl =
      "https://fabrikam@dev.azure.com/someorg/someproject/_git/fabrikam2019";

    const accessYaml: AccessYaml = {};
    accessYaml[gitRepoUrl] = "ACCESS_TOKEN_SECRET";

    generateAccessYaml(absTargetPath, gitRepoUrl);

    expect(writeSpy).toBeCalledWith(
      expectedFilePath,
      yaml.safeDump(accessYaml),
      "utf8"
    );
    expect(writeSpy).toBeCalled();
  });

  it("if an access.yaml already exists, it should update access.yaml in the filepath", () => {
    const mockFsOptions = {
      [`${targetDirectory}/${serviceDirectory}/${ACCESS_FILENAME}`]: "'https://fabrikam@dev.azure.com/someorg/someproject/_git/fabrikam2019': ACCESS_TOKEN_SECRET",
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
    const accessYaml: AccessYaml = {};
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

  it("if an access.yaml already exists, it should update access.yaml in the filepath, but not overwrite anything that exists.", () => {
    const mockFsOptions = {
      [`${targetDirectory}/${serviceDirectory}/${ACCESS_FILENAME}`]: "'https://fabrikam@dev.azure.com/someorg/someproject/_git/fabrikam2019': MY_CUSTOM_SECRET",
    };
    mockFs(mockFsOptions);

    const absTargetPath = path.resolve(
      path.join(targetDirectory, serviceDirectory)
    );
    const expectedFilePath = path.join(absTargetPath, ACCESS_FILENAME);
    const gitRepoUrl =
      "https://fabrikam@dev.azure.com/someorg/someproject/_git/fabrikam2019";

    const accessYaml: AccessYaml = {};
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
  const appendSpy = jest.spyOn(fs, "appendFileSync");

  beforeEach(() => {
    mockFs({
      "app-repository": {
        "my-service": {},
      },
    });
  });

  afterEach(() => {
    mockFs.restore();
    jest.clearAllMocks();
  });

  it("should not do anything if build-update-hld.yaml exists", () => {
    const mockFsOptions = {
      [`${targetDirectory}/${serviceDirectory}/${SERVICE_PIPELINE_FILENAME}`]: "existing pipeline",
    };
    mockFs(mockFsOptions);

    generateServiceBuildAndUpdatePipelineYaml(
      targetDirectory,
      [],
      "my-service",
      path.join(targetDirectory, serviceDirectory),
      [],
      [],
      []
    );
    expect(writeSpy).not.toBeCalled();
  });

  it("should generate the build-update-hld.yaml if one does not exist", () => {
    const absTargetPath = path.resolve(targetDirectory);
    const expectedFilePath = `${absTargetPath}/${serviceDirectory}/${SERVICE_PIPELINE_FILENAME}`;

    generateServiceBuildAndUpdatePipelineYaml(
      targetDirectory,
      [],
      "my-service",
      path.join(targetDirectory, serviceDirectory),
      [],
      [],
      []
    );

    expect(writeSpy).toBeCalledWith(
      expectedFilePath,
      `${getVersionMessage()}\n`,
      "utf8"
    );
    expect(appendSpy).toBeCalledWith(
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

  it("generating a build pipeline with rings and service build variables", () => {
    const absTargetPath = path.resolve(targetDirectory);
    const expectedFilePath = `${absTargetPath}/${serviceDirectory}/${SERVICE_PIPELINE_FILENAME}`;

    generateServiceBuildAndUpdatePipelineYaml(
      targetDirectory,
      ["master", "stage"],
      "my-service",
      path.join(targetDirectory, serviceDirectory),
      [],
      ["my-build-vg"],
      ["VAR1,VAR2"]
    );

    expect(writeSpy).toBeCalledWith(
      expectedFilePath,
      `${getVersionMessage()}\n`,
      "utf8"
    );
    expect(appendSpy).toBeCalledWith(
      expectedFilePath,
      createTestServiceBuildAndUpdatePipelineYaml(
        true,
        "my-service",
        "./my-service",
        ["master", "stage"],
        ["my-build-vg"],
        ["VAR1,VAR2"]
      ),
      "utf8"
    );
    expect(writeSpy).toBeCalled();
  });

  test("no path trigger injected when the path is the project root (is: ./)", () => {
    const serviceYaml = serviceBuildAndUpdatePipeline("my-service", "./", [
      "master",
    ]);
    expect(serviceYaml?.trigger?.paths).toBeUndefined();
    expect(serviceYaml.trigger).toStrictEqual({
      branches: { include: ["master"] },
    });
  });

  test("path trigger is injected when the path is not the root of the project (not: ./)", () => {
    for (const p of ["my-service", "foo/bar/baz"]) {
      const serviceYaml = serviceBuildAndUpdatePipeline("my-service", p, [
        "master",
      ]);
      expect(serviceYaml?.trigger?.paths).toStrictEqual({
        include: [p],
        exclude: [BEDROCK_FILENAME],
      });
    }
    const yamlWithNoDot = serviceBuildAndUpdatePipeline(
      "my-service",
      "another-service",
      ["master"]
    );
    expect(yamlWithNoDot?.trigger?.paths).toStrictEqual({
      include: ["another-service"],
      exclude: [BEDROCK_FILENAME],
    });
  });
});

describe("updateTriggerBranchesForServiceBuildAndUpdatePipeline", () => {
  const targetDirectory = "app-repository";
  const serviceDirectory = "my-service";
  const writeSpy = jest.spyOn(fs, "writeFileSync");
  const appendSpy = jest.spyOn(fs, "appendFileSync");

  beforeEach(() => {
    mockFs({
      "app-repository": {
        "my-service": {},
      },
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it("should throw an error if build-update-hld.yaml does not exist", () => {
    const mockFsOptions = {};
    mockFs(mockFsOptions);

    try {
      updateTriggerBranchesForServiceBuildAndUpdatePipeline(
        ["master", "new-ring"],
        path.join(targetDirectory, serviceDirectory)
      );
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e).not.toBeNull();
    }
    expect(writeSpy).not.toBeCalled();
  });

  it("if a pipeline file already exists, it should update with the passed trigger branches (rings)", () => {
    const existingPipelineAsString = createTestServiceBuildAndUpdatePipelineYaml(
      true
    );
    const mockFsOptions = {
      [`${targetDirectory}/${serviceDirectory}/${SERVICE_PIPELINE_FILENAME}`]: Buffer.from(
        existingPipelineAsString
      ),
    };
    mockFs(mockFsOptions);

    const newRings = ["master", "new-ring"];

    try {
      updateTriggerBranchesForServiceBuildAndUpdatePipeline(
        newRings,
        path.join(targetDirectory, serviceDirectory)
      );
    } catch (e) {
      expect(true).toBe(false); // Should not reach here
    }

    const absTargetPath = path.resolve(targetDirectory);
    const expectedFilePath = path.join(
      absTargetPath,
      serviceDirectory,
      SERVICE_PIPELINE_FILENAME
    );

    expect(writeSpy).toBeCalledWith(
      expectedFilePath,
      `${getVersionMessage()}\n`,
      "utf8"
    );
    expect(appendSpy).toBeCalledWith(
      expectedFilePath,
      createTestServiceBuildAndUpdatePipelineYaml(
        true,
        undefined,
        undefined,
        newRings,
        undefined
      ),
      "utf8"
    );
    expect(writeSpy).toBeCalled();
  });
});

describe("generateHldLifecyclePipelineYaml", () => {
  const targetDirectory = "app-repository";
  const writeSpy = jest.spyOn(fs, "writeFileSync");
  const appendSpy = jest.spyOn(fs, "appendFileSync");

  beforeEach(() => {
    mockFs({
      "app-repository": {},
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it("should not do anything if hld-lifecycle.yaml exists", () => {
    const mockFsOptions = {
      [`${targetDirectory}/${PROJECT_PIPELINE_FILENAME}`]: "existing pipeline",
    };
    mockFs(mockFsOptions);

    generateHldLifecyclePipelineYaml(targetDirectory);
    expect(writeSpy).not.toBeCalled();
  });

  it("should generate the hld-lifecycle.yaml if one does not exist", () => {
    const expectedFilePath = `${targetDirectory}/${PROJECT_PIPELINE_FILENAME}`;

    generateHldLifecyclePipelineYaml(targetDirectory);
    expect(writeSpy).toBeCalledWith(
      expectedFilePath,
      `${getVersionMessage()}\n`,
      "utf8"
    );
    expect(appendSpy).toBeCalledWith(
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
  const appendSpy = jest.spyOn(fs, "appendFileSync");

  beforeEach(() => {
    mockFs({
      "hld-repository": {},
    });
  });
  afterEach(() => {
    mockFs.restore();
  });

  it("should not do anything if file exist", () => {
    const mockFsOptions = {
      [`${targetDirectory}/${RENDER_HLD_PIPELINE_FILENAME}`]: "existing pipeline",
    };
    mockFs(mockFsOptions);

    generateHldAzurePipelinesYaml(targetDirectory);
    expect(writeSpy).not.toBeCalled();
  });

  it("should generate the file if one does not exist", () => {
    const absTargetPath = path.resolve(targetDirectory);
    const expectedFilePath = `${absTargetPath}/${RENDER_HLD_PIPELINE_FILENAME}`;

    generateHldAzurePipelinesYaml(targetDirectory);
    expect(writeSpy).toBeCalledWith(
      expectedFilePath,
      `${getVersionMessage()}\n`,
      "utf8"
    );
    expect(appendSpy).toBeCalledWith(
      expectedFilePath,
      createTestHldAzurePipelinesYaml(),
      "utf8"
    );
    expect(writeSpy).toBeCalled();
  });
});

describe("appendVariableGroupToHldAzurePipelinesYaml", () => {
  const targetDirectory = "hld-repository";
  const writeSpy = jest.spyOn(fs, "writeFileSync");
  const appendSpy = jest.spyOn(fs, "appendFileSync");
  beforeEach(() => {
    mockFs({
      "hld-repository": {},
    });
  });
  afterEach(() => {
    mockFs.restore();
  });
  it("should append a variable group", () => {
    const absTargetPath = path.resolve(targetDirectory);
    const expectedFilePath = `${absTargetPath}/${RENDER_HLD_PIPELINE_FILENAME}`;

    const mockFsOptions = {
      [`${targetDirectory}/${RENDER_HLD_PIPELINE_FILENAME}`]: createTestHldAzurePipelinesYaml() as string,
    };
    mockFs(mockFsOptions);

    appendVariableGroupToPipelineYaml(
      absTargetPath,
      RENDER_HLD_PIPELINE_FILENAME,
      "my-vg"
    );
    expect(writeSpy).toBeCalledWith(
      expectedFilePath,
      `${getVersionMessage()}\n`,
      "utf8"
    );
    expect(appendSpy).toBeCalledWith(
      expectedFilePath,
      createTestHldAzurePipelinesYamlWithVariableGroup()
    );
  });
  it("negative test", () => {
    try {
      appendVariableGroupToPipelineYaml(
        uuid(),
        RENDER_HLD_PIPELINE_FILENAME,
        "my-vg"
      );
    } catch (err) {
      expect(err.errorCode).toBe(errorStatusCode.FILE_IO_ERR);
    }
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
      "hld-repository": {},
    });
  });
  afterEach(() => {
    mockFs.restore();
  });

  it("should not do anything if file exist", () => {
    const mockFsOptions = {
      [`${targetDirectory}/component.yaml`]: "existing component",
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

  it("should generate the file if one does not exist", () => {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "maintainers.yaml": createTestMaintainersYaml() as any,
    });
  });

  afterAll(() => {
    mockFs.restore();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should update existing maintainers.yml with new service maintainers", () => {
    const maintainersFilePath = "maintainers.yaml";

    const servicePath = "packages/my-new-service";
    const newUser = {
      email: "hello@example.com",
      name: "testUser",
    };

    const writeSpy = jest.spyOn(fs, "writeFileSync");
    addNewServiceToMaintainersFile(maintainersFilePath, servicePath, [newUser]);

    const defaultMaintainersFileObject = createTestMaintainersYaml(false);

    const expected: MaintainersFile = {
      services: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((defaultMaintainersFileObject as any) as MaintainersFile).services,
        ["./" + servicePath]: {
          maintainers: [newUser],
        },
      },
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
      "my-new-service": {},
    });
  });
  afterEach(() => {
    mockFs.restore();
  });

  const content = "hello world";

  it("should not do anything if file exist", () => {
    const mockFsOptions = {
      [`${targetDirectory}/.gitignore`]: "foobar",
    };
    mockFs(mockFsOptions);

    const writeSpy = jest.spyOn(fs, "writeFileSync");
    generateGitIgnoreFile(targetDirectory, content);
    expect(writeSpy).not.toBeCalled();
  });

  it("should generate the file if one does not exist", () => {
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
      "my-new-service": {},
    });
  });
  afterEach(() => {
    mockFs.restore();
  });

  it("should not do anything if file exist", () => {
    const mockFsOptions = {
      [`${targetDirectory}/Dockerfile`]: "hello!!!!",
    };
    mockFs(mockFsOptions);

    const writeSpy = jest.spyOn(fs, "writeFileSync");
    generateDockerfile(targetDirectory);
    expect(writeSpy).not.toBeCalled();
  });

  it("should generate the file if one does not exist", () => {
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

  test("that the value of the file is the same after (de)serialization", () => {
    const serviceName = "mycoolservice";
    const servicePath = "./mycoolservice";
    const ringBranches = ["master", "qa", "test"];
    const variableGroups = ["foo", "bar"];
    const buildPipelineYaml = serviceBuildAndUpdatePipeline(
      serviceName,
      servicePath,
      ringBranches,
      variableGroups
    );
    const serializedYaml = yaml.safeDump(buildPipelineYaml, {
      lineWidth: Number.MAX_SAFE_INTEGER,
    });
    const pipelinesPath = path.join(randomDirPath, SERVICE_PIPELINE_FILENAME);
    fs.writeFileSync(pipelinesPath, serializedYaml);
    const deserializedYaml = yaml.safeLoad(
      fs.readFileSync(pipelinesPath, "utf8")
    );

    // should be equal to the initial value
    expect(deserializedYaml).toStrictEqual(buildPipelineYaml);

    // variables should include all groups
    expect(buildPipelineYaml.variables).toBeDefined();
    if (buildPipelineYaml.variables) {
      expect(buildPipelineYaml.variables.length).toBe(variableGroups.length);

      for (const group of variableGroups) {
        expect(buildPipelineYaml.variables.includes({ group }));
      }
    }

    // trigger branches should include all ring branches
    expect(buildPipelineYaml.trigger).toBeDefined();
    if (buildPipelineYaml.trigger) {
      expect(buildPipelineYaml.trigger.branches).toBeDefined();

      if (buildPipelineYaml.trigger.branches) {
        expect(buildPipelineYaml.trigger.branches.include).toBeDefined();

        if (buildPipelineYaml.trigger.branches.include) {
          expect(buildPipelineYaml.trigger.branches.include.length).toBe(
            ringBranches.length
          );
          for (const branch of ringBranches) {
            expect(buildPipelineYaml.trigger.branches.include.includes(branch));
          }
        }
      }
    }

    // verify components of stages
    expect(buildPipelineYaml.stages).toBeDefined();
    if (buildPipelineYaml.stages) {
      expect(buildPipelineYaml.stages && buildPipelineYaml.stages.length === 2);
      for (const stage of buildPipelineYaml.stages) {
        for (const job of stage.jobs) {
          expect(job.pool).toBeDefined();

          if (job.pool) {
            // pool.vmImage should be 'gentoo'
            expect(job.pool.vmImage).toBe(VM_IMAGE);
            expect(job.steps);
          }
        }
      }
    }
  });

  test("that all services receive an build-update-hld-pipeline.yaml with the correct paths and variable groups have been inserted", async () => {
    // Create service directories
    const serviceReferences = ["serviceA", "serviceB", "serviceC"].map(
      (serviceName) => {
        const servicePath = path.join(randomDirPath, "packages", serviceName);
        shelljs.mkdir("-p", servicePath);
        return { serviceName, servicePath };
      }
    );

    const ringBranches = ["master", "qa", "test"];
    const variableGroups = [uuid(), uuid()];

    for (const serviceReference of serviceReferences) {
      generateServiceBuildAndUpdatePipelineYaml(
        randomDirPath,
        ringBranches,
        serviceReference.serviceName,
        serviceReference.servicePath,
        variableGroups,
        [],
        []
      );

      // file should exist
      expect(fs.existsSync(serviceReference.servicePath)).toBe(true);

      // pipeline triggers should include the relative path to the service
      const azureYaml: AzurePipelinesYaml = yaml.safeLoad(
        fs.readFileSync(
          path.join(serviceReference.servicePath, SERVICE_PIPELINE_FILENAME),
          "utf8"
        )
      );

      expect(azureYaml.trigger).toBeDefined();

      if (azureYaml.trigger) {
        expect(azureYaml.trigger.paths).toBeDefined();

        if (azureYaml.trigger.paths) {
          expect(azureYaml.trigger.paths.include).toBeDefined();

          if (azureYaml.trigger.paths.include) {
            const hasCorrectIncludes = azureYaml.trigger.paths.include.includes(
              path.relative(randomDirPath, serviceReference.servicePath)
            );
            expect(hasCorrectIncludes).toBe(true);
          }
        }
      }

      expect(azureYaml.variables).toBeDefined();

      if (azureYaml.variables) {
        let hasCorrectVariableGroup1 = false;
        let hasCorrectVariableGroup2 = false;
        for (const value of Object.values(azureYaml.variables)) {
          const item = value as { group: string };

          if (item.group === variableGroups[0]) {
            hasCorrectVariableGroup1 = true;
          }

          if (item.group === variableGroups[1]) {
            hasCorrectVariableGroup2 = true;
          }
        }

        expect(hasCorrectVariableGroup1).toBe(true);
        expect(hasCorrectVariableGroup2).toBe(true);
      }
    }
  });
});

describe("generateYamlScript", () => {
  test("'set -e' is injected as the first line", () => {
    const generated = generateYamlScript(["foo", "bar", "baz"]);
    expect(generated.startsWith("set -e\n")).toBe(true);
  });
});

describe("sanitizeTriggerPath", () => {
  const tests: {
    name: string;
    expected: ReturnType<typeof sanitizeTriggerPath>;
    actual: ReturnType<typeof sanitizeTriggerPath>;
  }[] = [
    {
      name: "removes ./ when present",
      expected: "foo/bar",
      actual: sanitizeTriggerPath("./foo/bar"),
    },
    {
      name: "should only remove one slash",
      expected: "/foo/bar",
      actual: sanitizeTriggerPath(".//foo/bar"),
    },
    {
      name: "does nothing if not starting with ./",
      expected: "foo/bar",
      actual: sanitizeTriggerPath("foo/bar"),
    },
    {
      name: "dot is escaped",
      expected: "a/foo/bar",
      actual: sanitizeTriggerPath("a/foo/bar"),
    },
  ];

  for (const { name, expected, actual } of tests) {
    test(name, () => {
      expect(actual).toBe(expected);
    });
  }
});
