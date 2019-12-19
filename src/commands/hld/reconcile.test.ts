import { disableVerboseLogging, enableVerboseLogging } from "../../logger";

import {
  addChartToRing,
  createRepositoryComponent,
  createRingComponent,
  createServiceComponent,
  createStaticComponent
} from "./reconcile";

import { IBedrockServiceConfig } from "../../types";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("createServiceComponent", () => {
  it("should invoke the correct command for adding service to hld", () => {
    const exec = jest.fn();
    const repoInHldPath = "myMonoRepo";
    const pathBase = "myService";

    const expectedInvocation = `cd ${repoInHldPath} && mkdir -p ${pathBase} config && fab add ${pathBase} --path ./${pathBase} --method local --type component && touch ./config/common.yaml`;

    createServiceComponent(exec, repoInHldPath, pathBase);
    expect(exec).toBeCalled();
    expect(exec).toBeCalledWith(expectedInvocation);
  });
});

describe("createRepositoryComponent", () => {
  it("should invoke the correct command for adding repository to hld", () => {
    const exec = jest.fn();
    const hldPath = `myMonoRepo`;
    const repositoryName = `myRepo`;

    const expectedInvocation = `cd ${hldPath} && mkdir -p ${repositoryName} && fab add ${repositoryName} --path ./${repositoryName} --method local`;

    createRepositoryComponent(exec, hldPath, repositoryName);

    expect(exec).toBeCalled();
    expect(exec).toBeCalledWith(expectedInvocation);
  });
});

describe("createRingComponent", () => {
  it("should invoke the correct command for adding rings to hld", () => {
    const exec = jest.fn();
    const svcPathInHld = `/path/to/service`;
    const ring = `dev`;

    const expectedInvocation = `cd ${svcPathInHld} && mkdir -p ${ring} config && fab add ${ring} --path ./${ring} --method local --type component && touch ./config/common.yaml`;

    createRingComponent(exec, svcPathInHld, ring);

    expect(exec).toBeCalled();
    expect(exec).toBeCalledWith(expectedInvocation);
  });
});

describe("createStaticComponent", () => {
  it("should invoke the correct command for creating static components", () => {
    const exec = jest.fn();
    const ringPathInHld = `/ring/path/in/hld`;

    const expectedInvocation = `cd ${ringPathInHld} && mkdir -p config static && fab add static --path ./static --method local --type static && touch ./config/common.yaml`;

    createStaticComponent(exec, ringPathInHld);

    expect(exec).toBeCalled();
    expect(exec).toBeCalledWith(expectedInvocation);
  });
});

describe("addChartToRing", () => {
  it("should invoke the correct command for adding a helm chart with a branch version", () => {
    const exec = jest.fn();
    const ringPath = "/path/to/ring";

    const branch = "v1";
    const git = "github.com/company/service";
    const path = "/charts/service";

    const serviceConfig: IBedrockServiceConfig = {
      helm: {
        chart: {
          branch,
          git,
          path
        }
      }
    };

    /* tslint:disable-next-line: no-string-literal */
    const addHelmChartCommand = `fab add chart --source ${git} --path ${path} --branch ${branch}`;

    const expectedInvocation = `cd ${ringPath} && ${addHelmChartCommand}`;

    addChartToRing(exec, ringPath, serviceConfig);

    expect(exec).toBeCalled();
    expect(exec).toBeCalledWith(expectedInvocation);
  });

  it("should invoke the correct command for adding a helm chart with a git-sha", () => {
    const exec = jest.fn();
    const ringPath = "/path/to/ring";

    const sha = "f8a33e1d";
    const git = "github.com/company/service";
    const path = "/charts/service";

    const serviceConfig: IBedrockServiceConfig = {
      helm: {
        chart: {
          git,
          path,
          sha
        }
      }
    };

    /* tslint:disable-next-line: no-string-literal */
    const addHelmChartCommand = `fab add chart --source ${git} --path ${path} --version ${sha}`;

    const expectedInvocation = `cd ${ringPath} && ${addHelmChartCommand}`;

    addChartToRing(exec, ringPath, serviceConfig);

    expect(exec).toBeCalled();
    expect(exec).toBeCalledWith(expectedInvocation);
  });

  it("should invke the correct command for adding a helm chart with a helm repository", () => {
    const exec = jest.fn();
    const ringPath = "/path/to/ring";

    const repository = "github.com/company/service";
    const chart = "/charts/service";

    const serviceConfig: IBedrockServiceConfig = {
      helm: {
        chart: {
          chart,
          repository
        }
      }
    };

    /* tslint:disable-next-line: no-string-literal */
    const addHelmChartCommand = `fab add chart --source ${repository} --path ${chart}`;

    const expectedInvocation = `cd ${ringPath} && ${addHelmChartCommand}`;

    addChartToRing(exec, ringPath, serviceConfig);

    expect(exec).toBeCalled();
    expect(exec).toBeCalledWith(expectedInvocation);
  });
});
