/* eslint-disable @typescript-eslint/camelcase */
import uuid from "uuid/v4";
import * as deploymenttable from "../../lib/azure/deploymenttable";
import {
  DeploymentTable,
  RowACRToHLDPipeline,
  RowHLDToManifestPipeline,
  RowManifest,
  RowSrcToACRPipeline,
} from "../../lib/azure/deploymenttable";
import * as storage from "../../lib/azure/storage";
import { deepClone } from "../../lib/util";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { ConfigYaml } from "../../types";
import {
  deleteSelfTestData,
  execute,
  isValidConfig,
  runSelfTest,
  ValidateConfig,
  writeSelfTestData,
} from "./validate";
import * as validate from "./validate";

const mockedValidateConfig: ValidateConfig = {
  accountName: uuid(),
  tableName: uuid(),
  key: uuid(),
  partitionKey: uuid(),
};

const mockedConfig: ConfigYaml = {
  azure_devops: {
    org: uuid(),
    project: uuid(),
  },
  introspection: {
    azure: {
      account_name: mockedValidateConfig.accountName,
      key: mockedValidateConfig.key,
      partition_key: mockedValidateConfig.partitionKey,
      table_name: mockedValidateConfig.tableName,
    },
  },
};

jest.spyOn(storage, "getStorageManagementClient").mockImplementation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => {
    return undefined;
  }
);

jest.spyOn(storage, "getStorageAccountKeys").mockImplementation(
  async (accountName: string): Promise<string[]> => {
    if (accountName === "epi-test") {
      return ["mock access key", "mock access key2"];
    }
    return [];
  }
);

jest.spyOn(storage, "isStorageAccountNameAvailable").mockImplementation(
  async (accountName: string): Promise<boolean> => {
    if (accountName === "epi-test" || accountName === "epi-test-no-keys") {
      return false;
    }

    return true;
  }
);

let mockedDB: Array<
  | RowSrcToACRPipeline
  | RowACRToHLDPipeline
  | RowHLDToManifestPipeline
  | RowManifest
> = [];

jest.spyOn(deploymenttable, "findMatchingDeployments").mockImplementation(
  (): Promise<RowSrcToACRPipeline[]> => {
    const array: RowSrcToACRPipeline[] = [];
    return new Promise((resolve) => {
      mockedDB.forEach((row) => {
        if (row.p1 === "500") {
          array.push(row);
        }
      });
      resolve(array);
    });
  }
);

jest
  .spyOn(deploymenttable, "insertToTable")
  .mockImplementation(
    (
      tableInfo: deploymenttable.DeploymentTable,
      entry:
        | RowSrcToACRPipeline
        | RowACRToHLDPipeline
        | RowHLDToManifestPipeline
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Promise<any>((resolve) => {
        mockedDB.push(entry);
        resolve(entry);
      });
    }
  );

jest.spyOn(deploymenttable, "deleteFromTable").mockImplementation(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Promise<any>((resolve) => {
    if (mockedDB.length === 1 && mockedDB[0].p1 === "500") {
      mockedDB = [];
    }
    resolve(0);
  });
});

jest
  .spyOn(deploymenttable, "updateEntryInTable")
  .mockImplementation(
    (
      tableInfo: DeploymentTable,
      entry:
        | RowSrcToACRPipeline
        | RowACRToHLDPipeline
        | RowHLDToManifestPipeline
        | RowManifest
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Promise<any>((resolve) => {
        mockedDB.forEach((row, index: number) => {
          if (row.RowKey === entry.RowKey) {
            mockedDB[index] = entry;
            resolve(entry);
          }
        }, mockedDB);
      });
    }
  );

jest.spyOn(Math, "random").mockImplementation((): number => {
  return 0.5;
});

// Tests
beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("Validate deployment configuration", () => {
  test("valid deployment configuration", async () => {
    isValidConfig(mockedConfig);
  });
});

describe("test execute function", () => {
  it("positive test", async () => {
    jest
      .spyOn(validate, "isValidConfig")
      .mockReturnValueOnce(mockedValidateConfig);
    const exitFn = jest.fn();
    await execute(
      {
        selfTest: false,
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
  it("positive test with self test set", async () => {
    jest
      .spyOn(validate, "isValidConfig")
      .mockReturnValueOnce(mockedValidateConfig);
    jest.spyOn(validate, "runSelfTest").mockResolvedValueOnce();
    const exitFn = jest.fn();
    await execute(
      {
        selfTest: true,
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
  it("negative test with self test set", async () => {
    jest.spyOn(validate, "isValidConfig").mockImplementationOnce(() => {
      throw Error("error");
    });
    const exitFn = jest.fn();
    await execute(
      {
        selfTest: true,
      },
      exitFn
    );
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
});

describe("test runSelfTest function", () => {
  it("positive test", async () => {
    jest
      .spyOn(validate, "writeSelfTestData")
      .mockReturnValueOnce(Promise.resolve("buildId"));
    jest
      .spyOn(validate, "deleteSelfTestData")
      .mockReturnValueOnce(Promise.resolve(true));
    await runSelfTest(mockedValidateConfig);
  });
  it("negative test", async () => {
    jest
      .spyOn(validate, "writeSelfTestData")
      .mockReturnValueOnce(Promise.resolve("buildId"));
    jest.spyOn(validate, "deleteSelfTestData").mockResolvedValueOnce(false);

    const config = deepClone(mockedValidateConfig);
    config.tableName = "";
    await runSelfTest(config);
  });
  it("negative test: error thrown", async () => {
    jest
      .spyOn(validate, "writeSelfTestData")
      .mockReturnValueOnce(Promise.reject(new Error("error")));

    const config = deepClone(mockedValidateConfig);
    config.tableName = "";
    await expect(runSelfTest(config)).rejects.toThrow();
  });
});

describe("Validate missing deployment configuration", () => {
  test("no deployment configuration", async () => {
    const config: ConfigYaml = {
      introspection: undefined,
    };
    expect(() => {
      isValidConfig(config);
    }).toThrow();
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage", async () => {
    const config: ConfigYaml = {
      introspection: {
        azure: undefined,
      },
    };
    expect(() => {
      isValidConfig(config);
    }).toThrow();
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.account_name configuration", async () => {
    const config: ConfigYaml = {
      introspection: {
        azure: {
          account_name: undefined,
          key: uuid(),
        },
      },
    };
    expect(() => {
      isValidConfig(config);
    }).toThrow();
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.table_name configuration", async () => {
    const config: ConfigYaml = {
      introspection: {
        azure: {
          key: uuid(),
          table_name: undefined,
        },
      },
    };
    expect(() => {
      isValidConfig(config);
    }).toThrow();
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.partition_key configuration", async () => {
    const config: ConfigYaml = {
      introspection: {
        azure: {
          key: uuid(),
          partition_key: undefined,
        },
      },
    };
    expect(() => {
      isValidConfig(config);
    }).toThrow();
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.key configuration", async () => {
    const config: ConfigYaml = {
      introspection: {
        azure: {},
      },
    };
    expect(() => {
      isValidConfig(config);
    }).toThrow();
  });
});

describe("Validate missing deployment.pipeline configuration", () => {
  test("missing deployment.pipeline.org configuration", async () => {
    const config: ConfigYaml = {
      azure_devops: {
        org: undefined,
      },
      introspection: {
        azure: {},
      },
    };
    expect(() => {
      isValidConfig(config);
    }).toThrow();
  });
});

describe("Validate missing deployment.pipeline configuration", () => {
  test("missing deployment.pipeline.project configuration", async () => {
    const config: ConfigYaml = {
      azure_devops: {
        org: "org",
        project: undefined,
      },
      introspection: {
        azure: {},
      },
    };
    expect(() => {
      isValidConfig(config);
    }).toThrow();
  });
});

describe("Write self-test data", () => {
  it("should create a row key, add to storage", async () => {
    mockedDB = [];
    await writeSelfTestData(
      "test-key",
      "test-name",
      "test-partition-key",
      "test-table-name"
    );
    expect(mockedDB).toHaveLength(1);
    expect(mockedDB[0].p1).toBe("500");
    expect(mockedDB[0].service).toBe("spk-self-test");
  });
  it("negative test", async () => {
    jest
      .spyOn(deploymenttable, "addSrcToACRPipeline")
      .mockReturnValueOnce(Promise.reject(new Error("error")));
    await expect(
      writeSelfTestData(
        "test-key",
        "test-name",
        "test-partition-key",
        "test-table-name"
      )
    ).rejects.toThrow();
  });
});

describe("Delete self-test data", () => {
  it("should create a row key, add to storage and delete it", async () => {
    mockedDB = [];
    await writeSelfTestData(
      "test-key",
      "test-name",
      "test-partition-key",
      "test-table-name"
    );
    expect(mockedDB).toHaveLength(1);
    expect(mockedDB[0].p1).toBe("500");
    expect(mockedDB[0].service).toBe("spk-self-test");

    await deleteSelfTestData(
      "test-key",
      "test-name",
      "test-partition-key",
      "test-table-name",
      "500"
    );
    expect(mockedDB).toHaveLength(0);
  });
});
