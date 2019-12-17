import Table from "cli-table";
import Deployment from "spektate/lib/Deployment";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import * as Get from "./get";

// tslint:disable-next-line: no-var-requires
const data = require("./mocks/data.json");
const fakeDeployments = data;
jest.spyOn(Get, "getDeployments").mockImplementation(
  (outputFormat: any): Promise<Deployment[]> => {
    return new Promise<Deployment[]>(resolve => {
      const mockedDeps: Deployment[] = [];
      fakeDeployments.data.forEach((dep: any) => {
        mockedDeps.push(
          new Deployment(
            dep.deploymentId,
            dep.commitId,
            dep.hldCommitId,
            dep.imageTag,
            dep.timeStamp,
            dep.environment,
            dep.service,
            dep.manifestCommitId,
            dep.srcToDockerBuild,
            dep.dockerToHldRelease,
            dep.hldToManifestBuild
          )
        );
      });
      resolve(mockedDeps as Deployment[]);
      return mockedDeps;
    });
  }
);

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

let deployments: Deployment[];
describe("Get deployments", () => {
  test("get some basic deployments", async () => {
    deployments = await Get.getDeployments(Get.OUTPUT_FORMAT.WIDE);
    expect(deployments).not.toBeUndefined();
    expect(deployments.length).not.toBeUndefined();
    logger.info("Got " + deployments.length + " deployments");
    expect(deployments).toHaveLength(10);
  });
});

describe("Watch get deployments", () => {
  test("watch get deployments", async () => {
    jest.useFakeTimers();
    Get.watchGetDeployments(Get.OUTPUT_FORMAT.WIDE);
    expect(Get.getDeployments).toBeCalled();
    jest.advanceTimersByTime(6000);
    expect(Get.getDeployments).toBeCalledTimes(3);

    jest.clearAllTimers();
  });
});

describe("Introspect deployments", () => {
  test("verify basic fields are defined", () => {
    deployments.forEach((deployment: Deployment) => {
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
  test("verify print deployments", () => {
    let table = Get.printDeployments(
      deployments,
      Get.processOutputFormat("json")
    );
    expect(table).not.toBeUndefined();
    const deployment = [
      "",
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
      "✓"
    ];
    table!.forEach((field, index, array) => {
      if (field[2] === deployment[2]) {
        for (let i = 1; i < field.length; i++) {
          expect(field[i]).toEqual(deployment[i]);
        }
        expect(field).toHaveLength(13);
      }
    });

    table = Get.printDeployments(
      deployments,
      Get.processOutputFormat("json"),
      3
    );
    expect(table).toHaveLength(3);
  });
});

describe("Output formats", () => {
  test("verify wide output", () => {
    const table = Get.printDeployments(
      deployments,
      Get.processOutputFormat("wide")
    );
    expect(table).not.toBeUndefined();
    table!.forEach((field, index, array) => {
      expect(field).toHaveLength(17);
    });
  });
});
