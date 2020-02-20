import * as azure from "azure-storage";
import uuid from "uuid";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import * as deploymenttable from "./deploymenttable";
import {
  addNewRowToArcToHLDPipelines,
  addNewRowToHLDtoManifestPipeline,
  addSrcToACRPipeline,
  deleteFromTable,
  findMatchingDeployments,
  getTableService,
  IDeploymentTable,
  IEntryACRToHLDPipeline,
  insertToTable,
  IRowHLDToManifestPipeline,
  IRowManifest,
  updateACRToHLDPipeline,
  updateEntryInTable,
  updateHLDtoManifestEntry,
  updateHLDtoManifestHelper,
  updateHLDToManifestPipeline,
  updateLastHLDtoManifestEntry,
  updateLastRowOfArcToHLDPipelines,
  updateManifestCommitId,
  updateMatchingArcToHLDPipelineEntry
} from "./deploymenttable";

const mockedTableInfo: IDeploymentTable = {
  accountKey: Buffer.from(uuid()).toString("base64"),
  accountName: uuid(),
  partitionKey: uuid(),
  tableName: uuid()
};
const mockedPipelineId = uuid();
const mockedPipelineId2 = uuid();
const mockedPipelineId3 = uuid();
const mockedImageTag = uuid();
const mockedServiceName = uuid();
const mockedCommitId = uuid();
const mockedHldCommitId = uuid();
const mockedEnv = uuid();
const mockedPr = uuid();
const mockedManifestCommitId = uuid();

const mockedEntryACRPipeline: deploymenttable.IEntrySRCToACRPipeline = {
  PartitionKey: uuid(),
  RowKey: uuid(),
  commitId: mockedCommitId,
  env: {
    _: mockedEnv
  },
  imageTag: mockedImageTag,
  p1: {
    _: mockedPipelineId
  },
  service: mockedServiceName
};

const mockedEntryACRToHLDPipeline = {
  PartitionKey: uuid(),
  RowKey: uuid(),
  commitId: mockedCommitId,
  env: {
    _: mockedEnv
  },
  hldCommitId: {
    _: mockedHldCommitId
  },
  imageTag: mockedImageTag,
  p1: mockedPipelineId,
  p2: {
    _: mockedPipelineId
  },
  service: mockedServiceName
};

const mockedNonMatchEntryACRToHLDPipeline = {
  PartitionKey: uuid(),
  RowKey: uuid(),
  commitId: mockedCommitId,
  env: {
    _: mockedEnv
  },
  hldCommitId: {
    _: mockedHldCommitId
  },
  imageTag: mockedImageTag,
  p1: mockedPipelineId,
  p2: {
    _: uuid()
  },
  service: mockedServiceName
};

const mockedRowACRToHLDPipeline = {
  PartitionKey: uuid(),
  RowKey: uuid(),
  commitId: mockedCommitId,
  env: mockedEnv,
  hldCommitId: mockedHldCommitId,
  imageTag: mockedImageTag,
  p1: mockedPipelineId,
  p2: mockedPipelineId2,
  pr: mockedPr,
  service: mockedServiceName
};

const mockedRowHLDToManifestPipeline = Object.assign(
  {
    manifestCommitId: mockedManifestCommitId,
    p3: mockedPipelineId3
  },
  mockedRowACRToHLDPipeline
) as IRowHLDToManifestPipeline;

const mockedEntryHLDToManifestPipeline = {
  PartitionKey: uuid(),
  RowKey: uuid(),
  commitId: mockedCommitId,
  env: mockedEnv,
  hldCommitId: mockedHldCommitId,
  imageTag: mockedImageTag,
  manifestCommitId: {
    _: mockedManifestCommitId
  },
  p1: mockedPipelineId,
  p2: mockedPipelineId2,
  p3: {
    _: mockedPipelineId3
  },
  service: mockedServiceName
};

const mockedManifestRow: IRowManifest = Object.assign(
  {
    manifestCommitId: uuid()
  },
  mockedRowHLDToManifestPipeline
);

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("test findMatchingDeployments function", () => {
  it("catching exception", async done => {
    await expect(
      findMatchingDeployments(mockedTableInfo, "", "")
    ).rejects.toThrow();
    done();
  });
});

describe("test table operation functions", () => {
  it("catching exception", async done => {
    await expect(
      insertToTable(mockedTableInfo, mockedEntryACRToHLDPipeline)
    ).rejects.toThrow();
    await expect(
      deleteFromTable(mockedTableInfo, mockedEntryACRPipeline)
    ).rejects.toThrow();
    await expect(
      updateEntryInTable(mockedTableInfo, mockedEntryACRToHLDPipeline)
    ).rejects.toThrow();
    done();
  });
});

describe("test getTableService function", () => {
  it("sanity test", () => {
    const result = getTableService(mockedTableInfo);
    expect(result).toBeDefined();
  });
});

describe("test addSrcToACRPipeline function", () => {
  it("positive test", async done => {
    jest
      .spyOn(deploymenttable, "insertToTable")
      .mockReturnValueOnce(Promise.resolve());
    const entry = await addSrcToACRPipeline(
      mockedTableInfo,
      mockedPipelineId,
      mockedImageTag,
      mockedServiceName,
      mockedCommitId
    );
    expect(entry.commitId).toBe(mockedCommitId);
    expect(entry.p1).toBe(mockedPipelineId);
    expect(entry.service).toBe(mockedServiceName);
    expect(entry.imageTag).toBe(mockedImageTag);
    done();
  });
  it("negative test", async done => {
    jest
      .spyOn(deploymenttable, "insertToTable")
      .mockReturnValueOnce(Promise.reject(new Error("Error")));
    await expect(
      addSrcToACRPipeline(
        mockedTableInfo,
        mockedPipelineId,
        mockedImageTag,
        mockedServiceName,
        mockedCommitId
      )
    ).rejects.toThrow();
    done();
  });
});

describe("test updateMatchingArcToHLDPipelineEntry function", () => {
  it("positive test: matching entry", async done => {
    jest
      .spyOn(deploymenttable, "updateEntryInTable")
      .mockReturnValueOnce(Promise.resolve());
    const entries: IEntryACRToHLDPipeline[] = [mockedEntryACRToHLDPipeline];
    const result = await updateMatchingArcToHLDPipelineEntry(
      entries,
      mockedTableInfo,
      mockedPipelineId,
      mockedImageTag,
      mockedHldCommitId,
      mockedEnv,
      mockedPr
    );
    expect(result).toBeDefined();
    done();
  });
  it("positive test: no matching entries", async done => {
    const result = await updateMatchingArcToHLDPipelineEntry(
      [],
      mockedTableInfo,
      mockedPipelineId,
      mockedImageTag,
      mockedHldCommitId,
      mockedEnv,
      mockedPr
    );
    expect(result).toBeNull();
    done();
  });
});

const mockInsertIntoTable = (positive = true) => {
  if (positive) {
    jest
      .spyOn(deploymenttable, "insertToTable")
      .mockReturnValueOnce(Promise.resolve());
  } else {
    jest
      .spyOn(deploymenttable, "insertToTable")
      .mockReturnValueOnce(Promise.reject(new Error("fake")));
  }
};

const testUpdateLastRowOfArcToHLDPipelines = async (positive = true) => {
  mockInsertIntoTable(positive);
  const entries: IEntryACRToHLDPipeline[] = [mockedEntryACRToHLDPipeline];
  return await updateLastRowOfArcToHLDPipelines(
    entries,
    mockedTableInfo,
    mockedPipelineId,
    mockedImageTag,
    mockedHldCommitId,
    mockedEnv,
    mockedPr
  );
};

describe("test updateLastRowOfArcToHLDPipelines function", () => {
  it("positive test", async done => {
    const result = await testUpdateLastRowOfArcToHLDPipelines();
    expect(result).toBeDefined();
    done();
  });
  it("negative test", async done => {
    await expect(testUpdateLastRowOfArcToHLDPipelines(false)).rejects.toThrow();
    done();
  });
});

const testAddNewRowToArcToHLDPipelines = async (positive = true) => {
  mockInsertIntoTable(positive);

  return await addNewRowToArcToHLDPipelines(
    mockedTableInfo,
    mockedPipelineId,
    mockedImageTag,
    mockedHldCommitId,
    mockedEnv,
    mockedPr
  );
};

describe("test addNewRowToArcToHLDPipelines function", () => {
  it("positive test", async done => {
    const result = await testAddNewRowToArcToHLDPipelines();
    expect(result).toBeDefined();
    done();
  });
  it("negative test", async done => {
    await expect(testAddNewRowToArcToHLDPipelines(false)).rejects.toThrow();
    done();
  });
});

const testUpdateACRToHLDPipeline = async (
  noEntry: boolean,
  matched: boolean
) => {
  const fnUpdateFound = jest.spyOn(
    deploymenttable,
    "updateMatchingArcToHLDPipelineEntry"
  );
  const fnUpdateLastEntry = jest.spyOn(
    deploymenttable,
    "updateLastRowOfArcToHLDPipelines"
  );
  const addNewRow = jest.spyOn(deploymenttable, "addNewRowToArcToHLDPipelines");

  if (noEntry) {
    jest
      .spyOn(deploymenttable, "findMatchingDeployments")
      .mockReturnValueOnce(Promise.resolve([]));
    addNewRow.mockReturnValueOnce(Promise.resolve(mockedRowACRToHLDPipeline));
  } else {
    if (matched) {
      jest
        .spyOn(deploymenttable, "findMatchingDeployments")
        .mockReturnValueOnce(Promise.resolve([mockedEntryACRToHLDPipeline]));
      fnUpdateFound.mockReturnValueOnce(
        Promise.resolve(mockedRowACRToHLDPipeline)
      );
    } else {
      jest
        .spyOn(deploymenttable, "findMatchingDeployments")
        .mockReturnValueOnce(
          Promise.resolve([mockedNonMatchEntryACRToHLDPipeline])
        );
      fnUpdateFound.mockReturnValueOnce(Promise.resolve(null));
      fnUpdateLastEntry.mockReturnValueOnce(
        Promise.resolve(mockedRowACRToHLDPipeline)
      );
    }
  }

  await updateACRToHLDPipeline(
    mockedTableInfo,
    mockedPipelineId,
    mockedImageTag,
    mockedHldCommitId,
    mockedEnv,
    mockedPr
  );

  if (noEntry) {
    expect(fnUpdateFound).toBeCalledTimes(0);
    expect(fnUpdateLastEntry).toBeCalledTimes(0);
    expect(addNewRow).toBeCalledTimes(1);
  } else {
    expect(fnUpdateFound).toBeCalledTimes(1);
    expect(addNewRow).toBeCalledTimes(0);

    if (matched) {
      expect(fnUpdateLastEntry).toBeCalledTimes(0);
    } else {
      expect(fnUpdateLastEntry).toBeCalledTimes(1);
    }
  }

  fnUpdateFound.mockReset();
  fnUpdateLastEntry.mockReset();
  addNewRow.mockReset();
};

describe("test updateACRToHLDPipeline function", () => {
  it("positive test: matching entry", async done => {
    await testUpdateACRToHLDPipeline(false, true);
    done();
  });
  it("positive test: no matching entries", async done => {
    await testUpdateACRToHLDPipeline(false, false);
    done();
  });
  it("positive test: no entries returned", async done => {
    await testUpdateACRToHLDPipeline(true, false);
    done();
  });
});

const testUpdateHLDToManifestPipeline = async (matchEntries = true) => {
  const findFnuc = jest.spyOn(deploymenttable, "findMatchingDeployments");
  findFnuc.mockReset();

  if (matchEntries) {
    findFnuc.mockReturnValueOnce(
      Promise.resolve([mockedEntryHLDToManifestPipeline])
    );
  } else {
    findFnuc.mockReturnValueOnce(Promise.resolve([]));
    findFnuc.mockReturnValueOnce(
      Promise.resolve([mockedEntryHLDToManifestPipeline])
    );
  }

  const fn = jest.spyOn(deploymenttable, "updateHLDtoManifestHelper");
  fn.mockReturnValueOnce(Promise.resolve(mockedRowHLDToManifestPipeline));

  const res = await updateHLDToManifestPipeline(
    mockedTableInfo,
    mockedHldCommitId,
    mockedPipelineId,
    mockedManifestCommitId,
    mockedPr
  );
  expect(res).toBeDefined();
  expect(fn).toBeCalledTimes(1);
  expect(findFnuc).toBeCalledTimes(matchEntries ? 1 : 2);
  fn.mockClear();
  findFnuc.mockClear();
};

describe("test updateHLDToManifestPipeline function", () => {
  it("positive test: matching hldCommitId entry", async done => {
    await testUpdateHLDToManifestPipeline();
    done();
  });
  it("positive test: matching pr entry", async done => {
    await testUpdateHLDToManifestPipeline(false);
    done();
  });
});

describe("test updateHLDtoManifestEntry function", () => {
  it("positive test", async done => {
    jest
      .spyOn(deploymenttable, "updateEntryInTable")
      .mockReturnValueOnce(Promise.resolve());

    const res = await updateHLDtoManifestEntry(
      [mockedEntryHLDToManifestPipeline],
      mockedTableInfo,
      mockedHldCommitId,
      mockedPipelineId3,
      mockedManifestCommitId,
      mockedPr
    );
    expect(res).toBeDefined();
    done();
  });
  it("negative test", async done => {
    const res = await updateHLDtoManifestEntry(
      [mockedEntryHLDToManifestPipeline],
      mockedTableInfo,
      mockedHldCommitId,
      mockedPipelineId2,
      mockedManifestCommitId,
      mockedPr
    );
    expect(res).toBeNull();
    done();
  });
  it("negative test: exception thrown", async done => {
    const fn = jest.spyOn(deploymenttable, "updateEntryInTable");
    fn.mockReturnValueOnce(Promise.reject(new Error("Fake")));

    await expect(
      updateHLDtoManifestEntry(
        [mockedEntryHLDToManifestPipeline],
        mockedTableInfo,
        mockedHldCommitId,
        mockedPipelineId3,
        mockedManifestCommitId,
        mockedPr
      )
    ).rejects.toThrow();
    done();
  });
});

describe("test updateLastHLDtoManifestEntry function", () => {
  it("positive test", async done => {
    jest
      .spyOn(deploymenttable, "insertToTable")
      .mockReturnValueOnce(Promise.resolve());

    const res = await updateLastHLDtoManifestEntry(
      [mockedEntryHLDToManifestPipeline],
      mockedTableInfo,
      mockedHldCommitId,
      mockedPipelineId3,
      mockedManifestCommitId,
      mockedPr
    );
    expect(res).toBeDefined();
    done();
  });
  it("negative test: exeption thrown", async done => {
    jest
      .spyOn(deploymenttable, "insertToTable")
      .mockReturnValueOnce(Promise.reject(new Error("Fake")));

    await expect(
      updateLastHLDtoManifestEntry(
        [mockedEntryHLDToManifestPipeline],
        mockedTableInfo,
        mockedHldCommitId,
        mockedPipelineId3,
        mockedManifestCommitId,
        mockedPr
      )
    ).rejects.toThrow();
    done();
  });
});

describe("test addNewRowToHLDtoManifestPipeline function", () => {
  it("positive test", async done => {
    jest
      .spyOn(deploymenttable, "insertToTable")
      .mockReturnValueOnce(Promise.resolve());
    const res = await addNewRowToHLDtoManifestPipeline(
      mockedTableInfo,
      mockedHldCommitId,
      mockedPipelineId3,
      mockedManifestCommitId,
      mockedPr
    );
    expect(res).toBeDefined();
    done();
  });
  it("nagative test", async done => {
    jest
      .spyOn(deploymenttable, "insertToTable")
      .mockReturnValueOnce(Promise.reject(new Error("Fake")));
    await expect(
      addNewRowToHLDtoManifestPipeline(
        mockedTableInfo,
        mockedHldCommitId,
        mockedPipelineId3,
        mockedManifestCommitId,
        mockedPr
      )
    ).rejects.toThrow();
    done();
  });
});

const testUpdateHLDtoManifestHelper = async (
  empty: boolean,
  match: boolean
) => {
  const updateFn = jest.spyOn(deploymenttable, "updateHLDtoManifestEntry");
  const updateLastFn = jest.spyOn(
    deploymenttable,
    "updateLastHLDtoManifestEntry"
  );
  const addFn = jest.spyOn(deploymenttable, "addNewRowToHLDtoManifestPipeline");

  if (empty) {
    addFn.mockReturnValueOnce(Promise.resolve(mockedRowHLDToManifestPipeline));
  } else {
    if (match) {
      updateFn.mockReturnValueOnce(
        Promise.resolve(mockedRowHLDToManifestPipeline)
      );
    } else {
      updateFn.mockReturnValueOnce(Promise.resolve(null));
      updateLastFn.mockReturnValueOnce(
        Promise.resolve(mockedRowHLDToManifestPipeline)
      );
    }
  }

  const entries = empty ? [] : [mockedEntryHLDToManifestPipeline];
  const res = await updateHLDtoManifestHelper(
    entries,
    mockedTableInfo,
    mockedHldCommitId,
    mockedPipelineId3,
    mockedManifestCommitId,
    mockedPr
  );
  expect(res).toEqual(mockedRowHLDToManifestPipeline);

  if (empty) {
    expect(updateFn).toBeCalledTimes(0);
    expect(updateLastFn).toBeCalledTimes(0);
    expect(addFn).toBeCalledTimes(1);
  } else {
    expect(updateFn).toBeCalledTimes(1);
    expect(addFn).toBeCalledTimes(0);
    if (match) {
      expect(updateLastFn).toBeCalledTimes(0);
    } else {
      expect(updateLastFn).toBeCalledTimes(1);
    }
  }

  updateFn.mockReset();
  updateLastFn.mockReset();
  addFn.mockReset();
};

describe("test updateHLDtoManifestHelper function", () => {
  it("positive test: matching entry", async done => {
    await testUpdateHLDtoManifestHelper(false, true);
    done();
  });
  it("positive test: no matching entries", async done => {
    await testUpdateHLDtoManifestHelper(false, false);
    done();
  });
  it("positive test: empty entries", async done => {
    await testUpdateHLDtoManifestHelper(true, false);
    done();
  });
});

describe("test updateManifestCommitId function", () => {
  it("positive test", async done => {
    jest
      .spyOn(deploymenttable, "updateEntryInTable")
      .mockReturnValueOnce(Promise.resolve());
    jest
      .spyOn(deploymenttable, "findMatchingDeployments")
      .mockReturnValueOnce(Promise.resolve([mockedManifestRow]));
    const res = await updateManifestCommitId(
      mockedTableInfo,
      mockedPipelineId3,
      mockedManifestCommitId
    );
    expect(res).toBeDefined();
    done();
  });
  it("negative test", async done => {
    jest
      .spyOn(deploymenttable, "findMatchingDeployments")
      .mockReturnValueOnce(Promise.resolve([]));
    await expect(
      updateManifestCommitId(
        mockedTableInfo,
        mockedPipelineId3,
        mockedManifestCommitId
      )
    ).rejects.toThrow();
    done();
  });
});
