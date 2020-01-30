jest.mock("./generate");

import fs from "fs";
import path from "path";
import uuid = require("uuid");
import {
  createTempDir,
  getMissingFilenames,
  isDirEmpty,
  removeDir
} from "../../lib/ioUtil";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { validateRemoteSource } from "./generate";
import {
  BACKEND_TFVARS,
  constructSource,
  DEFINITION_YAML,
  execute,
  generateClusterDefinition,
  ICommandOptions,
  parseVariablesTf,
  removeTemplateFiles,
  validateBackendTfvars,
  validateValues,
  validateVariablesTf,
  VARIABLES_TF
} from "./scaffold";

const mockYaml = {
  azure_devops: {
    access_token: "token123",
    infra_repository: "repoABC"
  }
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
    otherFiles.forEach(f => {
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
          version: uuid()
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
          version: uuid()
        }
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toBe("Value for source is missing.");
    }
  });
  it("name, template, version is missing", () => {
    ["name", "template", "version"].forEach(key => {
      try {
        validateValues(
          {},
          {
            name: key === "name" ? "" : uuid(),
            source: "http://example@host",
            template: key === "template" ? "" : uuid(),
            version: key === "version" ? "" : uuid()
          }
        );
        expect(true).toBe(false);
      } catch (err) {
        expect(err.message).toBe(
          "Values for name, version and/or 'template are missing."
        );
      }
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
  const EMPTY_VALS: ICommandOptions = {
    name: "",
    source: "",
    template: "",
    version: ""
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
    (validateRemoteSource as jest.Mock).mockReturnValue(true);
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
});

describe("Validate parsing of sample variables.tf file", () => {
  test("Validate that a variables.tf sample can be parsed into an object", async () => {
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
  test("Validate that a valid scaffold definition object is generated", async () => {
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
        version: "v1.0.0"
      },
      backendTfVars,
      sampleVarTf
    );
    expect(def.name).toBe("test-scaffold");

    const variables = def.variables as { [key: string]: string };
    expect(variables.resource_group_name).toBe("<insert value>");

    const backend = def.backend as { [key: string]: string };
    expect(backend.key).toBe("tfstate-azure-simple");
  });
});
