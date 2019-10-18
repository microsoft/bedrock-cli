import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import {
  generateClusterDefinition,
  parseVariablesTf,
  scaffoldHcl
} from "./scaffold";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
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
    const def = generateClusterDefinition(
      "test-scaffold",
      "https://github.com/microsoft/bedrock",
      "cluster/environments/azure-simple",
      "v1.0.0",
      sampleVarTf
    );
    expect(def.name).toBe("test-scaffold");
    expect(def.variables.resource_group_name).toBe("<insert value>");
  });
});

describe("Validate generation of a valid cluster HCL file", () => {
  test("Validate that a variables.tf sample can be parsed and translated to an HCL file", async () => {
    const mockFileName = "src/commands/mocks/azure-simple";
    const sampleVarTf = "src/commands/mocks/azure-simple/variables.tf";
    const value = await scaffoldHcl(mockFileName, sampleVarTf);
    expect(value).toBe(true);
  });
});

describe("Failure testing for generation of a valid cluster HCL file", () => {
  test("Mocked a failed scenario of HCL generation", async () => {
    const mockFileName = "src/commands/mocks/azure-simple";
    const sampleVarTf = "src/commands/mocks/azure-simple";
    const value = await scaffoldHcl(mockFileName, sampleVarTf);
    expect(value).toBe(false);
  });
});
