import path from "path";
import { Config, loadConfiguration } from "../config";
import {
  hasValue,
  isDashHex,
  isIntegerString,
  isPortNumberString,
  validateAccessToken,
  validateAccessTokenThrowable,
  validateACRName,
  validateForNonEmptyValue,
  validateOrgName,
  validateOrgNameThrowable,
  validatePassword,
  validatePrereqs,
  validateProjectName,
  validateProjectNameThrowable,
  validateServicePrincipalId,
  validateServicePrincipalPassword,
  validateServicePrincipalTenantId,
  validateStorageAccountName,
  validateStorageAccountNameThrowable,
  validateStorageAccessKey,
  validateStorageKeyVaultName,
  validateStoragePartitionKey,
  validateStorageTableName,
  validateStorageTableNameThrowable,
  validateSubscriptionId,
  validateSubscriptionIdThrowable,
} from "./validator";
import { getErrorMessage } from "./errorBuilder";

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
    ["", undefined, null].forEach((val) => {
      expect(
        validateForNonEmptyValue({
          error: "error",
          value: val,
        })
      ).toBe("error");
    });
    // expect "" to be returned
    ["", undefined, null].forEach((val) => {
      expect(
        validateForNonEmptyValue({
          error: "",
          value: val,
        })
      ).toBe("");
    });
    // positive tests
    [" c ", " b ", "a"].forEach((val) => {
      expect(
        validateForNonEmptyValue({
          error: "",
          value: val,
        })
      ).toBe("");
    });
    [" b ", "a"].forEach((val) => {
      expect(
        validateForNonEmptyValue({
          error: "",
          value: val,
        })
      ).toBe("");
    });
  });
});

const testValidatePrereqs = (
  global: boolean,
  cmd: string,
  expectedResult: boolean
): void => {
  const filename = path.resolve("src/commands/mocks/spk-config.yaml");
  process.env.test_name = "my_storage_account";
  process.env.test_key = "my_storage_key";
  loadConfiguration(filename);
  const fakeBinaries: string[] = [cmd];
  const result = validatePrereqs(fakeBinaries, global);

  if (global) {
    const config = Config();
    expect(config.infra).toBeDefined();

    if (config.infra) {
      expect(config.infra.checks).toBeDefined();

      if (config.infra.checks) {
        expect(config.infra.checks[cmd]).toBe(expectedResult);
      }
    }
  } else {
    expect(result).toBe(expectedResult);
  }
};

describe("Validating executable prerequisites in spk-config", () => {
  test("Validate that exectuable boolean matches in spk-config - global = true", () => {
    // Iterate through an array of non-existent binaries to create a force fail. If fails, then test pass
    testValidatePrereqs(true, "foobar", false);
  });
  test("Validate that exectuable boolean matches in spk-config - global = false", () => {
    // Iterate through an array of non-existent binaries to create a force fail. If fails, then test pass
    testValidatePrereqs(false, "foobar", false);
  });
});

describe("test validateOrgName function", () => {
  it("empty value and value with space", () => {
    expect(validateOrgName("")).toBe(
      getErrorMessage("validation-err-org-name-missing")
    );
    expect(validateOrgName(" ")).toBe(
      getErrorMessage("validation-err-org-name-missing")
    );
    expect(() => {
      validateOrgNameThrowable("");
    }).toThrow(getErrorMessage("validation-err-org-name-missing"));
    expect(() => {
      validateOrgNameThrowable(" ");
    }).toThrow(getErrorMessage("validation-err-org-name-missing"));
  });
  it("invalid value", () => {
    const values = ["-abc", ".abc", "abc.", "a b"];
    values.forEach((v) => {
      expect(validateOrgName(v)).toBe(
        getErrorMessage("validation-err-org-name")
      );
    });

    values.forEach((v) => {
      expect(() => {
        validateOrgNameThrowable(v);
      }).toThrow(getErrorMessage("validation-err-org-name"));
    });
  });
  it("valid value", () => {
    ["hello", "1Microsoft", "Microsoft#1"].forEach((v) => {
      expect(validateOrgName(v)).toBe(true);
      validateOrgNameThrowable(v);
    });
  });
});

describe("test validateProjectName function", () => {
  it("empty value and value with space", () => {
    expect(validateProjectName("")).toBe(
      getErrorMessage("validation-err-project-name-missing")
    );
    expect(validateProjectName(" ")).toBe(
      getErrorMessage("validation-err-project-name-missing")
    );

    expect(() => {
      validateProjectNameThrowable("");
    }).toThrow();
    expect(() => {
      validateProjectNameThrowable(" ");
    }).toThrow();
  });
  it("value over 64 chars long", () => {
    const val = "a".repeat(65);
    expect(validateProjectName(val)).toBe(
      getErrorMessage("validation-err-project-name-too-long")
    );

    expect(() => {
      validateProjectNameThrowable(val);
    }).toThrow();
  });
  it("invalid value", () => {
    expect(validateProjectName("_abc")).toBe(
      getErrorMessage("validation-err-project-name-begin-underscore")
    );
    expect(validateProjectName(".abc")).toBe(
      getErrorMessage("validation-err-project-name-period")
    );
    expect(validateProjectName("abc.")).toBe(
      getErrorMessage("validation-err-project-name-period")
    );
    expect(validateProjectName(".abc.")).toBe(
      getErrorMessage("validation-err-project-name-period")
    );
    expect(validateProjectName("a*b")).toBe(
      getErrorMessage("validation-err-project-name-special-char")
    );

    ["_abc", ".abc", "abc.", ".abc.", "a*b"].forEach((val) => {
      expect(() => {
        validateProjectNameThrowable(val);
      }).toThrow();
    });
  });
  it("valid value", () => {
    expect(validateProjectName("BedrockSPK")).toBe(true);
    validateProjectNameThrowable("BedrockSPK");
  });
});

describe("test validateAccessToken function", () => {
  it("empty value", () => {
    expect(validateAccessToken("")).toBe(
      getErrorMessage("validation-err-personal-access-token-missing")
    );
    expect(() => {
      validateAccessTokenThrowable("");
    }).toThrow();
  });
  it("validate value", () => {
    expect(validateAccessToken("mysecretshhhh")).toBe(true);
  });
});

describe("test isDashHex function", () => {
  it("sanity test", () => {
    expect(isDashHex("")).toBe(false);
    expect(isDashHex("b510c1ff-358c-4ed4-96c8-eb23f42bb65b")).toBe(true);
    expect(isDashHex(".eb23f42bb65b")).toBe(false);
  });
});

describe("test validateServicePrincipal functions", () => {
  it("sanity test", () => {
    [
      {
        fn: validateServicePrincipalId,
        missing: "validation-err-service-principal-id-missing",
        invalid: "validation-err-service-principal-id-invalid",
      },
      {
        fn: validateServicePrincipalPassword,
        missing: "validation-err-service-principal-pwd-missing",
        invalid: "validation-err-service-principal-pwd-invalid",
      },
      {
        fn: validateServicePrincipalTenantId,
        missing: "validation-err-service-principal-tenant-id-missing",
        invalid: "validation-err-service-principal-tenant-id-invalid",
      },
    ].forEach((item) => {
      expect(item.fn("")).toBe(getErrorMessage(item.missing));
      expect(item.fn("b510c1ff-358c-4ed4-96c8-eb23f42bb65b")).toBe(true);
      expect(item.fn(".eb23f42bb65b")).toBe(getErrorMessage(item.invalid));
    });
  });
});

describe("test validateSubscriptionId function", () => {
  it("sanity test", () => {
    expect(validateSubscriptionId("")).toBe(
      getErrorMessage("validation-err-subscription-id-missing")
    );
    expect(validateSubscriptionId("xyz")).toBe(
      getErrorMessage("validation-err-subscription-id-invalid")
    );
    expect(validateSubscriptionId("abc123-456")).toBeTruthy();
    expect(() => {
      validateSubscriptionIdThrowable("");
    }).toThrow();
    expect(() => {
      validateSubscriptionIdThrowable("xyz");
    }).toThrow();
  });
});

describe("test validateStorageAccountName test", () => {
  it("sanity test", () => {
    expect(validateStorageAccountName("")).toBe(
      getErrorMessage("validation-err-storage-account-name-missing")
    );
    expect(validateStorageAccountName("XYZ123")).toBe(
      getErrorMessage("validation-err-storage-account-name-invalid")
    );
    expect(validateStorageAccountName("ab")).toBe(
      getErrorMessage("validation-err-storage-account-name-length")
    );
    expect(validateStorageAccountName("12345678a".repeat(3))).toBe(
      getErrorMessage("validation-err-storage-account-name-length")
    );

    ["", "XYZ123", "ab", "12345678a".repeat(3)].forEach((val) => {
      expect(() => {
        validateStorageAccountNameThrowable(val);
      }).toThrow();
    });

    expect(validateStorageAccountName("abc123456")).toBeTruthy();
  });
});

describe("test validateStorageTableName test", () => {
  it("sanity test", () => {
    expect(validateStorageTableName("")).toBe(
      getErrorMessage("validation-err-storage-table-name-missing")
    );
    expect(validateStorageTableName("XYZ123*")).toBe(
      getErrorMessage("validation-err-storage-table-name-invalid")
    );
    expect(validateStorageTableName("1XYZ123")).toBe(
      getErrorMessage("validation-err-storage-table-name-invalid")
    );
    expect(validateStorageTableName("ab")).toBe(
      getErrorMessage("validation-err-storage-table-name-length")
    );
    expect(validateStorageTableName("a123456789".repeat(7))).toBe(
      getErrorMessage("validation-err-storage-table-name-length")
    );
    expect(validateStorageTableName("abc123456")).toBeTruthy();

    ["", "XYZ123*", "1XYZ123", "ab", "a123456789".repeat(7)].forEach((val) => {
      expect(() => {
        validateStorageTableNameThrowable(val);
      }).toThrow();
    });
  });
});

describe("test validatePassword test", () => {
  it("sanity test", () => {
    expect(validatePassword("")).toBe(
      getErrorMessage("validation-err-password-missing")
    );
    expect(validatePassword("1234567")).toBe(
      getErrorMessage("validation-err-password-too-short")
    );
    expect(validatePassword("abcd1234")).toBeTruthy();
    expect(validatePassword("abcdefg123456678")).toBeTruthy();
  });
});

describe("test validateStoragePartitionKey test", () => {
  it("sanity test", () => {
    expect(validateStoragePartitionKey("")).toBe(
      getErrorMessage("validation-err-storage-partition-key-missing")
    );
    ["abc\\", "abc/", "abc?", "abc#"].forEach((s) => {
      expect(validateStoragePartitionKey(s)).toBe(
        getErrorMessage("validation-err-storage-partition-key-invalid")
      );
    });
    expect(validateStoragePartitionKey("abcdefg123456678")).toBeTruthy();
  });
});

describe("test validateACRName function", () => {
  it("sanity test", () => {
    expect(validateACRName("")).toBe(
      getErrorMessage("validation-err-acr-missing")
    );
    expect(validateACRName("xyz-")).toBe(
      getErrorMessage("validation-err-acr-invalid")
    );
    expect(validateACRName("1")).toBe(
      getErrorMessage("validation-err-acr-length")
    );
    expect(validateACRName("1234567890a".repeat(10))).toBe(
      getErrorMessage("validation-err-acr-length")
    );
    expect(validateACRName("abc12356")).toBeTruthy();
  });
});

describe("test validateStorageKeyVaultName function", () => {
  it("sanity test", () => {
    expect(validateStorageKeyVaultName("")).toBeTruthy();
    expect(validateStorageKeyVaultName("ab*")).toBe(
      getErrorMessage("validation-err-storage-key-vault-invalid")
    );
    expect(validateStorageKeyVaultName("1abc0")).toBe(
      getErrorMessage("validation-err-storage-key-vault-start-letter")
    );
    expect(validateStorageKeyVaultName("abc0-")).toBe(
      getErrorMessage("validation-err-storage-key-vault-end-char")
    );
    expect(validateStorageKeyVaultName("a--b")).toBe(
      getErrorMessage("validation-err-storage-key-vault-hyphen")
    );
    expect(validateStorageKeyVaultName("ab")).toBe(
      getErrorMessage("validation-err-storage-key-vault-length")
    );
    expect(validateStorageKeyVaultName("a12345678".repeat(3))).toBe(
      getErrorMessage("validation-err-storage-key-vault-length")
    );
    expect(validateStorageKeyVaultName("abc-12356")).toBeTruthy();
  });
});

describe("test validateStorageAccessKey function", () => {
  it("sanity test", () => {
    expect(validateStorageAccessKey("")).toBe(
      getErrorMessage("validation-err-storage-access-key-missing")
    );
    expect(validateStorageAccessKey("abc-12356")).toBeTruthy();
  });
});
