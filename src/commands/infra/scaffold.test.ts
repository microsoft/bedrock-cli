jest.mock("./generate");

import fs from "fs";
import path from "path";
import uuid from "uuid";
import {
  createTempDir,
  getMissingFilenames,
  isDirEmpty,
} from "../../lib/ioUtil";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { validateRemoteSource } from "./generate";
import * as generate from "./generate";
import {
  BACKEND_TFVARS,
  DEFAULT_VAR_VALUE,
  DEFINITION_YAML,
  TERRAFORM_TFVARS,
  VARIABLES_TF,
} from "./infra_common";
import * as infraCommon from "./infra_common";
import {
  constructSource,
  copyTfTemplate,
  execute,
  generateClusterDefinition,
  CommandOptions,
  parseVariablesTf,
  removeTemplateFiles,
  validateBackendTfvars,
  validateValues,
  validateVariablesTf,
} from "./scaffold";
import * as scaffold from "./scaffold";

const mockYaml = {
  azure_devops: {
    access_token: "token123",
    infra_repository: "repoABC",
  },
};

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("test validateVariablesTf function", () => {
  it("positive test", () => {
    const dir = createTempDir();
    const location = path.join(dir, VARIABLES_TF);
    fs.writeFileSync(location, "test");
    validateVariablesTf(location); // no exception thrown
  });
  it("negative test", () => {
    const dir = createTempDir();
    const location = path.join(dir, VARIABLES_TF);
    try {
      validateVariablesTf(location);
      expect(true).toBe(false);
    } catch (_) {
      // exception throw
    }
  });
});

describe("test validateBackendTfvars function", () => {
  it("positive test", () => {
    const dir = createTempDir();
    const location = path.join(dir, BACKEND_TFVARS);
    fs.writeFileSync(location, "test");
    expect(validateBackendTfvars(dir)).toBe(true);
  });
  it("negative test", () => {
    const dir = createTempDir();
    expect(validateBackendTfvars(dir)).toBe(false);
  });
});

const testCopyTfTemplateFn = async (generation: boolean): Promise<void> => {
  const source = createTempDir();
  fs.writeFileSync(path.join(source, "hello"), "hello");
  fs.writeFileSync(path.join(source, TERRAFORM_TFVARS), TERRAFORM_TFVARS);
  fs.writeFileSync(path.join(source, BACKEND_TFVARS), BACKEND_TFVARS);
  const target = createTempDir();
  await copyTfTemplate(source, target, generation);
  expect(fs.existsSync(path.join(target, "hello"))).toBe(true);

  if (generation) {
    expect(fs.existsSync(path.join(target, TERRAFORM_TFVARS))).toBe(false);
    expect(fs.existsSync(path.join(target, BACKEND_TFVARS))).toBe(false);
  } else {
    expect(fs.existsSync(path.join(target, TERRAFORM_TFVARS))).toBe(false);
  }
};

describe("test copyTfTemplate function", () => {
  it("positive test: generation = true", async () => {
    await testCopyTfTemplateFn(true);
  });
  it("positive test: generation = false", async () => {
    await testCopyTfTemplateFn(false);
  });
});

describe("test removeTemplateFiles function", () => {
  it("directory that does not exist", () => {
    removeTemplateFiles(uuid());
    // no exception thrown if directory does not exist.
    // nothing to remove.
  });
  it("empty directory", () => {
    const dir = createTempDir();
    removeTemplateFiles(dir);
    expect(isDirEmpty(dir)).toBe(true);
  });
  it(`only have ${DEFINITION_YAML} in the directory`, () => {
    const dir = createTempDir();
    fs.writeFileSync(path.join(dir, DEFINITION_YAML), "test");
    removeTemplateFiles(dir);
    expect(isDirEmpty(dir)).toBe(false);
    expect(getMissingFilenames(dir, [DEFINITION_YAML])).toEqual([]);
  });
  it(`have ${DEFINITION_YAML} and other files in the directory`, () => {
    const dir = createTempDir();
    fs.writeFileSync(path.join(dir, DEFINITION_YAML), "test");

    const otherFiles = ["file1.txt", "file2.txt"];
    otherFiles.forEach((f) => {
      fs.writeFileSync(path.join(dir, `${f}.txt`), f);
    });
    removeTemplateFiles(dir);
    expect(isDirEmpty(dir)).toBe(false);
    expect(
      getMissingFilenames(dir, [DEFINITION_YAML, "file1.txt", "file2.txt"])
    ).toEqual(otherFiles);
  });
});

describe("test validate function", () => {
  it("empty config yaml", () => {
    try {
      validateValues(
        {},
        {
          name: uuid(),
          source: "http://example@host",
          template: uuid(),
          version: uuid(),
        }
      );
    } catch (err) {
      // no exception thrown because source if defined
      expect(true).toBe(false);
    }
  });
  it("empty config yaml and source is missing", () => {
    try {
      validateValues(
        {},
        {
          name: uuid(),
          source: "",
          template: uuid(),
          version: uuid(),
        }
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err.errorCode).toBe(1001);
    }
  });
  it("name, template, version is missing", () => {
    ["name", "template", "version"].forEach((key) => {
      expect(() => {
        validateValues(
          {},
          {
            name: key === "name" ? "" : uuid(),
            source: "http://example@host",
            template: key === "template" ? "" : uuid(),
            version: key === "version" ? "" : uuid(),
          }
        );
      }).toThrow();
    });
  });
});

describe("test constructSource function", () => {
  it("validate result", () => {
    const source = constructSource(mockYaml);
    expect(source).toBe("https://spk:token123@repoABC");
  });
});

describe("test execute function", () => {
  const EMPTY_VALS: CommandOptions = {
    name: "",
    source: "",
    template: "",
    version: "",
  };
  const MOCKED_VALS: CommandOptions = {
    name: "name",
    source: "source",
    template: "template",
    version: "0.1",
  };
  it("missing config yaml", async () => {
    const exitFn = jest.fn();
    try {
      await execute({}, EMPTY_VALS, exitFn);
    } catch (_) {
      // expected exception
    }
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("missing opt ", async () => {
    (validateRemoteSource as jest.Mock).mockReturnValueOnce(true);
    const exitFn = jest.fn();
    try {
      await execute(mockYaml, EMPTY_VALS, exitFn);
      expect(true).toBe(false);
    } catch (_) {
      // expected exception
    }
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("positive test", async () => {
    (validateRemoteSource as jest.Mock).mockReturnValueOnce(true);
    jest
      .spyOn(infraCommon, "getSourceFolderNameFromURL")
      .mockReturnValueOnce("sourceFolder");
    jest
      .spyOn(generate, "validateRemoteSource")
      .mockReturnValueOnce(Promise.resolve());
    jest
      .spyOn(scaffold, "copyTfTemplate")
      .mockReturnValueOnce(Promise.resolve());
    jest.spyOn(scaffold, "validateVariablesTf").mockReturnValueOnce();
    jest.spyOn(scaffold, "scaffold").mockReturnValueOnce();
    jest.spyOn(scaffold, "removeTemplateFiles").mockReturnValueOnce();

    const exitFn = jest.fn();
    await execute(mockYaml, MOCKED_VALS, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
});

describe("Validate parsing of sample variables.tf file", () => {
  test("Validate that a variables.tf sample can be parsed into an object", () => {
    const sampleVarTf =
      'variable "resource_group_name" { \n' +
      '   type = "string"\n' +
      "} \n" +
      "\n" +
      'variable "service_principal_secret" { \n' +
      '    type = "string"\n' +
      "} \n" +
      "\n" +
      'variable "gitops_poll_interval" { \n' +
      '   type    = "string"\n' +
      '    default = "5m"\n' +
      "} \n";
    const fields: { [name: string]: string | null } = parseVariablesTf(
      sampleVarTf
    );
    expect(Object.keys(fields).length).toBe(3);
    expect(fields.resource_group_name).toBe("");
    expect(fields.gitops_poll_interval).toBe("5m");
  });
});

describe("Validate generation of sample scaffold definition", () => {
  test("Validate that a valid scaffold definition object is generated", () => {
    const sampleVarTf =
      'variable "resource_group_name" { \n' +
      '   type = "string"\n' +
      "} \n" +
      "\n" +
      'variable "service_principal_secret" { \n' +
      '    type = "string"\n' +
      "} \n" +
      "\n" +
      'variable "gitops_poll_interval" { \n' +
      '   type    = "string"\n' +
      '    default = "5m"\n' +
      "} \n";
    const backendTfVars =
      'storage_account_name="<storage account name>"\n' +
      'access_key="<storage access key>"\n' +
      'container_name="<storage account container>"\n' +
      'key="tfstate-azure-simple"\n';
    const def = generateClusterDefinition(
      {
        name: "test-scaffold",
        source: "https://github.com/microsoft/bedrock",
        template: "cluster/environments/azure-simple",
        version: "v1.0.0",
      },
      backendTfVars,
      sampleVarTf
    );
    expect(def.name).toBe("test-scaffold");

    const variables = def.variables as { [key: string]: string };
    expect(variables.resource_group_name).toBe(DEFAULT_VAR_VALUE);

    const backend = def.backend as { [key: string]: string };
    expect(backend.key).toBe("tfstate-azure-simple");
  });
});
