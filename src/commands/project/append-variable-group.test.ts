import {
  execute,
  CommandOptions,
  validateValues,
} from "./append-variable-group";
import * as appendVariableGrp from "./append-variable-group";
import * as fileutils from "../../lib/fileutils";
import { createTestBedrockYaml } from "../../test/mockFactory";
import * as config from "../../config";
import { BedrockFile } from "../../types";
import { ConfigValues } from "./pipeline";
import * as bedrockYaml from "../../lib/bedrockYaml";
import * as variableGrp from "../../lib/pipelines/variableGroup";
import { deepClone } from "../../lib/util";

const mockValues: CommandOptions = {
  devopsProject: "azDoProject",
  orgName: "orgName",
  personalAccessToken: "PAT",
};

describe("Test execute function", () => {
  it("missing variable group name", async () => {
    const exitFn = jest.fn();
    await execute("my-path", "", mockValues, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("variable group does not exist", async () => {
    const exitFn = jest.fn();
    spyOn(fileutils, "appendVariableGroupToPipelineYaml");
    jest
      .spyOn(variableGrp, "hasVariableGroup")
      .mockReturnValueOnce(Promise.resolve(false));

    const bedrockFile = createTestBedrockYaml(false) as BedrockFile;

    jest.spyOn(config, "Bedrock").mockReturnValue(bedrockFile as BedrockFile);
    jest.spyOn(appendVariableGrp, "checkDependencies").mockReturnValueOnce();
    jest
      .spyOn(appendVariableGrp, "validateValues")
      .mockReturnValueOnce(mockValues as ConfigValues);
    jest.spyOn(bedrockYaml, "addVariableGroup").mockReturnValue();
    jest
      .spyOn(fileutils, "appendVariableGroupToPipelineYaml")
      .mockReturnValue();

    expect(bedrockFile.variableGroups?.length).toBe(0);
    await execute("my-path", "my-vg", mockValues, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
    expect(fileutils.appendVariableGroupToPipelineYaml).toHaveBeenCalledTimes(
      0
    );
  });
  it("appends variable group", async () => {
    const exitFn = jest.fn();
    spyOn(fileutils, "appendVariableGroupToPipelineYaml");
    jest
      .spyOn(variableGrp, "hasVariableGroup")
      .mockReturnValue(Promise.resolve(true));

    const bedrockFile = createTestBedrockYaml(false) as BedrockFile;

    jest.spyOn(config, "Bedrock").mockReturnValue(bedrockFile as BedrockFile);
    jest.spyOn(appendVariableGrp, "checkDependencies").mockReturnValueOnce();
    jest
      .spyOn(appendVariableGrp, "validateValues")
      .mockReturnValueOnce(mockValues as ConfigValues);
    jest.spyOn(bedrockYaml, "addVariableGroup").mockReturnValue();
    jest
      .spyOn(fileutils, "appendVariableGroupToPipelineYaml")
      .mockReturnValue();

    expect(bedrockFile.variableGroups?.length).toBe(0);
    await execute("my-path", "my-vg", mockValues, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
    expect(fileutils.appendVariableGroupToPipelineYaml).toHaveBeenCalledTimes(
      3
    );
  });
});
describe("test validateValues function", () => {
  it("valid org and project name", () => {
    const data = deepClone(mockValues);
    validateValues(data);
  });
  it("invalid project name", () => {
    const data = deepClone(mockValues);
    data.devopsProject = "project\\abc";
    expect(() => {
      validateValues(data);
    }).toThrow();
  });
  it("invalid org name", () => {
    const data = deepClone(mockValues);
    data.orgName = "org name";
    expect(() => {
      validateValues(data);
    }).toThrow();
  });
});
