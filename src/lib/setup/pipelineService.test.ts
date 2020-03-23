/* eslint-disable @typescript-eslint/no-explicit-any */
import { BuildStatus } from "azure-devops-node-api/interfaces/BuildInterfaces";
import * as hldPipeline from "../../commands/hld/pipeline";
import * as projectPipeline from "../../commands/project/pipeline";
import * as servicePipeline from "../../commands/service/pipeline";
import { deepClone } from "../util";
import { RequestContext, WORKSPACE } from "./constants";
import {
  createBuildPipeline,
  createHLDtoManifestPipeline,
  createLifecyclePipeline,
  deletePipeline,
  getBuildStatusString,
  getPipelineBuild,
  getPipelineByName,
  pollForPipelineStatus,
} from "./pipelineService";
import * as pipelineService from "./pipelineService";

const mockRequestContext: RequestContext = {
  accessToken: "pat",
  orgName: "orgname",
  projectName: "project",
  workspace: WORKSPACE,
};

const getMockRequestContext = (): RequestContext => {
  return deepClone(mockRequestContext);
};

describe("test getBuildStatusString function", () => {
  it("sanity test", () => {
    const results = [
      "None",
      "In Progress",
      "Completed",
      "Cancelling",
      "Postponed",
      "Not Started",
    ];

    [
      BuildStatus.None,
      BuildStatus.InProgress,
      BuildStatus.Completed,
      BuildStatus.Cancelling,
      BuildStatus.Postponed,
      BuildStatus.NotStarted,
    ].forEach((s, i) => {
      expect(getBuildStatusString(s)).toBe(results[i]);
    });
  });
  it("sanity test: unknown", () => {
    expect(getBuildStatusString(BuildStatus.All)).toBe("Unknown");
    expect(getBuildStatusString(undefined)).toBe("Unknown");
  });
});

describe("test getPipelineByName function", () => {
  it("sanity test: pipeline is not found", async () => {
    const p = await getPipelineByName(
      {
        getDefinitions: () => {
          return [];
        },
      } as any,
      "project",
      "pipeline"
    );
    expect(p).not.toBeDefined();
  });
  it("sanity test: pipeline exists", async () => {
    const p = await getPipelineByName(
      {
        getDefinitions: () => {
          return [
            {
              name: "pipeline",
            },
          ];
        },
      } as any,
      "project",
      "pipeline"
    );
    expect(p).toBeDefined();
  });
  it("sanity test: multiple pipelines and none matches", async () => {
    const p = await getPipelineByName(
      {
        getDefinitions: () => {
          return [
            {
              name: "pipeline1",
            },
            {
              name: "pipeline2",
            },
            {
              name: "pipeline3",
            },
          ];
        },
      } as any,
      "project",
      "pipeline"
    );
    expect(p).not.toBeDefined();
  });
  it("sanity test: multiple pipelines and one matches", async () => {
    const p = await getPipelineByName(
      {
        getDefinitions: () => {
          return [
            {
              name: "pipeline",
            },
            {
              name: "pipeline2",
            },
            {
              name: "pipeline3",
            },
          ];
        },
      } as any,
      "project",
      "pipeline"
    );
    expect(p).toBeDefined();
  });
  it("negative test: exception thrown", async () => {
    await expect(
      getPipelineByName(
        {
          getDefinitions: () => {
            throw Error("fake");
          },
        } as any,
        "project",
        "pipeline"
      )
    ).rejects.toThrow();
  });
});

describe("test deletePipeline function", () => {
  it("sanity test", async () => {
    await deletePipeline(
      {
        deleteDefinition: jest.fn,
      } as any,
      "project",
      "pipeline",
      1
    );
  });
  it("negative test: exception thrown", async () => {
    await expect(
      deletePipeline(
        {
          deleteDefinition: () => {
            throw Error("Fake");
          },
        } as any,
        "project",
        "pipeline",
        1
      )
    ).rejects.toThrow();
  });
});

describe("test getPipelineBuild function", () => {
  it("sanity test", async () => {
    const res = await getPipelineBuild(
      {
        getLatestBuild: () => {
          return {};
        },
      } as any,
      "project",
      "pipeline"
    );
    expect(res).toBeDefined();
  });
  it("negative test: exception thrown", async () => {
    await expect(
      getPipelineBuild(
        {
          getLatestBuild: () => {
            throw Error("Fake");
          },
        } as any,
        "project",
        "pipeline"
      )
    ).rejects.toThrow();
  });
});

describe("test pollForPipelineStatus function", () => {
  it("sanity test", async () => {
    jest
      .spyOn(pipelineService, "getPipelineByName")
      .mockReturnValueOnce(Promise.resolve({}));
    jest.spyOn(pipelineService, "getPipelineBuild").mockReturnValueOnce(
      Promise.resolve({
        status: 1,
      })
    );

    await pollForPipelineStatus({} as any, "project", "pipeline", 10);
  });
  it("negative test: pipeline does not exits", async () => {
    jest
      .spyOn(pipelineService, "getPipelineByName")
      .mockReturnValueOnce(Promise.resolve(undefined));
    await expect(
      pollForPipelineStatus({} as any, "project", "pipeline", 10)
    ).rejects.toThrow();
  });
  it("negative test: getPipelineByName function throws exception", async () => {
    jest
      .spyOn(pipelineService, "getPipelineByName")
      .mockReturnValueOnce(Promise.reject(Error("fake")));
    await expect(
      pollForPipelineStatus({} as any, "project", "pipeline", 1)
    ).rejects.toThrow();
  });
});

describe("test createHLDtoManifestPipeline function", () => {
  it("positive test: pipeline does not exist previously", async () => {
    jest
      .spyOn(pipelineService, "getPipelineByName")
      .mockReturnValueOnce(Promise.resolve(undefined));
    jest
      .spyOn(hldPipeline, "installHldToManifestPipeline")
      .mockReturnValueOnce(Promise.resolve());
    jest
      .spyOn(pipelineService, "pollForPipelineStatus")
      .mockReturnValueOnce(Promise.resolve());

    const rc = getMockRequestContext();
    await createHLDtoManifestPipeline({} as any, rc);
    expect(rc.createdHLDtoManifestPipeline).toBeTruthy();
  });
  it("positive test: pipeline already exists previously", async () => {
    jest.spyOn(pipelineService, "getPipelineByName").mockResolvedValueOnce({
      id: 1,
    });
    const fnDeletePipeline = jest
      .spyOn(pipelineService, "deletePipeline")
      .mockReturnValueOnce(Promise.resolve());
    jest
      .spyOn(hldPipeline, "installHldToManifestPipeline")
      .mockReturnValueOnce(Promise.resolve());
    jest
      .spyOn(pipelineService, "pollForPipelineStatus")
      .mockReturnValueOnce(Promise.resolve());

    const rc = getMockRequestContext();
    await createHLDtoManifestPipeline({} as any, rc);
    expect(rc.createdHLDtoManifestPipeline).toBeTruthy();
    expect(fnDeletePipeline).toBeCalledTimes(1);
    fnDeletePipeline.mockReset();
  });
  it("negative test", async () => {
    jest
      .spyOn(pipelineService, "getPipelineByName")
      .mockReturnValueOnce(Promise.reject(Error("fake")));
    const rc = getMockRequestContext();
    await expect(createHLDtoManifestPipeline({} as any, rc)).rejects.toThrow();
  });
});

describe("test createLifecyclePipeline function", () => {
  it("positive test: pipeline does not exist previously", async () => {
    jest
      .spyOn(pipelineService, "getPipelineByName")
      .mockResolvedValueOnce(undefined);
    jest
      .spyOn(projectPipeline, "installLifecyclePipeline")
      .mockResolvedValueOnce();
    jest
      .spyOn(pipelineService, "pollForPipelineStatus")
      .mockReturnValueOnce(Promise.resolve());

    const rc = getMockRequestContext();
    await createLifecyclePipeline({} as any, rc);
    expect(rc.createdLifecyclePipeline).toBeTruthy();
  });
  it("positive test: pipeline already exists", async () => {
    jest.spyOn(pipelineService, "getPipelineByName").mockReturnValueOnce(
      Promise.resolve({
        id: 1,
      })
    );
    const fnDeletePipeline = jest
      .spyOn(pipelineService, "deletePipeline")
      .mockReturnValueOnce(Promise.resolve());
    jest
      .spyOn(projectPipeline, "installLifecyclePipeline")
      .mockResolvedValueOnce();
    jest
      .spyOn(pipelineService, "pollForPipelineStatus")
      .mockReturnValueOnce(Promise.resolve());

    const rc = getMockRequestContext();
    await createLifecyclePipeline({} as any, rc);
    expect(rc.createdLifecyclePipeline).toBeTruthy();
    expect(fnDeletePipeline).toBeCalledTimes(1);
    fnDeletePipeline.mockReset();
  });
  it("negative test", async () => {
    jest
      .spyOn(pipelineService, "getPipelineByName")
      .mockReturnValueOnce(Promise.reject(Error("fake")));
    const rc = getMockRequestContext();
    await expect(createLifecyclePipeline({} as any, rc)).rejects.toThrow();
  });
});

describe("test createBuildPipeline function", () => {
  it("positive test: pipeline does not exist previously", async () => {
    jest
      .spyOn(pipelineService, "getPipelineByName")
      .mockResolvedValueOnce(undefined);
    jest
      .spyOn(servicePipeline, "installBuildUpdatePipeline")
      .mockResolvedValueOnce();
    jest
      .spyOn(pipelineService, "pollForPipelineStatus")
      .mockReturnValueOnce(Promise.resolve());

    const rc = getMockRequestContext();
    await createBuildPipeline({} as any, rc);
    expect(rc.createdBuildPipeline).toBeTruthy();
  });
  it("positive test: pipeline already exists", async () => {
    jest.spyOn(pipelineService, "getPipelineByName").mockReturnValueOnce(
      Promise.resolve({
        id: 1,
      })
    );
    const fnDeletePipeline = jest
      .spyOn(pipelineService, "deletePipeline")
      .mockReturnValueOnce(Promise.resolve());
    jest
      .spyOn(servicePipeline, "installBuildUpdatePipeline")
      .mockResolvedValueOnce();
    jest
      .spyOn(pipelineService, "pollForPipelineStatus")
      .mockReturnValueOnce(Promise.resolve());

    const rc = getMockRequestContext();
    await createBuildPipeline({} as any, rc);
    expect(rc.createdBuildPipeline).toBeTruthy();
    expect(fnDeletePipeline).toBeCalledTimes(1);
    fnDeletePipeline.mockReset();
  });
  it("negative test", async () => {
    jest
      .spyOn(pipelineService, "getPipelineByName")
      .mockReturnValueOnce(Promise.reject(Error("fake")));
    const rc = getMockRequestContext();
    await expect(createBuildPipeline({} as any, rc)).rejects.toThrow();
  });
});
