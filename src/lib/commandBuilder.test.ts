import commander from "commander";
import { watchFile } from "fs";
jest.mock("fs");
import { logger } from "../logger";
import {
  build,
  exit as exitCmd,
  ICommandBuildElements,
  validateForRequiredValues
} from "./commandBuilder";

interface ICommandOption {
  flags: string;
  description: string;
  defaultValue: string | boolean;
}

describe("Tests Command Builder's build function", () => {
  it("Declaration with no options", () => {
    const descriptor: ICommandBuildElements = {
      alias: "cbt",
      command: "command-build-test",
      description: "description of command"
    };

    const cmd = build(new commander.Command(), descriptor);

    expect(cmd.description()).toBe("description of command");
    expect(cmd.alias()).toBe("cbt");
    expect(cmd.options.length).toBe(0);
  });
  it("Sanity tests", () => {
    const descriptor: ICommandBuildElements = {
      alias: "cbt",
      command: "command-build-test",
      description: "description of command",
      options: [
        {
          arg: "-a, --option-a <optionA>",
          description: "description for optionA",
          required: false
        },
        {
          arg: "-b, --option-b <optionB>",
          description: "description for optionB",
          required: false
        },
        {
          arg: "-c, --option-c <optionC>",
          description: "description for optionC",
          required: false
        },
        {
          arg: "-d, --option-d <optionD>",
          defaultValue: false,
          description: "description for optionD",
          required: false
        },
        {
          arg: "-e, --option-d <optionE>",
          defaultValue: "test",
          description: "description for optionE",
          required: false
        }
      ]
    };

    const cmd = build(new commander.Command(), descriptor);

    expect(cmd.description()).toBe("description of command");
    expect(cmd.alias()).toBe("cbt");

    cmd.options.forEach((opt: ICommandOption, i: number) => {
      const declared = (descriptor.options || [])[i];
      expect(opt.flags).toBe(declared.arg);
      expect(opt.description).toBe(declared.description);

      if (declared.defaultValue !== undefined) {
        expect(opt.defaultValue).toBe(declared.defaultValue);
      }
    });
  });
});

describe("Tests Command Builder's validation function", () => {
  it("Validation tests", () => {
    const descriptor: ICommandBuildElements = {
      alias: "cbt",
      command: "command-build-test",
      description: "description of command"
    };

    const errors = validateForRequiredValues(descriptor, {});

    expect(errors.length).toBe(0);
  });
  it("Validation tests", () => {
    const descriptor: ICommandBuildElements = {
      alias: "cbt",
      command: "command-build-test",
      description: "description of command",
      options: [
        {
          arg: "-a, --option-a <optionA>",
          description: "description for optionA",
          required: true
        },
        {
          arg: "-b, --option-b <optionB>",
          description: "description for optionB",
          required: false
        },
        {
          arg: "-c --option-c <optionC>",
          description: "description for optionC",
          required: true
        },
        {
          arg: "-d --option-d <optionD>",
          description: "description for optionD" // required is not defined, treated as false
        }
      ]
    };

    const errors = validateForRequiredValues(descriptor, {
      optionA: "has value"
    });

    // Option-A is ok because we have value for optionA
    // Option-B is ok because it is not flag as required
    // Option-C is not ok because value is missing
    expect(errors.length).toBe(1);
    expect(errors[0]).toBe("-c --option-c <optionC>");
  });
});

describe("Tests Command Builder's exit function", () => {
  it("calling exit function", async done => {
    (watchFile as jest.Mock).mockImplementationOnce((f, cb) => {
      cb({ size: 100 });
    });
    const exitFn = jest.fn();
    await exitCmd(logger, exitFn, 1).then(() => {
      expect(exitFn).toBeCalledTimes(1);
      expect(exitFn.mock.calls).toEqual([[1]]);
      done();
    });
  });
});
