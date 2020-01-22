jest.mock("./generate");

import uuid = require("uuid");
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { validateRemoteSource } from "./generate";
import {
  constructSource,
  execute,
  generateClusterDefinition,
  parseVariablesTf,
  validateValues
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

describe("test validate function", () => {
  it("empty config yaml", () => {
    const result = validateValues(
      {},
      {
        name: uuid(),
        source: "http://example@host",
        template: uuid(),
        version: uuid()
      }
    );
    expect(result).toBe(true); // because source if defined
  });
  it("empty config yaml and source is missing", () => {
    const result = validateValues(
      {},
      {
        name: uuid(),
        template: uuid(),
        version: uuid()
      }
    );
    expect(result).toBe(false); // because source if defined
  });
});

describe("test constructSource function", () => {
  it("validate result", () => {
    const source = constructSource(mockYaml);
    expect(source).toBe("https://spk:token123@repoABC");
  });
});

describe("test execute function", () => {
  it("missing config yaml", async () => {
    const exitFn = jest.fn();
    await execute({}, {}, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("missing opt ", async () => {
    (validateRemoteSource as jest.Mock).mockReturnValue(true);
    const exitFn = jest.fn();
    await execute(mockYaml, {}, exitFn);
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
    const def = await generateClusterDefinition(
      "test-scaffold",
      "https://github.com/microsoft/bedrock",
      "cluster/environments/azure-simple",
      "v1.0.0",
      backendTfVars,
      sampleVarTf
    );
    expect(def.name).toBe("test-scaffold");
    expect(def.variables.resource_group_name).toBe("<insert value>");
    expect(def.backend.key).toBe("tfstate-azure-simple");
  });
});
