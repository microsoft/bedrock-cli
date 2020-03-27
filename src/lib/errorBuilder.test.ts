import { build, log } from "./errorBuilder";
import i18n from "./i18n.json";
import { errorStatusCode } from "./errorStatusCode";

const errors = i18n.errors;

describe("test getErrorMessage function", () => {
  it("positive test: string", () => {
    const oErr = build(
      errorStatusCode.CMD_EXE_ERR,
      "infra-scaffold-cmd-failed"
    );
    expect(oErr.message).toBe(
      `infra-scaffold-cmd-failed: ${errors["infra-scaffold-cmd-failed"]}`
    );
  });
  it("positive test: object", () => {
    const oErr = build(errorStatusCode.CMD_EXE_ERR, {
      errorKey: "infra-err-locate-tf-env",
      values: ["test"],
    });
    expect(oErr.message).toBe(
      `infra-err-locate-tf-env: ${errors["infra-err-locate-tf-env"].replace(
        "{0}",
        "test"
      )}`
    );
  });
  it("negative test: invalid test", () => {
    const oErr = build(
      errorStatusCode.CMD_EXE_ERR,
      "infra-scaffold-cmd-failedxxxxx"
    );
    expect(oErr.message).toBe("infra-scaffold-cmd-failedxxxxx");
  });
});

describe("test build function", () => {
  it("positive test: without error", () => {
    const err = build(errorStatusCode.CMD_EXE_ERR, "infra-scaffold-cmd-failed");
    expect(err.errorCode).toBe(errorStatusCode.CMD_EXE_ERR);
    expect(err.message).toBe(
      `infra-scaffold-cmd-failed: ${errors["infra-scaffold-cmd-failed"]}`
    );
    expect(err.details).toBeUndefined();
    expect(err.parent).toBeUndefined();
  });
  it("positive test: with Error", () => {
    const err = build(
      errorStatusCode.CMD_EXE_ERR,
      "infra-scaffold-cmd-failed",
      Error("test")
    );
    expect(err.errorCode).toBe(errorStatusCode.CMD_EXE_ERR);
    expect(err.message).toBe(
      `infra-scaffold-cmd-failed: ${errors["infra-scaffold-cmd-failed"]}`
    );
    expect(err.details).toBe("test");
    expect(err.parent).toBeUndefined();
  });
  it("positive test: with ErrorChain", () => {
    const e = build(
      errorStatusCode.CMD_EXE_ERR,
      "infra-scaffold-cmd-src-missing"
    );
    const err = build(
      errorStatusCode.CMD_EXE_ERR,
      "infra-scaffold-cmd-failed",
      e
    );
    expect(err.errorCode).toBe(errorStatusCode.CMD_EXE_ERR);
    expect(err.message).toBe(
      `infra-scaffold-cmd-failed: ${errors["infra-scaffold-cmd-failed"]}`
    );
    expect(err.details).toBeUndefined();
    expect(err.parent).toStrictEqual(e);
  });
});

describe("test message function", () => {
  it("positive test: one error chain", () => {
    const messages: string[] = [];
    const oError = build(
      errorStatusCode.CMD_EXE_ERR,
      "infra-scaffold-cmd-src-missing"
    );
    oError.messages(messages);
    expect(messages).toStrictEqual([
      `code: 1000\nmessage: infra-scaffold-cmd-src-missing: ${errors["infra-scaffold-cmd-src-missing"]}`,
    ]);
  });
  it("positive test: one error chain with details", () => {
    const messages: string[] = [];
    const oError = build(
      1000,
      "infra-scaffold-cmd-src-missing",
      Error("test message")
    );
    oError.messages(messages);
    expect(messages).toStrictEqual([
      `code: 1000\nmessage: infra-scaffold-cmd-src-missing: ${errors["infra-scaffold-cmd-src-missing"]}\ndetails: test message`,
    ]);
  });
  it("positive test: multiple error chains", () => {
    const messages: string[] = [];
    const oError = build(
      1000,
      "infra-scaffold-cmd-src-missing",
      build(
        1001,
        "infra-scaffold-cmd-values-missing",
        build(
          errorStatusCode.ENV_SETTING_ERR,
          "infra-err-validating-remote-git"
        )
      )
    );
    oError.messages(messages);
    expect(messages).toStrictEqual([
      `code: 1000\nmessage: infra-scaffold-cmd-src-missing: ${errors["infra-scaffold-cmd-src-missing"]}`,
      `  code: 1001\n  message: infra-scaffold-cmd-values-missing: ${errors["infra-scaffold-cmd-values-missing"]}`,
      `    code: 1010\n    message: infra-err-validating-remote-git: ${errors["infra-err-validating-remote-git"]}`,
    ]);
  });
});

describe("test log function", () => {
  it("test: Error chain object", () => {
    const oError = build(
      errorStatusCode.CMD_EXE_ERR,
      "infra-scaffold-cmd-failed"
    );
    expect(log(oError)).toBe(
      `\ncode: 1000\nmessage: infra-scaffold-cmd-failed: ${errors["infra-scaffold-cmd-failed"]}`
    );
  });
  it("test: Error object", () => {
    expect(log(Error("test message"))).toBe("test message");
  });
});
