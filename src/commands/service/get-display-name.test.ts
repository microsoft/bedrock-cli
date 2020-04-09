import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { execute } from "./get-display-name";
import * as fs from "fs";
import { createTestBedrockYaml } from "../../test/mockFactory";
import { BedrockFile } from "../../types";
import * as bedrockYaml from "../../lib/bedrockYaml";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("get display name", () => {
  it("positive test", async () => {
    const exitFn = jest.fn();
    const defaultBedrockFileObject = createTestBedrockYaml(
      false
    ) as BedrockFile;
    jest.spyOn(fs, "existsSync").mockReturnValueOnce(true);
    jest
      .spyOn(bedrockYaml, "read")
      .mockReturnValueOnce(defaultBedrockFileObject);
    jest.spyOn(process, "cwd").mockReturnValueOnce("bedrock.yaml/");
    const consoleSpy = jest.spyOn(console, "log");
    await execute({ path: "./packages/service1" }, exitFn);
    expect(consoleSpy).toHaveBeenCalledWith("service1");
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn).toBeCalledWith(0);
  });
  it("negative test: path missing", async () => {
    const exitFn = jest.fn();
    await execute({ path: "" }, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn).toBeCalledWith(1);
  });
  it("negative test: path as undefined", async () => {
    const exitFn = jest.fn();
    await execute({ path: undefined }, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn).toBeCalledWith(1);
  });
  it("negative test: service not found", async () => {
    const exitFn = jest.fn();
    const defaultBedrockFileObject = createTestBedrockYaml(
      false
    ) as BedrockFile;
    jest.spyOn(fs, "existsSync").mockReturnValueOnce(true);
    jest
      .spyOn(bedrockYaml, "read")
      .mockReturnValueOnce(defaultBedrockFileObject);
    jest.spyOn(process, "cwd").mockReturnValueOnce("bedrock.yaml/");
    await execute({ path: "./packages/service" }, exitFn); // should not exist
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn).toBeCalledWith(1);
  });
});
