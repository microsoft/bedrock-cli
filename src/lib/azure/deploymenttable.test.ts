import uuid from "uuid";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import * as deploymenttable from "./deploymenttable";
import {
  addNewRowToACRToHLDPipelines,
  addNewRowToHLDtoManifestPipeline,
  addSrcToACRPipeline,
  deleteFromTable,
  findMatchingDeployments,
  getTableService,
  DeploymentTable,
  DeploymentEntry,
  insertToTable,
  updateACRToHLDPipeline,
  updateEntryInTable,
  updateHLDtoManifestEntry,
  updateHLDtoManifestHelper,
  updateHLDToManifestPipeline,
  updateManifestCommitId,
  updateMatchingACRToHLDPipelineEntry,
} from "./deploymenttable";

const mockedTableInfo: DeploymentTable = {
  accountKey: Buffer.from(uuid()).toString("base64"),
  accountName: uuid(),
  partitionKey: uuid(),
  tableName: uuid(),
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
const mockedRepository = uuid();

const mockedEntryACRPipeline: DeploymentEntry = {
  PartitionKey: uuid(),
  RowKey: uuid(),
  commitId: mockedCommitId,
  env: mockedEnv,
  imageTag: mockedImageTag,
  p1: mockedPipelineId,
  service: mockedServiceName,
};

const mockedEntryACRToHLDPipeline: DeploymentEntry = {
  PartitionKey: uuid(),
  RowKey: uuid(),
  commitId: mockedCommitId,
  env: mockedEnv,
  hldCommitId: mockedHldCommitId,
  imageTag: mockedImageTag,
  p1: mockedPipelineId,
  p2: mockedPipelineId,
  service: mockedServiceName,
};

const mockedNonMatchEntryACRToHLDPipeline: DeploymentEntry = {
  PartitionKey: uuid(),
  RowKey: uuid(),
  commitId: mockedCommitId,
  env: mockedEnv,
  hldCommitId: mockedHldCommitId,
  imageTag: mockedImageTag,
  p1: mockedPipelineId,
  p2: uuid(),
  service: mockedServiceName,
};

const mockedRowACRToHLDPipeline: DeploymentEntry = {
  PartitionKey: uuid(),
  RowKey: uuid(),
  commitId: mockedCommitId,
  env: mockedEnv,
  hldCommitId: mockedHldCommitId,
  imageTag: mockedImageTag,
  p1: mockedPipelineId,
  p2: mockedPipelineId2,
  pr: mockedPr,
  service: mockedServiceName,
};

const mockedRowHLDToManifestPipeline = Object.assign(
  {
    manifestCommitId: mockedManifestCommitId,
    p3: mockedPipelineId3,
  },
  mockedRowACRToHLDPipeline
) as DeploymentEntry;

const mockedEntryHLDToManifestPipeline: DeploymentEntry = {
  PartitionKey: uuid(),
  RowKey: uuid(),
  commitId: mockedCommitId,
  env: mockedEnv,
  hldCommitId: mockedHldCommitId,
  imageTag: mockedImageTag,
  manifestCommitId: mockedManifestCommitId,
  p1: mockedPipelineId,
  p2: mockedPipelineId2,
  p3: mockedPipelineId3,
  service: mockedServiceName,
};

const mockedManifestRow: DeploymentEntry = Object.assign(
  {
    manifestCommitId: uuid(),
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
  it("catching exception", async (done) => {
    await expect(
      findMatchingDeployments(mockedTableInfo, "", "")
    ).rejects.toThrow();
    done();
  });
});

describe("test table operation functions", () => {
  it("catching exception", async (done) => {
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
  it("positive test", async (done) => {
    jest
      .spyOn(deploymenttable, "insertToTable")
      .mockReturnValueOnce(Promise.resolve());
    const entry = await addSrcToACRPipeline(
      mockedTableInfo,
      mockedPipelineId,
      mockedImageTag,
      mockedServiceName,
      mockedCommitId,
      mockedRepository
    );
    expect(entry.commitId).toBe(mockedCommitId);
    expect(entry.p1).toBe(mockedPipelineId);
    expect(entry.service).toBe(mockedServiceName);
    expect(entry.imageTag).toBe(mockedImageTag);
    done();
  });
  it("negative test", async (done) => {
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

describe("test updateMatchingACRToHLDPipelineEntry function", () => {
  it("positive test: matching entry", async (done) => {
    jest
      .spyOn(deploymenttable, "updateEntryInTable")
      .mockReturnValueOnce(Promise.resolve());
    const entries: DeploymentEntry[] = [mockedEntryACRToHLDPipeline];
    const result = await updateMatchingACRToHLDPipelineEntry(
      entries,
      mockedTableInfo,
      mockedPipelineId,
      mockedImageTag,
      mockedHldCommitId,
      mockedEnv,
      mockedPr,
      mockedRepository
    );
    expect(result).toBeDefined();
    done();
  });
  it("positive test: no matching entries", async (done) => {
    const result = await updateMatchingACRToHLDPipelineEntry(
      [],
      mockedTableInfo,
      mockedPipelineId,
      mockedImageTag,
      mockedHldCommitId,
      mockedEnv,
      mockedPr,
      mockedRepository
    );
    expect(result).toBeNull();
    done();
  });
});

const mockInsertIntoTable = (positive = true): void => {
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

const testAddNewRowToACRToHLDPipelinesWithSimilarEntry = async (
  positive = true
): Promise<deploymenttable.DeploymentEntry> => {
  mockInsertIntoTable(positive);
  const entries: DeploymentEntry[] = [mockedEntryACRToHLDPipeline];
  return await addNewRowToACRToHLDPipelines(
    mockedTableInfo,
    mockedPipelineId,
    mockedImageTag,
    mockedHldCommitId,
    mockedEnv,
    mockedPr,
    mockedRepository,
    entries[entries.length - 1]
  );
};

describe("test addNewRowToACRToHLDPipelines function with similar", () => {
  it("positive test", async (done) => {
    const result = await testAddNewRowToACRToHLDPipelinesWithSimilarEntry();
    expect(result).toBeDefined();
    done();
  });
  it("negative test", async (done) => {
    await expect(
      testAddNewRowToACRToHLDPipelinesWithSimilarEntry(false)
    ).rejects.toThrow();
    done();
  });
});

const testAddNewRowToACRToHLDPipelines = async (
  positive = true
): Promise<deploymenttable.DeploymentEntry> => {
  mockInsertIntoTable(positive);

  return await addNewRowToACRToHLDPipelines(
    mockedTableInfo,
    mockedPipelineId,
    mockedImageTag,
    mockedHldCommitId,
    mockedEnv,
    mockedPr
  );
};

describe("test addNewRowToACRToHLDPipelines function", () => {
  it("positive test", async (done) => {
    const result = await testAddNewRowToACRToHLDPipelines();
    expect(result).toBeDefined();
    done();
  });
  it("negative test", async (done) => {
    await expect(testAddNewRowToACRToHLDPipelines(false)).rejects.toThrow();
    done();
  });
});

const testUpdateACRToHLDPipeline = async (
  noEntry: boolean,
  matched: boolean
): Promise<void> => {
  const fnUpdateFound = jest.spyOn(
    deploymenttable,
    "updateMatchingACRToHLDPipelineEntry"
  );
  const addNewRow = jest.spyOn(deploymenttable, "addNewRowToACRToHLDPipelines");

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
    }
  }

  await updateACRToHLDPipeline(
    mockedTableInfo,
    mockedPipelineId,
    mockedImageTag,
    mockedHldCommitId,
    mockedEnv,
    mockedPr,
    mockedRepository
  );

  if (noEntry) {
    expect(fnUpdateFound).toBeCalledTimes(0);
    expect(addNewRow).toBeCalledTimes(1);
  } else {
    expect(fnUpdateFound).toBeCalledTimes(1);

    if (matched) {
      expect(addNewRow).toBeCalledTimes(0);
    } else {
      expect(addNewRow).toBeCalledTimes(1);
    }
  }

  fnUpdateFound.mockReset();
  addNewRow.mockReset();
};

describe("test updateACRToHLDPipeline function", () => {
  it("positive test: matching entry", async (done) => {
    await testUpdateACRToHLDPipeline(false, true);
    done();
  });
  it("positive test: no matching entries", async (done) => {
    await testUpdateACRToHLDPipeline(false, false);
    done();
  });
  it("positive test: no entries returned", async (done) => {
    await testUpdateACRToHLDPipeline(true, false);
    done();
  });
});

const testUpdateHLDToManifestPipeline = async (
  matchEntries = true
): Promise<void> => {
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
  it("positive test: matching hldCommitId entry", async (done) => {
    await testUpdateHLDToManifestPipeline();
    done();
  });
  it("positive test: matching pr entry", async (done) => {
    await testUpdateHLDToManifestPipeline(false);
    done();
  });
});

describe("test updateHLDtoManifestEntry function", () => {
  it("positive test", async (done) => {
    jest
      .spyOn(deploymenttable, "updateEntryInTable")
      .mockReturnValueOnce(Promise.resolve());

    const res = await updateHLDtoManifestEntry(
      [mockedEntryHLDToManifestPipeline],
      mockedTableInfo,
      mockedHldCommitId,
      mockedPipelineId3,
      mockedManifestCommitId,
      mockedPr,
      mockedRepository
    );
    expect(res).toBeDefined();
    done();
  });
  it("negative test", async (done) => {
    const res = await updateHLDtoManifestEntry(
      [mockedEntryHLDToManifestPipeline],
      mockedTableInfo,
      mockedHldCommitId,
      mockedPipelineId2,
      mockedManifestCommitId,
      mockedPr,
      mockedRepository
    );
    expect(res).toBeNull();
    done();
  });
  it("negative test: exception thrown", async (done) => {
    const fn = jest.spyOn(deploymenttable, "updateEntryInTable");
    fn.mockReturnValueOnce(Promise.reject(new Error("Fake")));

    await expect(
      updateHLDtoManifestEntry(
        [mockedEntryHLDToManifestPipeline],
        mockedTableInfo,
        mockedHldCommitId,
        mockedPipelineId3,
        mockedManifestCommitId,
        mockedPr,
        mockedRepository
      )
    ).rejects.toThrow();
    done();
  });
});

describe("test addNewRowToHLDtoManifestPipeline function with similar entry", () => {
  it("positive test", async (done) => {
    jest
      .spyOn(deploymenttable, "insertToTable")
      .mockReturnValueOnce(Promise.resolve());

    const res = await addNewRowToHLDtoManifestPipeline(
      mockedTableInfo,
      mockedHldCommitId,
      mockedPipelineId3,
      mockedManifestCommitId,
      mockedPr,
      mockedRepository,
      mockedEntryHLDToManifestPipeline
    );
    expect(res).toBeDefined();
    done();
  });
  it("negative test: exeption thrown", async (done) => {
    jest
      .spyOn(deploymenttable, "insertToTable")
      .mockReturnValueOnce(Promise.reject(new Error("Fake")));

    await expect(
      addNewRowToHLDtoManifestPipeline(
        mockedTableInfo,
        mockedHldCommitId,
        mockedPipelineId3,
        mockedManifestCommitId,
        mockedPr,
        mockedRepository,
        mockedEntryHLDToManifestPipeline
      )
    ).rejects.toThrow();
    done();
  });
});

describe("test addNewRowToHLDtoManifestPipeline function", () => {
  it("positive test", async (done) => {
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
  it("nagative test", async (done) => {
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
): Promise<void> => {
  const updateFn = jest.spyOn(deploymenttable, "updateHLDtoManifestEntry");
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
      addFn.mockReturnValueOnce(
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
    expect(addFn).toBeCalledTimes(1);
  } else {
    expect(updateFn).toBeCalledTimes(1);
    if (match) {
      expect(addFn).toBeCalledTimes(0);
    } else {
      expect(addFn).toBeCalledTimes(1);
    }
  }

  updateFn.mockReset();
  addFn.mockReset();
};

describe("test updateHLDtoManifestHelper function", () => {
  it("positive test: matching entry", async (done) => {
    await testUpdateHLDtoManifestHelper(false, true);
    done();
  });
  it("positive test: no matching entries", async (done) => {
    await testUpdateHLDtoManifestHelper(false, false);
    done();
  });
  it("positive test: empty entries", async (done) => {
    await testUpdateHLDtoManifestHelper(true, false);
    done();
  });
});

describe("test updateManifestCommitId function", () => {
  it("positive test", async (done) => {
    jest
      .spyOn(deploymenttable, "updateEntryInTable")
      .mockReturnValueOnce(Promise.resolve());
    jest
      .spyOn(deploymenttable, "findMatchingDeployments")
      .mockReturnValueOnce(Promise.resolve([mockedManifestRow]));
    const res = await updateManifestCommitId(
      mockedTableInfo,
      mockedPipelineId3,
      mockedManifestCommitId,
      mockedRepository
    );
    expect(res).toBeDefined();
    done();
  });
  it("negative test", async (done) => {
    jest
      .spyOn(deploymenttable, "findMatchingDeployments")
      .mockReturnValueOnce(Promise.resolve([]));
    await expect(
      updateManifestCommitId(
        mockedTableInfo,
        mockedPipelineId3,
        mockedManifestCommitId,
        mockedRepository
      )
    ).rejects.toThrow();
    done();
  });
});
