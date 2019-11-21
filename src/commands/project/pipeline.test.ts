import { disableVerboseLogging, enableVerboseLogging } from "../../logger";

jest.mock("../../lib/pipelines/pipelines");

import {
  createPipelineForDefinition,
  getBuildApiClient,
  queueBuild
} from "../../lib/pipelines/pipelines";

import { installPipeline } from "./pipeline";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("create hld to manifest pipeline test", () => {
  it("should create a pipeline", async () => {
    (createPipelineForDefinition as jest.Mock).mockReturnValue({ id: 10 });

    const exitFn = jest.fn();
    await installPipeline(
      "orgName",
      "PAT",
      "pipelineName",
      "repoName",
      "repoUrl",
      "hldRepoUrl",
      "azDoProject",
      exitFn
    );

    expect(exitFn).toBeCalledTimes(0);
  });

  it("should fail if the build client cant be instantiated", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue(Promise.reject());

    const exitFn = jest.fn();
    await installPipeline(
      "orgName",
      "PAT",
      "pipelineName",
      "repoName",
      "repoUrl",
      "hldRepoUrl",
      "azDoProject",
      exitFn
    );

    expect(exitFn).toBeCalledTimes(1);
  });

  it("should fail if the pipeline definition cannot be created", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue({});
    (createPipelineForDefinition as jest.Mock).mockReturnValue(
      Promise.reject()
    );

    const exitFn = jest.fn();
    await installPipeline(
      "orgName",
      "PAT",
      "pipelineName",
      "repoName",
      "repoUrl",
      "hldRepoUrl",
      "azDoProject",
      exitFn
    );

    expect(exitFn).toBeCalledTimes(1);
  });

  it("should fail if a build cannot be queued on the pipeline", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue({});
    (createPipelineForDefinition as jest.Mock).mockReturnValue({ id: 10 });
    (queueBuild as jest.Mock).mockReturnValue(Promise.reject());

    const exitFn = jest.fn();
    await installPipeline(
      "orgName",
      "PAT",
      "pipelineName",
      "repoName",
      "repoUrl",
      "hldRepoUrl",
      "azDoProject",
      exitFn
    );

    expect(exitFn).toBeCalledTimes(1);
  });
});
