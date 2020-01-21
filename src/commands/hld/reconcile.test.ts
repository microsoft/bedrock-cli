import { disableVerboseLogging, enableVerboseLogging } from "../../logger";

import {
  addChartToRing,
  checkForFabrikate,
  createRepositoryComponent,
  createRingComponent,
  createServiceComponent,
  createStaticComponent,
  IReconcileDependencies,
  reconcileHld,
  testAndGetAbsPath,
  validateInputs
} from "./reconcile";

import { IBedrockFile, IBedrockServiceConfig } from "../../types";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("validateInputs", () => {
  it("should not accept an invalid input for repository-name", () => {
    expect(() => {
      validateInputs(10, "hld-path", "app-path");
    }).toThrow();
  });

  it("should not accept an invalid input for hld-path", () => {
    expect(() => {
      validateInputs("repo-name", 10, "app-path");
    }).toThrow();
  });

  it("should not accept an invalid input for bedrock-application-repo-path", () => {
    expect(() => {
      validateInputs("repo-name", "repo-name", 10);
    }).toThrow();
  });

  it("should accept valid inputs for validateInputs", () => {
    expect(() => {
      validateInputs("repo-name", "repo-name", "bedrock-application-repo-path");
    }).not.toThrow();
  });
});

describe("checkForFabrikate", () => {
  it("throws an error if fabrikate is not installed", () => {
    const which = jest.fn();
    which.mockReturnValue("");

    expect(() => {
      checkForFabrikate(which);
    }).toThrow();
  });

  it("does not throw an error if fabrikate is installed", () => {
    const which = jest.fn();
    which.mockReturnValue("/some/path/to/fabrikate");

    expect(() => {
      checkForFabrikate(which);
    }).not.toThrow();
  });
});

describe("testAndGetAbsPath", () => {
  it("fails to test and get an absolute path for a file", () => {
    const test = jest.fn();
    const log = jest.fn();

    expect(() => {
      // Could not find the path.
      test.mockReturnValue(false);

      testAndGetAbsPath(test, log, "/some/path/to/hld-path", "hld-path");
    }).toThrow();
  });

  it("finds an absolute path for a file", () => {
    const test = jest.fn();
    const log = jest.fn();

    expect(() => {
      // Could not find the path.
      test.mockReturnValue(true);

      testAndGetAbsPath(test, log, "/some/path/to/hld-path", "hld-path");
    }).not.toThrow();
  });
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

  it("should invoke the correct command for adding a helm chart with a helm repository", () => {
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

describe("reconcile tests", () => {
  let dependencies: IReconcileDependencies;
  let bedrockYaml: IBedrockFile;
  const sha = "f8a33e1d";
  const git = "github.com/company/service";
  const path = "/charts/service";

  beforeEach(() => {
    dependencies = {
      addChartToRing: jest.fn(),
      createIngressRouteForRing: jest.fn(),
      createMiddlewareForRing: jest.fn(),
      createRepositoryComponent: jest.fn(),
      createRingComponent: jest.fn(),
      createServiceComponent: jest.fn(),
      createStaticComponent: jest.fn(),
      exec: jest.fn(),
      test: jest.fn().mockReturnValue(false),
      writeFile: jest.fn()
    };

    bedrockYaml = {
      rings: {
        dev: {
          isDefault: true
        },
        prod: {}
      },
      services: {
        "./path/to/svc/": {
          disableRouteScaffold: false,
          helm: {
            chart: {
              git,
              path,
              sha
            }
          }
        }
      }
    };
  });

  it("executes the appropriate functions for creating or updating a HLD", async () => {
    await reconcileHld(dependencies, bedrockYaml, "service", "./path/to/hld");

    expect(dependencies.createRepositoryComponent).toHaveBeenCalled();
    expect(dependencies.createServiceComponent).toHaveBeenCalledTimes(1);
    expect(dependencies.createRingComponent).toHaveBeenCalledTimes(2);
    expect(dependencies.addChartToRing).toHaveBeenCalledTimes(2);
    expect(dependencies.createStaticComponent).toHaveBeenCalledTimes(2);
    expect(dependencies.createMiddlewareForRing).toHaveBeenCalledTimes(2);
    expect(dependencies.createIngressRouteForRing).toHaveBeenCalledTimes(2);
  });

  it("should be able to create a HLD without rings, when no rings are provided", async () => {
    // bedrock yaml fixture
    bedrockYaml.rings = {};

    await reconcileHld(dependencies, bedrockYaml, "service", "./path/to/hld");

    expect(dependencies.createRepositoryComponent).toHaveBeenCalled();
    expect(dependencies.createServiceComponent).toHaveBeenCalledTimes(1);
    expect(dependencies.createRingComponent).not.toHaveBeenCalled();
  });

  it("does not produce ingress routes or middlewares when route scaffold is disabled", async () => {
    // bedrock yaml fixture
    bedrockYaml = {
      rings: {
        dev: {
          isDefault: true
        }
      },
      services: {
        "./path/to/svc/": {
          disableRouteScaffold: true,
          helm: {
            chart: {
              git,
              path,
              sha
            }
          }
        }
      }
    };

    await reconcileHld(dependencies, bedrockYaml, "service", "./path/to/hld");

    expect(dependencies.createRepositoryComponent).toHaveBeenCalled();
    expect(dependencies.createServiceComponent).toHaveBeenCalledTimes(1);
    expect(dependencies.createRingComponent).toHaveBeenCalledTimes(1);
    expect(dependencies.addChartToRing).toHaveBeenCalledTimes(1);
    expect(dependencies.createStaticComponent).toHaveBeenCalledTimes(1);

    // Skipping route generation.
    expect(dependencies.createMiddlewareForRing).not.toHaveBeenCalled();
    expect(dependencies.createIngressRouteForRing).not.toHaveBeenCalled();
  });

  it("does not create a ring, if one already exists", async () => {
    bedrockYaml.rings = {};

    await reconcileHld(dependencies, bedrockYaml, "service", "./path/to/hld");

    expect(dependencies.createRingComponent).not.toHaveBeenCalled();
    expect(dependencies.createStaticComponent).not.toHaveBeenCalled();
    expect(dependencies.createMiddlewareForRing).not.toHaveBeenCalled();
    expect(dependencies.createIngressRouteForRing).not.toHaveBeenCalled();
  });
});
