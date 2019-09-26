import Deployment from "spektate/lib/Deployment";
import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import { Helper, OUTPUT_FORMAT } from "./helper";

// tslint:disable-next-line: no-var-requires
const data = require("./mocks/data.json");
const fakeDeployments = data;
jest.spyOn(Helper, "getDeployments").mockImplementation(
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
  jest.mock("./helper");
  enableVerboseLogging();
});

afterAll(() => {
  jest.unmock("./helper");
  disableVerboseLogging();
});

let deployments: Deployment[];
describe("Get deployments", () => {
  test("get some basic deployments", async () => {
    deployments = await Helper.getDeployments(OUTPUT_FORMAT.WIDE);
    expect(deployments).not.toBeUndefined();
    expect(deployments.length).not.toBeUndefined();
    logger.info("Got " + deployments.length + " deployments");
    expect(deployments).toHaveLength(13);
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
