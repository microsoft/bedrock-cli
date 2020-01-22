import { hasValue, validateForNonEmptyValue } from "./validator";

describe("Tests on validator helper functions", () => {
  it("Test hasValue function", () => {
    expect(hasValue("")).toBe(false);
    expect(hasValue(undefined)).toBe(false);
    expect(hasValue(null)).toBe(false);

    expect(hasValue(" ")).toBe(true);
    expect(hasValue(" b ")).toBe(true);
    expect(hasValue(" a ")).toBe(true);
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
    [" ", " b ", "a"].forEach(val => {
      expect(
        validateForNonEmptyValue({
          error: "",
          value: val
        })
      ).toBe("");
    });
    [" ", " b ", "a"].forEach(val => {
      expect(
        validateForNonEmptyValue({
          error: "error",
          value: val
        })
      ).toBe("");
    });
  });
});
