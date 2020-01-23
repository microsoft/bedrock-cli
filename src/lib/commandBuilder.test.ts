import commander from "commander";
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
      const declared = descriptor.options[i];
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
  it("calling exit function", () => {
    jest.spyOn(logger, "info");
    exitCmd(logger).then(() => {
      expect(logger.info).toBeCalledTimes(1);
    });
  });
});
