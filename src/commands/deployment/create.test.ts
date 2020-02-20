import uuid = require("uuid");
import * as azure from "../../lib/azure/deploymenttable";
import { deepClone } from "../../lib/util";
import { disableVerboseLogging, enableVerboseLogging } from "../../logger";
import { execute, ICommandOptions } from "./create";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

const MOCKED_VALS: ICommandOptions = {
  accessKey: undefined,
  commitId: undefined,
  env: undefined,
  hldCommitId: undefined,
  imageTag: undefined,
  manifestCommitId: undefined,
  name: undefined,
  p1: undefined,
  p2: undefined,
  p3: undefined,
  partitionKey: undefined,
  pr: undefined,
  service: undefined,
  tableName: undefined
};

const getMockedValues = (withKeyValue = false): ICommandOptions => {
  const vals = deepClone(MOCKED_VALS);

  if (withKeyValue) {
    vals.accessKey = "accessKey";
    vals.name = "name";
    vals.partitionKey = "partitionKey";
    vals.tableName = "tableName";
  }
  return vals;
};

describe("test execute function", () => {
  it("[-ve]: with missing values", async () => {
    const exitFn = jest.fn();
    await execute(getMockedValues(), exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("[-ve]: with only deployment table values", async () => {
    // this results in "No action could be performed for specified arguments." error
    const exitFn = jest.fn();
    await execute(getMockedValues(true), exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("[-ve]: with deployment table and p1 values but without imageTag values", async () => {
    const exitFn = jest.fn();
    const vals = getMockedValues(true);
    vals.p1 = "p1";
    await execute(vals, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("[+ve]: with deployment table and p1 values", async () => {
    jest.spyOn(azure, "addSrcToACRPipeline").mockReturnValueOnce(
      Promise.resolve({
        PartitionKey: uuid(),
        RowKey: uuid(),
        commitId: uuid(),
        imageTag: uuid(),
        p1: uuid(),
        service: uuid()
      })
    );
    const exitFn = jest.fn();

    const vals = getMockedValues(true);
    vals.p1 = "p1";
    vals.imageTag = "imageTag";
    vals.commitId = "commitId";
    vals.service = "service";

    await execute(vals, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
  it("[-ve]: with deployment table and p1 values; addSrcToACRPipeline fails", async () => {
    jest
      .spyOn(azure, "addSrcToACRPipeline")
      .mockReturnValueOnce(Promise.reject());
    const exitFn = jest.fn();

    const vals = getMockedValues(true);
    vals.p1 = "p1";
    vals.imageTag = "imageTag";
    vals.commitId = "commitId";
    vals.service = "service";

    await execute(vals, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("[-ve]: with deployment table and p2 values but without hldCommitId values", async () => {
    const exitFn = jest.fn();
    const vals = getMockedValues(true);
    vals.p2 = "p2";
    await execute(vals, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("[+ve]: with deployment table and p2 values", async () => {
    jest.spyOn(azure, "updateACRToHLDPipeline").mockReturnValueOnce(
      Promise.resolve({
        PartitionKey: uuid(),
        RowKey: uuid(),
        commitId: uuid(),
        env: uuid(),
        hldCommitId: uuid(),
        imageTag: uuid(),
        p1: uuid(),
        p2: uuid(),
        service: uuid()
      })
    );
    const exitFn = jest.fn();

    const vals = getMockedValues(true);
    vals.p2 = "p2";
    vals.imageTag = "imageTag";
    vals.hldCommitId = "hldCommitId";
    vals.env = "env";

    await execute(vals, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
  it("[-ve]: with deployment table and p2 values; updateACRToHLDPipeline fails", async () => {
    jest
      .spyOn(azure, "updateACRToHLDPipeline")
      .mockReturnValueOnce(Promise.reject());
    const exitFn = jest.fn();

    const vals = getMockedValues(true);
    vals.p2 = "p2";
    vals.imageTag = "imageTag";
    vals.hldCommitId = "hldCommitId";
    vals.env = "env";

    await execute(vals, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("[+ve]: with deployment table and p3 values and hldCommitId values", async () => {
    jest.spyOn(azure, "updateHLDToManifestPipeline").mockReturnValueOnce(
      Promise.resolve({
        PartitionKey: uuid(),
        RowKey: uuid(),
        commitId: uuid(),
        env: uuid(),
        hldCommitId: uuid(),
        imageTag: uuid(),
        p1: uuid(),
        p2: uuid(),
        p3: uuid(),
        service: uuid()
      })
    );
    const exitFn = jest.fn();

    const vals = getMockedValues(true);
    vals.p3 = "p3";
    vals.hldCommitId = "hldCommitId";

    await execute(vals, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
  it("[-ve]: with deployment table and p3 values; updateHLDToManifestPipeline fails", async () => {
    jest
      .spyOn(azure, "updateHLDToManifestPipeline")
      .mockReturnValueOnce(Promise.reject());
    const exitFn = jest.fn();

    const vals = getMockedValues(true);
    vals.p3 = "p3";
    vals.hldCommitId = "hldCommitId";

    await execute(vals, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
  it("[+ve]: with deployment table and p3 values and manifestCommitId values", async () => {
    jest.spyOn(azure, "updateManifestCommitId").mockReturnValueOnce(
      Promise.resolve({
        PartitionKey: uuid(),
        RowKey: uuid(),
        commitId: uuid(),
        env: uuid(),
        hldCommitId: uuid(),
        imageTag: uuid(),
        manifestCommitId: uuid(),
        p1: uuid(),
        p2: uuid(),
        p3: uuid(),
        service: uuid()
      })
    );
    const exitFn = jest.fn();

    const vals = getMockedValues(true);
    vals.p3 = "p3";
    vals.manifestCommitId = "manifestCommitId";

    await execute(vals, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
  it("[-ve]: with deployment table and p3 values; updateHLDToManifestPipeline fails", async () => {
    jest
      .spyOn(azure, "updateManifestCommitId")
      .mockReturnValueOnce(Promise.reject());
    const exitFn = jest.fn();

    const vals = getMockedValues(true);
    vals.p3 = "p3";
    vals.manifestCommitId = "manifestCommitId";

    await execute(vals, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
});
