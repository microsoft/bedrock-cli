import path from "path";
import { duration, IDeployment, status } from "spektate/lib/IDeployment";
import * as Deployment from "spektate/lib/IDeployment";
import * as AzureDevOpsRepo from "spektate/lib/repository/IAzureDevOpsRepo";
import * as GitHub from "spektate/lib/repository/IGitHub";
import { ITag } from "spektate/lib/repository/Tag";
import { loadConfiguration } from "../../config";
import { getErrorMessage } from "../../lib/errorBuilder";
import { deepClone } from "../../lib/util";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger,
} from "../../logger";
import {
  execute,
  getClusterSyncStatuses,
  getDeployments,
  getStatus,
  CommandOptions,
  InitObject,
  initialize,
  ValidatedOptions,
  OUTPUT_FORMAT,
  printDeployments,
  processOutputFormat,
  validateValues,
  watchGetDeployments,
} from "./get";
import * as get from "./get";

const MOCKED_INPUT_VALUES: CommandOptions = {
  buildId: "",
  commitId: "",
  deploymentId: "",
  ring: "",
  imageTag: "",
  output: "",
  service: "",
  top: "",
  watch: false,
};

const MOCKED_VALUES: ValidatedOptions = {
  buildId: "",
  commitId: "",
  deploymentId: "",
  ring: "",
  imageTag: "",
  nTop: 0,
  output: "",
  outputFormat: OUTPUT_FORMAT.WIDE,
  service: "",
  top: "",
  watch: false,
};

const getMockedInputValues = (): CommandOptions => {
  return deepClone(MOCKED_INPUT_VALUES);
};

const getMockedValues = (): ValidatedOptions => {
  return deepClone(MOCKED_VALUES);
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const data = require("./mocks/data.json");
const fakeDeployments = data;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fakeClusterSyncs = require("./mocks/cluster-sync.json");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fakePR = require("./mocks/pr.json");
const mockedDeps: IDeployment[] = fakeDeployments.data.map(
  (dep: IDeployment) => {
    return {
      commitId: dep.commitId,
      deploymentId: dep.deploymentId,
      dockerToHldRelease: dep.dockerToHldRelease,
      dockerToHldReleaseStage: dep.dockerToHldReleaseStage,
      environment: dep.environment,
      hldCommitId: dep.hldCommitId || "",
      hldRepo: dep.hldRepo,
      hldToManifestBuild: dep.hldToManifestBuild,
      imageTag: dep.imageTag,
      manifestCommitId: dep.manifestCommitId,
      manifestRepo: dep.manifestRepo,
      pr: dep.pr,
      service: dep.service,
      sourceRepo: dep.sourceRepo,
      srcToDockerBuild: dep.srcToDockerBuild,
      timeStamp: dep.timeStamp,
    };
  }
);

const mockedClusterSyncs: ITag[] = fakeClusterSyncs.data.map((sync: ITag) => {
  return sync;
});
jest
  .spyOn(GitHub, "getManifestSyncState")
  .mockReturnValue(Promise.resolve(mockedClusterSyncs));
jest
  .spyOn(AzureDevOpsRepo, "getManifestSyncState")
  .mockReturnValue(Promise.resolve(mockedClusterSyncs));
jest.spyOn(Deployment, "fetchPR").mockReturnValue(Promise.resolve(fakePR));

let initObject: InitObject;

beforeAll(async () => {
  enableVerboseLogging();

  const mockFileName = "src/commands/mocks/spk-config.yaml";
  const filename = path.resolve(mockFileName);
  process.env["test_name"] = "my_storage_account";
  process.env["test_key"] = "my_storage_key";
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
    expect(() => {
      validateValues(mockedValues);
    }).toThrow(
      getErrorMessage({
        errorKey: "introspect-get-cmd-err-validation-top-num",
        values: ["-5"],
      })
    );
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
    jest
      .spyOn(get, "watchGetDeployments")
      .mockReturnValueOnce(Promise.resolve());
    const exitFn = jest.fn();

    const mockedVals = getMockedInputValues();
    mockedVals.watch = true;
    await execute(mockedVals, exitFn);
    expect(exitFn).toBeCalledTimes(0);
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
      .mockRejectedValueOnce(Error("Error"));

    await expect(getDeployments(initObject, MOCKED_VALUES)).rejects.toThrow(
      getErrorMessage("introspect-get-cmd-get-deployments-err")
    );
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

    await watchGetDeployments(initObject, values);
    expect(getDeployments).toBeCalled();
    jest.advanceTimersByTime(6000);
    expect(getDeployments).toBeCalledTimes(2);

    jest.clearAllTimers();
  });
});

describe("Introspect deployments", () => {
  test("verify basic fields are defined", () => {
    mockedDeps.forEach((deployment: IDeployment) => {
      const dep = deployment as IDeployment;

      // Make sure the basic fields are defined
      expect(dep.service).not.toBe("");
      expect(duration(dep)).not.toBe("");
      expect(status(dep)).not.toBe("");
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
  test("verify print deployments", () => {
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
      "EUROPE",
    ];

    expect(table).toBeDefined();

    if (table) {
      const matchItems = table.filter((field) => field[0] === deployment[0]);
      expect(matchItems).toHaveLength(1); // one matching row

      (matchItems[0] as IDeployment[]).forEach((field, i) => {
        expect(field).toEqual(deployment[i]);
      });
      expect(matchItems[0]).toHaveLength(13);

      table = printDeployments(
        mockedDeps,
        processOutputFormat("wide"),
        3,
        mockedClusterSyncs
      );
      expect(table).toHaveLength(3);
    }
  });
});

describe("Cluster sync", () => {
  test("Verify cluster syncs", async () => {
    // test a github setup too
    if (initObject.manifestRepo) {
      initObject.manifestRepo = "https://github.com/someone/something";
    }
    const clusterSyncs = await getClusterSyncStatuses(initObject);
    expect(clusterSyncs).toBeDefined();
    expect(clusterSyncs).toHaveLength(5);

    if (clusterSyncs) {
      expect(clusterSyncs[0].name).toBe("CANADA");
      expect(clusterSyncs[0].commit).toBe("efeeebe");
      expect(clusterSyncs[0].tagger).toBe("Weave Flux");
    }
  });

  test("Verify cluster syncs - empty", async () => {
    // test empty manifest scenario
    if (initObject.manifestRepo) {
      initObject.manifestRepo = "";
    }
    const clusterSyncs = await getClusterSyncStatuses(initObject);
    expect(clusterSyncs).toBeUndefined();
  });
});

describe("Output formats", () => {
  test("verify wide output", () => {
    const table = printDeployments(
      mockedDeps,
      processOutputFormat("wide"),
      undefined,
      mockedClusterSyncs
    );
    expect(table).toBeDefined();

    if (table) {
      table.forEach((field) => expect(field).toHaveLength(19));
    }
  });
});
