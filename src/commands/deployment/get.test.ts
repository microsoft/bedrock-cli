import path from "path";
import Deployment from "spektate/lib/Deployment";
import { AzureDevOpsRepo } from "spektate/lib/repository/AzureDevOpsRepo";
import { GitHub } from "spektate/lib/repository/GitHub";
import { ITag } from "spektate/lib/repository/Tag";
import { loadConfiguration } from "../../config";
import { deepClone } from "../../lib/util";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import {
  execute,
  getClusterSyncStatuses,
  getDeployments,
  getStatus,
  ICommandOptions,
  IInitObject,
  initialize,
  IValidatedOptions,
  OUTPUT_FORMAT,
  printDeployments,
  processOutputFormat,
  validateValues,
  watchGetDeployments
} from "./get";
import * as get from "./get";

const MOCKED_INPUT_VALUES: ICommandOptions = {
  buildId: "",
  commitId: "",
  deploymentId: "",
  env: "",
  imageTag: "",
  output: "",
  service: "",
  top: "",
  watch: false
};

const MOCKED_VALUES: IValidatedOptions = {
  buildId: "",
  commitId: "",
  deploymentId: "",
  env: "",
  imageTag: "",
  nTop: 0,
  output: "",
  outputFormat: OUTPUT_FORMAT.NORMAL,
  service: "",
  top: "",
  watch: false
};

const getMockedInputValues = (): ICommandOptions => {
  return deepClone(MOCKED_INPUT_VALUES);
};

const getMockedValues = (): IValidatedOptions => {
  return deepClone(MOCKED_VALUES);
};

// tslint:disable-next-line: no-var-requires
const data = require("./mocks/data.json");
const fakeDeployments = data;
// tslint:disable-next-line: no-var-requires
const fakeClusterSyncs = require("./mocks/cluster-sync.json");
const mockedDeps: Deployment[] = fakeDeployments.data.map((dep: Deployment) => {
  return new Deployment(
    dep.deploymentId,
    dep.commitId,
    dep.hldCommitId || "",
    dep.imageTag,
    dep.timeStamp,
    dep.environment,
    dep.service,
    dep.manifestCommitId,
    dep.srcToDockerBuild,
    dep.dockerToHldRelease,
    dep.hldToManifestBuild
  );
});

const mockedClusterSyncs: ITag[] = fakeClusterSyncs.data.map((sync: ITag) => {
  return sync;
});
jest
  .spyOn(GitHub.prototype, "getManifestSyncState")
  .mockReturnValue(Promise.resolve(mockedClusterSyncs));
jest
  .spyOn(AzureDevOpsRepo.prototype, "getManifestSyncState")
  .mockReturnValue(Promise.resolve(mockedClusterSyncs));

let initObject: IInitObject;

beforeAll(async () => {
  enableVerboseLogging();

  const mockFileName = "src/commands/mocks/spk-config.yaml";
  const filename = path.resolve(mockFileName);
  process.env.test_name = "my_storage_account";
  process.env.test_key = "my_storage_key";
  loadConfiguration(filename);
  initObject = await initialize();
});

afterAll(() => {
  disableVerboseLogging();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Test getStatus function", () => {
  it("with succeeded as value", () => {
    expect(getStatus("succeeded")).toBe("\u2713");
  });
  it("with empty string as value", () => {
    expect(getStatus("")).toBe("...");
  });
  it("with other string as value", () => {
    expect(getStatus("test")).toBe("\u0445");
  });
});

describe("Test processOutputFormat function", () => {
  it("with empty string as value", () => {
    expect(processOutputFormat("")).toBe(OUTPUT_FORMAT.NORMAL);
  });
  it("with normal string as value", () => {
    expect(processOutputFormat("normal")).toBe(OUTPUT_FORMAT.NORMAL);
  });
  it("with wide string as value", () => {
    expect(processOutputFormat("wide")).toBe(OUTPUT_FORMAT.WIDE);
  });
  it("with json string as value", () => {
    expect(processOutputFormat("json")).toBe(OUTPUT_FORMAT.JSON);
  });
});

describe("Test validateValues function", () => {
  it("positive test: valid values", () => {
    const vals = validateValues(MOCKED_INPUT_VALUES);
    expect(vals.nTop).toBe(0);
    expect(vals.outputFormat).toBe(OUTPUT_FORMAT.NORMAL);
  });
  it("positive test: valid values with output format as JSON", () => {
    const mockedValues = getMockedInputValues();
    mockedValues.output = "json";
    const vals = validateValues(mockedValues);
    expect(vals.nTop).toBe(0);
    expect(vals.outputFormat).toBe(OUTPUT_FORMAT.JSON);
  });
  it("positive test: valid values with output format as wiDE", () => {
    const mockedValues = getMockedInputValues();
    mockedValues.output = "wiDE";
    const vals = validateValues(mockedValues);
    expect(vals.nTop).toBe(0);
    expect(vals.outputFormat).toBe(OUTPUT_FORMAT.WIDE);
  });
  it("positive test: valid values with top = 5", () => {
    const mockedValues = getMockedValues();
    mockedValues.top = "5";
    const vals = validateValues(mockedValues);
    expect(vals.nTop).toBe(5);
    expect(vals.outputFormat).toBe(OUTPUT_FORMAT.NORMAL);
  });
  it("negative test: valid values with top = -5", () => {
    const mockedValues = getMockedValues();
    mockedValues.top = "-5";
    try {
      validateValues(mockedValues);
    } catch (e) {
      expect(e.message).toBe(
        "value for top option has to be a positive number"
      );
    }
  });
});

describe("Test execute function", () => {
  it("positive test", async () => {
    jest
      .spyOn(get, "initialize")
      .mockReturnValueOnce(Promise.resolve(initObject));
    jest.spyOn(get, "getDeployments").mockReturnValueOnce(Promise.resolve([]));
    const exitFn = jest.fn();
    await execute(getMockedInputValues(), exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
  it("positive test with watch", async () => {
    jest
      .spyOn(get, "initialize")
      .mockReturnValueOnce(Promise.resolve(initObject));
    jest.spyOn(get, "watchGetDeployments").mockReturnValueOnce();
    const exitFn = jest.fn();

    const mockedVals = getMockedInputValues();
    mockedVals.watch = true;
    await execute(mockedVals, exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[0]]);
  });
  it("negative test", async () => {
    jest.spyOn(get, "initialize").mockReturnValueOnce(Promise.reject("Error"));
    const exitFn = jest.fn();

    await execute(getMockedInputValues(), exitFn);
    expect(exitFn).toBeCalledTimes(1);
    expect(exitFn.mock.calls).toEqual([[1]]);
  });
});

describe("Test printDeployments function", () => {
  it("without deployments", () => {
    expect(
      printDeployments([], OUTPUT_FORMAT.NORMAL, undefined, mockedClusterSyncs)
    ).not.toBeDefined();
  });
});

describe("Get deployments", () => {
  it("get some basic deployments", async () => {
    jest
      .spyOn(get, "getDeployments")
      .mockReturnValueOnce(Promise.resolve(mockedDeps));

    const values = getMockedValues();
    values.outputFormat = OUTPUT_FORMAT.WIDE;
    const deployments = await getDeployments(initObject, values);
    expect(deployments).not.toBeUndefined();
    expect(deployments.length).not.toBeUndefined();
    logger.info("Got " + deployments.length + " deployments");
    expect(deployments).toHaveLength(10);
  });
  it("getDeploymentsBasedOnFilters throw error", async () => {
    jest
      .spyOn(Deployment, "getDeploymentsBasedOnFilters")
      .mockReturnValueOnce(Promise.reject("Error"));
    try {
      await getDeployments(initObject, MOCKED_VALUES);
      expect(true).toBe(false);
    } catch (e) {
      expect(e.message).toBe("Error");
    }
  });
  it("postive test", async () => {
    jest
      .spyOn(Deployment, "getDeploymentsBasedOnFilters")
      .mockReturnValueOnce(Promise.resolve(mockedDeps));
    const results = await getDeployments(initObject, MOCKED_VALUES);
    expect(results).toEqual(mockedDeps);
  });
});

describe("Watch get deployments", () => {
  test("watch get deployments", async () => {
    jest.useFakeTimers();
    jest
      .spyOn(get, "getDeployments")
      .mockReturnValue(Promise.resolve(mockedDeps));
    const values = getMockedValues();
    values.outputFormat = OUTPUT_FORMAT.WIDE;

    watchGetDeployments(initObject, values);
    expect(getDeployments).toBeCalled();
    jest.advanceTimersByTime(6000);
    expect(getDeployments).toBeCalledTimes(2);

    jest.clearAllTimers();
  });
});

describe("Introspect deployments", () => {
  test("verify basic fields are defined", async () => {
    mockedDeps.forEach((deployment: Deployment) => {
      const dep = deployment as Deployment;

      // Make sure the basic fields are defined
      expect(dep.deploymentId).not.toBe("");
      expect(dep.service).not.toBe("");
      expect(dep.duration()).not.toBe("");
      expect(dep.status()).not.toBe("");
      expect(dep.environment).not.toBe("");
      expect(dep.timeStamp).not.toBe("");

      // Make sure at least one of the builds/releases exist
      expect(
        dep.srcToDockerBuild != null ||
          dep.dockerToHldRelease != null ||
          dep.hldToManifestBuild != null
      ).toBeTruthy();
    });
  });
});

describe("Print deployments", () => {
  test("verify print deployments", async () => {
    let table = printDeployments(
      mockedDeps,
      processOutputFormat("normal"),
      undefined,
      mockedClusterSyncs
    );
    expect(table).not.toBeUndefined();
    const deployment = [
      "2019-08-30T21:05:19.047Z",
      "hello-bedrock",
      "7468ca0a24e1",
      "c626394",
      6046,
      "hello-bedrock-master-6046",
      "✓",
      180,
      "DEV",
      "706685f",
      "✓",
      6047,
      "✓",
      "EUROPE"
    ];

    const matchItems = table!.filter(field => field[2] === deployment[2]);
    expect(matchItems).toHaveLength(1); // one matching row

    (matchItems[0] as Deployment[]).forEach((field, i) => {
      expect(field).toEqual(deployment[i]);
    });
    expect(matchItems[0]).toHaveLength(14);

    table = printDeployments(
      mockedDeps,
      processOutputFormat("normal"),
      3,
      mockedClusterSyncs
    );
    expect(table).toHaveLength(3);
  });
});

describe("Cluster sync", () => {
  test("Verify cluster syncs", async () => {
    // test a github setup too
    if (initObject.config.azure_devops?.manifest_repository) {
      initObject.config.azure_devops!.manifest_repository! = "https://github.com/someone/something";
    }
    const clusterSyncs = await getClusterSyncStatuses(initObject);
    expect(clusterSyncs).toBeDefined();
    expect(clusterSyncs).toHaveLength(5);
    expect(clusterSyncs![0].name).toBe("CANADA");
    expect(clusterSyncs![0].commit).toBe("efeeebe");
    expect(clusterSyncs![0].tagger).toBe("Weave Flux");
  });

  test("Verify cluster syncs - empty", async () => {
    // test empty manifest scenario
    if (initObject.config.azure_devops?.manifest_repository) {
      initObject.config.azure_devops!.manifest_repository! = "";
    }
    const clusterSyncs = await getClusterSyncStatuses(initObject);
    expect(clusterSyncs).toBeUndefined();
  });
});

describe("Output formats", () => {
  test("verify wide output", async () => {
    const table = printDeployments(
      mockedDeps,
      processOutputFormat("wide"),
      undefined,
      mockedClusterSyncs
    );
    expect(table).not.toBeUndefined();
    table!.forEach(field => {
      expect(field).toHaveLength(18);
    });
  });
});
