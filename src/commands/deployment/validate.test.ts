// imports
import { StorageManagementClient } from "@azure/arm-storage";
import uuid from "uuid/v4";
import * as deploymenttable from "../../lib/azure/deploymenttable";
import {
  IDeploymentTable,
  IEntrySRCToACRPipeline,
  IRowACRToHLDPipeline,
  IRowHLDToManifestPipeline,
  IRowManifest,
  IRowSrcToACRPipeline
} from "../../lib/azure/deploymenttable";
import * as storage from "../../lib/azure/storage";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { IAzureAccessOpts, IConfigYaml } from "../../types";
import {
  deleteSelfTestData,
  execute,
  isValidConfig,
  runSelfTest,
  writeSelfTestData
} from "./validate";
import * as validate from "./validate";

jest.spyOn(storage, "getStorageManagementClient").mockImplementation(
  async (opts: IAzureAccessOpts = {}): Promise<any> => {
    return undefined;
  }
);

jest.spyOn(storage, "getStorageAccountKeys").mockImplementation(
  async (accountName: string, resourceGroup: string): Promise<string[]> => {
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
  | IRowSrcToACRPipeline
  | IRowACRToHLDPipeline
  | IRowHLDToManifestPipeline
  | IRowManifest
> = [];

jest.spyOn(deploymenttable, "findMatchingDeployments").mockImplementation(
  (
    tableInfo: deploymenttable.IDeploymentTable,
    filterName: string,
    filterValue: string
  ): Promise<IRowSrcToACRPipeline[]> => {
    const array: IRowSrcToACRPipeline[] = [];
    return new Promise(resolve => {
      mockedDB.forEach(row => {
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
      tableInfo: deploymenttable.IDeploymentTable,
      entry:
        | IRowSrcToACRPipeline
        | IRowACRToHLDPipeline
        | IRowHLDToManifestPipeline
    ) => {
      return new Promise(resolve => {
        mockedDB.push(entry);
        resolve(entry);
      });
    }
  );

jest
  .spyOn(deploymenttable, "deleteFromTable")
  .mockImplementation(
    (
      tableInfo: deploymenttable.IDeploymentTable,
      entry: IEntrySRCToACRPipeline
    ) => {
      return new Promise(resolve => {
        if (mockedDB.length === 1 && mockedDB[0].p1 === "500") {
          mockedDB = [];
        }
        resolve(0);
      });
    }
  );

jest
  .spyOn(deploymenttable, "updateEntryInTable")
  .mockImplementation(
    (
      tableInfo: IDeploymentTable,
      entry:
        | IRowSrcToACRPipeline
        | IRowACRToHLDPipeline
        | IRowHLDToManifestPipeline
        | IRowManifest
    ) => {
      return new Promise(resolve => {
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
    const config: IConfigYaml = {
      azure_devops: {
        org: uuid(),
        project: uuid()
      },
      introspection: {
        azure: {
          account_name: uuid(),
          key: Promise.resolve(uuid()),
          partition_key: uuid(),
          table_name: uuid()
        }
      }
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
        selfTest: false
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
        selfTest: true
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
        selfTest: true
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

    const config: IConfigYaml = {
      introspection: {
        azure: {
          key: Promise.resolve(uuid()),
          table_name: undefined
        }
      }
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

    const config: IConfigYaml = {
      introspection: {
        azure: {
          key: Promise.resolve(uuid()),
          table_name: undefined
        }
      }
    };
    await runSelfTest(config);
  });
  it("negative test: error thrown", async () => {
    jest
      .spyOn(validate, "writeSelfTestData")
      .mockReturnValueOnce(Promise.reject(new Error("error")));

    const config: IConfigYaml = {
      introspection: {
        azure: {
          key: Promise.resolve(uuid()),
          table_name: undefined
        }
      }
    };
    await expect(runSelfTest(config)).rejects.toThrow();
  });
});

describe("Validate missing deployment configuration", () => {
  test("no deployment configuration", async () => {
    const config: IConfigYaml = {
      introspection: undefined
    };
    await expect(isValidConfig(config)).rejects.toThrow();
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage", async () => {
    const config: IConfigYaml = {
      introspection: {
        azure: undefined
      }
    };
    await expect(isValidConfig(config)).rejects.toThrow();
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.account_name configuration", async () => {
    const config: IConfigYaml = {
      introspection: {
        azure: {
          account_name: undefined,
          key: Promise.resolve(uuid())
        }
      }
    };
    await expect(isValidConfig(config)).rejects.toThrow();
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.table_name configuration", async () => {
    const config: IConfigYaml = {
      introspection: {
        azure: {
          key: Promise.resolve(uuid()),
          table_name: undefined
        }
      }
    };
    await expect(isValidConfig(config)).rejects.toThrow();
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.partition_key configuration", async () => {
    const config: IConfigYaml = {
      introspection: {
        azure: {
          key: Promise.resolve(uuid()),
          partition_key: undefined
        }
      }
    };
    await expect(isValidConfig(config)).rejects.toThrow();
  });
});

describe("Validate missing deployment.storage configuration", () => {
  test("missing deployment.storage.key configuration", async () => {
    const config: IConfigYaml = {
      introspection: {
        azure: {
          key: Promise.resolve(undefined)
        }
      }
    };
    await expect(isValidConfig(config)).rejects.toThrow();
  });
});

describe("Validate missing deployment.pipeline configuration", () => {
  test("missing deployment.pipeline configuration", async () => {
    const config: IConfigYaml = {
      introspection: {
        azure: {
          key: Promise.resolve(undefined)
        }
      }
    };
    await expect(isValidConfig(config)).rejects.toThrow();
  });
});

describe("Validate missing deployment.pipeline configuration", () => {
  test("missing deployment.pipeline.org configuration", async () => {
    const config: IConfigYaml = {
      azure_devops: {
        org: undefined
      },
      introspection: {
        azure: {
          key: Promise.resolve(undefined)
        }
      }
    };
    await expect(isValidConfig(config)).rejects.toThrow();
  });
});

describe("Validate missing deployment.pipeline configuration", () => {
  test("missing deployment.pipeline.project configuration", async () => {
    const config: IConfigYaml = {
      azure_devops: {
        org: "org",
        project: undefined
      },
      introspection: {
        azure: {
          key: Promise.resolve(undefined)
        }
      }
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
