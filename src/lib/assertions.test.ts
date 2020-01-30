import { assertIsStringWithContent, isString } from "./assertions";

describe("isString", () => {
  test("returns true for strings", () => {
    expect(isString("123")).toBe(true);
  });

  test("returns false for non-strings", () => {
    expect(isString(123)).toBe(false);
  });
});

describe("assertIsStringWithContent", () => {
  test("no error thrown when valid string provided", () => {
    let error: Error | undefined;
    try {
      assertIsStringWithContent("123");
    } catch (err) {
      error = err;
    }
    expect(error).toBeUndefined();
  });

  test("error thrown when invalid string provided", () => {
    let error: Error | undefined;
    try {
      assertIsStringWithContent("");
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();

    error = undefined;
    try {
      assertIsStringWithContent(123);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
  });
});
