import { execute } from "./append-variable-group";
import * as fileutils from "../../lib/fileutils";

describe("Test execute function", () => {
  it("missing variable group name", async () => {
    const exitFn = jest.fn();
    await execute("my-path", "", exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("appends variable group", async () => {
    const exitFn = jest.fn();
    spyOn(fileutils, "appendVariableGroupToPipelineYaml");
    await execute("my-path", "my-vg", exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
});
