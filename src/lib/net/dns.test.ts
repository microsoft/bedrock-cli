import * as dns from "./dns";

describe("containsValidCharacters", () => {
  test("alphanumerics, dots, and dashes pass", () => {
    expect(dns.containsValidCharacters(".string-starting.with-dot")).toBe(true);
    expect(dns.containsValidCharacters("-string.starting-with-dash")).toBe(
      true
    );
    expect(dns.containsValidCharacters("string-starting.with.dot")).toBe(true);
    expect(dns.containsValidCharacters("string-ending.with.dot.")).toBe(true);
    expect(dns.containsValidCharacters("string-ending.with.dash-")).toBe(true);
    expect(dns.containsValidCharacters("string-with.with.char-x")).toBe(true);
  });

  test("non alphanumerics, non-dots, non-dashes fail", () => {
    expect(dns.containsValidCharacters("string-with a-space")).toBe(false);
    expect(dns.containsValidCharacters("string-with-!")).toBe(false);
    expect(dns.containsValidCharacters("string-with-@")).toBe(false);
    expect(dns.containsValidCharacters("string-with-#")).toBe(false);
    expect(dns.containsValidCharacters("string-with-$")).toBe(false);
    expect(dns.containsValidCharacters("string-with-%")).toBe(false);
    expect(dns.containsValidCharacters("string-with-^")).toBe(false);
    expect(dns.containsValidCharacters("string-with-&")).toBe(false);
  });
});

describe("isValid", () => {
  test("valid DNS pass", () => {
    expect(dns.isValid("foo.com")).toBe(true);
    expect(dns.isValid("foo.bar.baz.123.com")).toBe(true);
    expect(dns.isValid("1.foo.bar.123")).toBe(true);
  });

  test("invalid DNS fail", () => {
    expect(dns.isValid("$foo.com")).toBe(false);
    expect(dns.isValid("!foo.bar.baz.123.com")).toBe(false);
    expect(dns.isValid("%1.foo.bar.123")).toBe(false);
    expect(dns.isValid("foo.com%")).toBe(false);
    expect(dns.isValid("foo.bar.baz.123.com!")).toBe(false);
    expect(dns.isValid("1.foo.bar.123#")).toBe(false);
    expect(dns.isValid("foo/com%")).toBe(false);
    expect(dns.isValid("foo.bar#!@#baz.123.com")).toBe(false);
    expect(dns.isValid("1.foo*&bar.123")).toBe(false);
  });
});

describe("replaceIllegalCharacters", () => {
  test("all characters become lowercase", () => {
    expect(dns.replaceIllegalCharacters("ABC")).toBe("abc");
  });
  test("all non-alphanumerics become dashes", () => {
    expect(dns.replaceIllegalCharacters("a!a@a#a$a%a^a&a*a")).toBe(
      "a-a-a-a-a-a-a-a-a"
    );
  });
});

describe("assertIsValid", () => {
  test("does not throw when valid", () => {
    expect(() => dns.assertIsValid("foo", "foo.bar.com")).not.toThrow();
    expect(() => dns.assertIsValid("foo", "foo.bar-com")).not.toThrow();
  });

  test("throws when invalid", () => {
    expect(() => dns.assertIsValid("foo", "-foo")).toThrow();
    expect(() => dns.assertIsValid("foo", "_foo")).toThrow();
    expect(() => dns.assertIsValid("foo", "foo-")).toThrow();
    expect(() => dns.assertIsValid("foo", "foo_")).toThrow();
    expect(() => dns.assertIsValid("foo", "invalid#dns$name")).toThrow();
    expect(() => dns.assertIsValid("foo", "invalid/dns/name")).toThrow();
    expect(() => dns.assertIsValid("foo", "invalid@dns%name")).toThrow();
  });
});
