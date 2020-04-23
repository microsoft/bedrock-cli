import { execute, CommandOptions } from "./append-variable-group";
import * as appendVariableGrp from "./append-variable-group";
import * as fileutils from "../../lib/fileutils";
import { createTestBedrockYaml } from "../../test/mockFactory";
import * as config from "../../config";
import { BedrockFile } from "../../types";
import { ConfigValues } from "./pipeline";
import * as bedrockYaml from "../../lib/bedrockYaml";

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
  it("appends variable group", async () => {
    const exitFn = jest.fn();
    spyOn(fileutils, "appendVariableGroupToPipelineYaml");
    jest
      .spyOn(appendVariableGrp, "variableGroupExists")
      .mockReturnValue(Promise.resolve(true));

    const bedrockFile = createTestBedrockYaml(false) as BedrockFile;

    jest.spyOn(config, "Bedrock").mockReturnValue(bedrockFile as BedrockFile);
    jest.spyOn(appendVariableGrp, "checkDependencies").mockReturnValueOnce();
    jest
      .spyOn(appendVariableGrp, "validateValues")
      .mockReturnValueOnce(mockValues as ConfigValues);
    jest.spyOn(bedrockYaml, "addVariableGroup").mockReturnValue();

    expect(bedrockFile.variableGroups?.length).toBe(0);
    await execute("my-path", "my-vg", mockValues, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
});
