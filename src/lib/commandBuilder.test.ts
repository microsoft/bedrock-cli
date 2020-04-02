import commander from "commander";
import { watchFile } from "fs";
import { createLogger } from "winston";
jest.mock("fs");
import { logger } from "../logger";
import {
  argToVariableName,
  build,
  exit as exitCmd,
  CommandBuildElements,
  populateInheritValueFromConfig,
  validateForRequiredValues,
} from "./commandBuilder";

interface CommandOption {
  flags: string;
  description: string;
  defaultValue: string | boolean;
}

describe("test argToVariableName function", () => {
  it("positive test", () => {
    const name = argToVariableName({
      arg: "--test-option",
      description: "test",
    });
    expect(name).toBe("testOption");
  });
  it("positive test", () => {
    expect(() => {
      argToVariableName({
        arg: "-test-option",
        description: "test",
      });
    }).toThrow("Could locate option name -test-option");
  });
});

describe("test populateInheritValueFromConfig function", () => {
  it("positive test: value = undefined and no inherit match", () => {
    const opts = {
      testOption: undefined,
    };
    populateInheritValueFromConfig(
      {
        command: "test",
        alias: "t",
        description: "description of test",
        options: [
          {
            arg: "--test-option",
            description: "test",
            inherit: "introspection.test",
          },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      },
      {} as any,
      opts
    );
    expect(opts.testOption).toBeUndefined();
  });
  it("positive test: value = undefined and inherit match", () => {
    const opts = {
      testOption: undefined,
    };
    populateInheritValueFromConfig(
      {
        command: "test",
        alias: "t",
        description: "description of test",
        options: [
          {
            arg: "--test-option",
            description: "test",
            inherit: "introspection.test",
          },
        ],
      },
      {
        introspection: {
          test: "test-value",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      opts
    );
    expect(opts.testOption).toBe("test-value");
  });
  it("negative test: incorrect inherit value", () => {
    const opts = {
      testOption: undefined,
    };
    populateInheritValueFromConfig(
      {
        command: "test",
        alias: "t",
        description: "description of test",
        options: [
          {
            arg: "--test-option",
            description: "test",
            inherit: "introspection.testx",
          },
        ],
      },
      {
        introspection: {
          test: "test-value",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      opts
    );
    expect(opts.testOption).toBeUndefined();
  });
  it("negative test: incorrect inherit value: object", () => {
    const opts = {
      testOption: undefined,
    };
    populateInheritValueFromConfig(
      {
        command: "test",
        alias: "t",
        description: "description of test",
        options: [
          {
            arg: "--test-option",
            description: "test",
            inherit: "introspection",
          },
        ],
      },
      {
        introspection: {
          test: "test-value",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      opts
    );
    expect(opts.testOption).toBeUndefined();
  });
});

describe("Tests Command Builder's build function", () => {
  it("Declaration with no options", () => {
    const descriptor: CommandBuildElements = {
      alias: "cbt",
      command: "command-build-test",
      description: "description of command",
    };

    const cmd = build(new commander.Command(), descriptor);

    expect(cmd.description()).toBe("description of command");
    expect(cmd.alias()).toBe("cbt");
    expect(cmd.options.length).toBe(0);
  });
  it("Sanity tests", () => {
    const descriptor: CommandBuildElements = {
      alias: "cbt",
      command: "command-build-test",
      description: "description of command",
      options: [
        {
          arg: "-a, --option-a <optionA>",
          description: "description for optionA",
          required: false,
        },
        {
          arg: "-b, --option-b <optionB>",
          description: "description for optionB",
          required: false,
        },
        {
          arg: "-c, --option-c <optionC>",
          description: "description for optionC",
          required: false,
        },
        {
          arg: "-d, --option-d <optionD>",
          defaultValue: false,
          description: "description for optionD",
          required: false,
        },
        {
          arg: "-e, --option-d <optionE>",
          defaultValue: "test",
          description: "description for optionE",
          required: false,
        },
      ],
    };

    const cmd = build(new commander.Command(), descriptor);

    expect(cmd.description()).toBe("description of command");
    expect(cmd.alias()).toBe("cbt");

    cmd.options.forEach((opt: CommandOption, i: number) => {
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
    const descriptor: CommandBuildElements = {
      alias: "cbt",
      command: "command-build-test",
      description: "description of command",
    };

    const errors = validateForRequiredValues(descriptor, {});

    expect(errors.length).toBe(0);
  });
  it("Validation tests", () => {
    const descriptor: CommandBuildElements = {
      alias: "cbt",
      command: "command-build-test",
      description: "description of command",
      options: [
        {
          arg: "-a, --option-a <optionA>",
          description: "description for optionA",
          required: true,
        },
        {
          arg: "-b, --option-b <optionB>",
          description: "description for optionB",
          required: false,
        },
        {
          arg: "-c --option-c <optionC>",
          description: "description for optionC",
          required: true,
        },
        {
          arg: "-d --option-d <optionD>",
          description: "description for optionD", // required is not defined, treated as false
        },
      ],
    };

    const errors = validateForRequiredValues(descriptor, {
      optionA: "has value",
    });

    // Option-A is ok because we have value for optionA
    // Option-B is ok because it is not flag as required
    // Option-C is not ok because value is missing
    expect(errors.length).toBe(1);
    expect(errors[0]).toBe("-c --option-c <optionC>");
  });
});

describe("Tests Command Builder's exit function", () => {
  it("calling exit function", async (done) => {
    (watchFile as jest.Mock).mockImplementationOnce((f, cb) => {
      cb({ size: 100 });
    });
    const exitFn = jest.fn();
    await exitCmd(logger, exitFn, 1, 100).then(() => {
      expect(exitFn).toBeCalledTimes(1);
      expect(exitFn.mock.calls).toEqual([[1]]);
      done();
    });
  });
  it("calling exit function without file transport", async (done) => {
    const exitFn = jest.fn();
    await exitCmd(
      createLogger({
        defaultMeta: { service: "spk" },
        level: "info",
        transports: [],
      }),
      exitFn,
      1,
      100
    ).then(() => {
      expect(exitFn).toBeCalledTimes(1);
      expect(exitFn.mock.calls).toEqual([[1]]);
      done();
    });
  });
});
