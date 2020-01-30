import { createTempDir } from "../lib/ioUtil";
import { createTestBedrockYaml } from "../test/mockFactory";
import { IBedrockFile, IHelmConfig } from "../types";
import {
  addNewService,
  create,
  DEFAULT_CONTENT,
  isExists,
  read
} from "./bedrockYaml";

describe("Creation and Existence test on bedrock.yaml", () => {
  it("without folder name in creation function call", () => {
    const dir = create();
    expect(isExists(dir)).toBe(true);
    expect(read(dir)).toEqual(DEFAULT_CONTENT);
  });
  it("with folder name in creation function call", () => {
    const dir = createTempDir();
    create(dir);
    expect(isExists(dir)).toBe(true);
    expect(read(dir)).toEqual(DEFAULT_CONTENT);
  });
  it("withContent", () => {
    const dir = createTempDir();
    const data = {
      rings: {},
      services: {}
    };
    create(dir, data);
    expect(isExists(dir)).toBe(true);
    expect(read(dir)).toEqual(data);
  });
  it("isExist call without a folder", () => {
    expect(isExists("")).toBe(false);
  });
});

describe("Adding a new service to a Bedrock file", () => {
  it("should update existing bedrock.yml with a new service and its helm chart config", async () => {
    const servicePath = "packages/my-new-service";
    const svcDisplayName = "my-new-service";
    const helmConfig: IHelmConfig = {
      chart: {
        chart: "somehelmchart",
        repository: "somehelmrepository"
      }
    };
    const traefikMiddlewares = ["foo", "bar"];
    const k8sServicePort = 8080;

    const defaultBedrockFileObject = createTestBedrockYaml(
      false
    ) as IBedrockFile;

    // "" means that bedrock.yaml is written to a random directory
    const dir = create("", defaultBedrockFileObject);

    addNewService(
      dir,
      servicePath,
      svcDisplayName,
      helmConfig,
      traefikMiddlewares,
      k8sServicePort
    );

    const expected: IBedrockFile = {
      rings: {},
      services: {
        ...(defaultBedrockFileObject as IBedrockFile).services,
        ["./" + servicePath]: {
          displayName: svcDisplayName,
          helm: helmConfig,
          k8sServicePort,
          middlewares: traefikMiddlewares
        }
      },
      variableGroups: []
    };

    expect(read(dir)).toEqual(expected);
  });
});
