import fs, { chmod } from "fs";
import path from "path";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import {
  generateSpkTfvars,
  parseDefinitionJson,
  readDefinitionJson,
  validateDefinition,
  validateRemoteSource,
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

describe("Validate test project folder contains a definition.json", () => {
  test("Validating test project folder contains a definition.json file", async () => {
    const mockProjectPath = "src/commands/infra/mocks";
    expect(await validateDefinition(mockProjectPath)).toBe(true);
  });
});

describe("Validate test project folder does not contains a definition.json", () => {
  test("Validating that a provided project folder does not contain a definition.json", async () => {
    const mockProjectPath = "src/commands/infra";
    expect(await validateDefinition(mockProjectPath)).toBe(false);
  });
});

describe("Validate definition.json contains a source", () => {
  test("Validating that a provided project folder  contains a source in definition.json", async () => {
    const mockProjectPath = "src/commands/infra/mocks";
    const rootDef = path.join(mockProjectPath, "definition.json");
    const data: string = fs.readFileSync(rootDef, "utf8");
    const definitionJSON = JSON.parse(data);
    const expectedArray = [
      definitionJSON.source,
      definitionJSON.template,
      definitionJSON.version
    ];
    const returnArray = await validateTemplateSource(mockProjectPath);
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

describe("Validate template path from a definition.json", () => {
  test("Validating that generate can extract a path from a definition.json file", async () => {
    const mockProjectPath = "src/commands/infra/mocks";
    const templatePath = await parseDefinitionJson(mockProjectPath);
    expect(templatePath).toContain(
      "_microsoft_bedrock_git/cluster/environments/azure-single-keyvault"
    );
  });
});

describe("Validate spk.tfvars file", () => {
  test("Validating that a spk.tfvars is generated and has appropriate format", async () => {
    const mockProjectPath = "src/commands/infra/mocks";
    const definitionJSON = await readDefinitionJson(mockProjectPath);
    const spkTfvarsObject = await generateSpkTfvars(definitionJSON);
    expect(spkTfvarsObject).toContain('gitops_poll_interval = "5m"');
  });
});
