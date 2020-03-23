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
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { ConfigYaml } from "../../types";
import {
  deleteSelfTestData,
  execute,
  isValidConfig,
  runSelfTest,
  writeSelfTestData,
} from "./validate";
import * as validate from "./validate";

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
    const config: ConfigYaml = {
      azure_devops: {
        org: uuid(),
        project: uuid(),
      },
      introspection: {
        azure: {
          account_name: uuid(),
          key: uuid(),
          partition_key: uuid(),
          table_name: uuid(),
        },
      },
    };
    await isValidConfig(config);
  });
});

describe("test execute function", () => {
  it("positive test", async () => {
    jest
      .spyOn(validate, "isValidConfig")
      .mockReturnValueOnce(Promise.resolve());
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
      .mockReturnValueOnce(Promise.resolve());
    jest.spyOn(validate, "runSelfTest").mockReturnValueOnce(Promise.resolve());
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
    jest
      .spyOn(validate, "isValidConfig")
      .mockReturnValueOnce(Promise.reject(new Error("error")));
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

    const config: ConfigYaml = {
      introspection: {
        azure: {
          key: uuid(),
          table_name: undefined,
        },
      },
    };

    await runSelfTest(config);
  });
  it("negative test", async () => {
    jest
      .spyOn(validate, "writeSelfTestData")
      .mockReturnValueOnce(Promise.resolve("buildId"));
    jest
      .spyOn(validate, "deleteSelfTestData")
      .mockReturnValueOnce(Promise.resolve(false));

    const config: ConfigYaml = {
      introspection: {
        azure: {
          key: uuid(),
          table_name: undefined,
        },
      },
    };
    await runSelfTest(config);
  });
  it("negative test: error thrown", async () => {
    jest
      .spyOn(validate, "writeSelfTestData")
      .mockReturnValueOnce(Promise.reject(new Error("error")));

    const config: ConfigYaml = {
      introspection: {
        azure: {
          key: uuid(),
          table_name: undefined,
        },
      },
    };
    await expect(runSelfTest(config)).rejects.toThrow();
  });
});

describe("Validate missing deployment configuration", () => {
  test("no deployment configuration", async () => {
    const config: ConfigYaml = {
      introspection: undefined,
    };
    await expect(isValidConfig(config)).rejects.toThrow();
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage", async () => {
    const config: ConfigYaml = {
      introspection: {
        azure: undefined,
      },
    };
    await expect(isValidConfig(config)).rejects.toThrow();
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
    await expect(isValidConfig(config)).rejects.toThrow();
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
    await expect(isValidConfig(config)).rejects.toThrow();
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
    await expect(isValidConfig(config)).rejects.toThrow();
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.key configuration", async () => {
    const config: ConfigYaml = {
      introspection: {
        azure: {},
      },
    };
    await expect(isValidConfig(config)).rejects.toThrow();
  });
});

describe("Validate missing deployment.pipeline configuration", () => {
  test("missing deployment.pipeline configuration", async () => {
    const config: ConfigYaml = {
      introspection: {
        azure: {},
      },
    };
    await expect(isValidConfig(config)).rejects.toThrow();
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
    await expect(isValidConfig(config)).rejects.toThrow();
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
    await expect(isValidConfig(config)).rejects.toThrow();
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
