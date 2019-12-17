import fs, { chmod } from "fs";
import path from "path";
import { loadConfigurationFromLocalEnv, readYaml } from "../../config";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { IInfraConfigYaml } from "../../types";
import {
  generateTfvars,
  parseDefinitionYaml,
  validateDefinition,
  validateTemplateSource
} from "./generate";

beforeAll(() => {
  enableVerboseLogging();
  jest.setTimeout(10000);
});

afterAll(() => {
  disableVerboseLogging();
  jest.setTimeout(5000);
});

describe("Validate test project folder contains a definition.yaml", () => {
  test("Validating test project folder contains a definition.yaml file", async () => {
    const mockProjectPath = "src/commands/infra/mocks";
    expect(await validateDefinition(mockProjectPath)).toBe(true);
  });
});

describe("Validate test project folder does not contains a definition.yaml", () => {
  test("Validating that a provided project folder does not contain a definition.yaml", async () => {
    const mockProjectPath = "src/commands/infra";
    expect(await validateDefinition(mockProjectPath)).toBe(false);
  });
});

describe("Validate definition.yaml contains a source", () => {
  test("Validating that a provided project folder  contains a source in definition.yaml", async () => {
    const mockProjectPath = "src/commands/infra/mocks";
    const data = readYaml<IInfraConfigYaml>(
      path.join(mockProjectPath, `definition.yaml`)
    );
    const infraConfig = loadConfigurationFromLocalEnv(data);
    const expectedArray = [
      infraConfig.source,
      infraConfig.template,
      infraConfig.version
    ];
    const returnArray = await validateTemplateSource(
      path.join(mockProjectPath, `definition.yaml`)
    );
    expect(returnArray).toEqual(expectedArray);
  });
});

// Work in progress. Could be used in Integration Testing...
/* describe("Validate cloning of a remote repo from source", () => {
  test("Validating that a provided project source remote repo is initially cloned into .spk/templates", async () => {
    const mockProjectPath = "src/commands/infra/mocks";
    const rootDef = path.join(mockProjectPath, "definition.json");
    const data: string = fs.readFileSync(rootDef, "utf8");
    const definitionJSON = JSON.parse(data);
    const testValues = [
      definitionJSON.source,
      definitionJSON.template,
      definitionJSON.version
    ];
    expect(await validateRemoteSource(testValues)).toBe(true);
    // Need improved tests to check cloned repo
  });
}); */

describe("Validate template path from a definition.yaml", () => {
  test("Validating that generate can extract a path from a definition.yaml file", async () => {
    const mockProjectPath = "src/commands/infra/mocks";
    const templatePath = await parseDefinitionYaml(mockProjectPath);
    expect(templatePath).toContain(
      "_microsoft_bedrock_git/cluster/environments/azure-single-keyvault"
    );
  });
});

describe("Validate spk.tfvars file", () => {
  test("Validating that a spk.tfvars is generated and has appropriate format", async () => {
    const mockProjectPath = "src/commands/infra/mocks";
    const data = readYaml<IInfraConfigYaml>(
      path.join(mockProjectPath, `definition.yaml`)
    );
    const infraConfig = loadConfigurationFromLocalEnv(data);
    const spkTfvarsObject = await generateTfvars(infraConfig.variables);
    expect(spkTfvarsObject).toContain('gitops_poll_interval = "5m"');
  });
});

describe("Validate backend.tfvars file", () => {
  test("Validating that a backend.tfvars is generated and has appropriate format", async () => {
    const mockProjectPath = "src/commands/infra/mocks";
    const data = readYaml<IInfraConfigYaml>(
      path.join(mockProjectPath, `definition.yaml`)
    );
    const infraConfig = loadConfigurationFromLocalEnv(data);
    const backendTfvarsObject = await generateTfvars(infraConfig.backend);
    expect(backendTfvarsObject).toContain(
      'storage_account_name = "storage-account-name"'
    );
  });
});
