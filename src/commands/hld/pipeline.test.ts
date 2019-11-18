import { disableVerboseLogging, enableVerboseLogging } from "../../logger";

jest.mock("../../lib/pipelines/pipelines");

import {
  createPipelineForDefinition,
  getBuildApiClient,
  queueBuild
} from "../../lib/pipelines/pipelines";

import {
  installHldToManifestPipeline,
  requiredPipelineVariables
} from "./pipeline";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("required pipeline variables", () => {
  it("should use access token and repo as pipeline vars", () => {
    const variables = requiredPipelineVariables("foo", "bar");

    expect(Object.keys(variables).length).toBe(2);
    expect(variables.PAT.value).toBe("foo");
    expect(variables.PAT.isSecret).toBe(true);

    expect(variables.MANIFEST_REPO.value).toBe("bar");
    expect(variables.MANIFEST_REPO.isSecret).toBe(false);
  });
});

describe("create hld to manifest pipeline test", () => {
  it("should create a pipeline", async () => {
    (createPipelineForDefinition as jest.Mock).mockReturnValue({ id: 10 });

    const exitFn = jest.fn();
    await installHldToManifestPipeline(
      "foo",
      "bar",
      "wow",
      "amazing",
      "meow",
      "baz",
      "pipelineName",
      exitFn
    );

    expect(exitFn).toBeCalledTimes(0);
  });

  it("should fail if the build client cant be instantiated", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue(Promise.reject());

    const exitFn = jest.fn();
    await installHldToManifestPipeline(
      "foo",
      "bar",
      "baz",
      "wow",
      "wao",
      "baz",
      "pipelineName",
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
    await installHldToManifestPipeline(
      "foo",
      "bar",
      "baz",
      "wow",
      "wao",
      "baz",
      "pipelineName",
      exitFn
    );

    expect(exitFn).toBeCalledTimes(1);
  });

  it("should fail if a build cannot be queued on the pipeline", async () => {
    (getBuildApiClient as jest.Mock).mockReturnValue({});
    (createPipelineForDefinition as jest.Mock).mockReturnValue({ id: 10 });
    (queueBuild as jest.Mock).mockReturnValue(Promise.reject());

    const exitFn = jest.fn();
    await installHldToManifestPipeline(
      "foo",
      "bar",
      "baz",
      "wow",
      "wao",
      "baz",
      "pipelineName",
      exitFn
    );

    expect(exitFn).toBeCalledTimes(1);
  });
});
