import path from "path";
import { Config, loadConfiguration } from "../config";
import {
  hasValue,
  isIntegerString,
  isPortNumberString,
  ORG_NAME_VIOLATION,
  validateAccessToken,
  validateForNonEmptyValue,
  validateOrgName,
  validatePrereqs,
  validateProjectName
} from "./validator";

describe("Tests on validator helper functions", () => {
  it("Test hasValue function", () => {
    expect(hasValue("")).toBe(false);
    expect(hasValue(undefined)).toBe(false);
    expect(hasValue(null)).toBe(false);

    expect(hasValue(" ")).toBe(false);
    expect(hasValue(" b ")).toBe(true);
    expect(hasValue(" a ")).toBe(true);
  });
  it("Test isIntegerString function", () => {
    expect(isIntegerString("")).toBe(false);
    expect(isIntegerString(undefined)).toBe(false);
    expect(isIntegerString(null)).toBe(false);

    expect(isIntegerString("-10")).toBe(false);
    expect(isIntegerString("+10")).toBe(false);
    expect(isIntegerString("010")).toBe(false);
    expect(isIntegerString("10.0")).toBe(false);
    expect(isIntegerString("80")).toBe(true);
    expect(isIntegerString("1")).toBe(true); // single digit test
  });
  it("Test isPortNumberString function", () => {
    expect(isPortNumberString("")).toBe(false);
    expect(isPortNumberString(undefined)).toBe(false);
    expect(isPortNumberString(null)).toBe(false);

    expect(isPortNumberString("-10")).toBe(false);
    expect(isPortNumberString("+10")).toBe(false);
    expect(isPortNumberString("010")).toBe(false);
    expect(isPortNumberString("10.0")).toBe(false);
    expect(isPortNumberString("80")).toBe(true);
    expect(isPortNumberString("8080")).toBe(true);
    expect(isPortNumberString("0")).toBe(false);
    expect(isPortNumberString("65536")).toBe(false);
  });
  it("Test validateForNonEmptyValue function", () => {
    // expect "error" to be returned
    ["", undefined, null].forEach(val => {
      expect(
        validateForNonEmptyValue({
          error: "error",
          value: val
        })
      ).toBe("error");
    });
    // expect "" to be returned
    ["", undefined, null].forEach(val => {
      expect(
        validateForNonEmptyValue({
          error: "",
          value: val
        })
      ).toBe("");
    });
    // positive tests
    [" c ", " b ", "a"].forEach(val => {
      expect(
        validateForNonEmptyValue({
          error: "",
          value: val
        })
      ).toBe("");
    });
    [" b ", "a"].forEach(val => {
      expect(
        validateForNonEmptyValue({
          error: "",
          value: val
        })
      ).toBe("");
    });
  });
});

const testvalidatePrereqs = (
  global: boolean,
  cmd: string,
  expectedResult: boolean
) => {
  const filename = path.resolve("src/commands/mocks/spk-config.yaml");
  process.env.test_name = "my_storage_account";
  process.env.test_key = "my_storage_key";
  loadConfiguration(filename);
  const fakeBinaries: string[] = [cmd];
  const result = validatePrereqs(fakeBinaries, global);

  if (global) {
    const config = Config();
    expect(config.infra!).toBeDefined();
    expect(config.infra!.checks).toBeDefined();
    expect(config.infra!.checks![cmd]!).toBe(expectedResult);
  } else {
    expect(result).toBe(expectedResult);
  }
};

describe("Validating executable prerequisites in spk-config", () => {
  test("Validate that exectuable boolean matches in spk-config - global = true", () => {
    // Iterate through an array of non-existent binaries to create a force fail. If fails, then test pass
    testvalidatePrereqs(true, "foobar", false);
  });
  test("Validate that exectuable boolean matches in spk-config - global = false", () => {
    // Iterate through an array of non-existent binaries to create a force fail. If fails, then test pass
    testvalidatePrereqs(false, "foobar", false);
  });
});

describe("test validateOrgName function", () => {
  it("empty value and value with space", () => {
    expect(validateOrgName("")).toBe("Must enter an organization");
    expect(validateOrgName(" ")).toBe("Must enter an organization");
  });
  it("invalid value", () => {
    expect(validateOrgName("-abc")).toBe(ORG_NAME_VIOLATION);
    expect(validateOrgName(".abc")).toBe(ORG_NAME_VIOLATION);
    expect(validateOrgName("abc.")).toBe(ORG_NAME_VIOLATION);
    expect(validateOrgName("a b")).toBe(ORG_NAME_VIOLATION);
  });
  it("valid value", () => {
    expect(validateOrgName("hello")).toBe(true);
    expect(validateOrgName("1Microsoft")).toBe(true);
    expect(validateOrgName("Microsoft#1")).toBe(true);
  });
});

describe("test validateProjectName function", () => {
  it("empty value and value with space", () => {
    expect(validateProjectName("")).toBe("Must enter a project name");
    expect(validateProjectName(" ")).toBe("Must enter a project name");
  });
  it("space in value", () => {
    expect(validateProjectName("a b")).toBe(
      "Project name cannot contains spaces"
    );
  });
  it("value over 64 chars long", () => {
    expect(validateProjectName("a".repeat(65))).toBe(
      "Project name cannot be longer than 64 characters"
    );
  });
  it("invalid value", () => {
    expect(validateProjectName("_abc")).toBe(
      "Project name cannot begin with an underscore"
    );
    expect(validateProjectName(".abc")).toBe(
      "Project name cannot begin or end with a period"
    );
    expect(validateProjectName("abc.")).toBe(
      "Project name cannot begin or end with a period"
    );
    expect(validateProjectName(".abc.")).toBe(
      "Project name cannot begin or end with a period"
    );
    expect(validateProjectName("a*b")).toBe(
      `Project name can't contain special characters, such as / : \ ~ & % ; @ ' " ? < > | # $ * } { , + = [ ]`
    );
  });
  it("valid value", () => {
    expect(validateProjectName("BedrockSPK")).toBe(true);
  });
});

describe("test validateAccessToken function", () => {
  it("empty value", () => {
    expect(validateAccessToken("")).toBe(
      "Must enter a personal access token with read/write/manage permissions"
    );
  });
  it("validate value", () => {
    expect(validateAccessToken("mysecretshhhh")).toBe(true);
  });
});
