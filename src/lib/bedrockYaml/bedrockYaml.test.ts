import uuid = require("uuid/v4");
import { createTestBedrockYaml } from "../../test/mockFactory";
import { BedrockFile, HelmConfig, RingConfig } from "../../types";
import { createTempDir } from "../ioUtil";
import {
  addNewRing,
  addNewService,
  create,
  DEFAULT_CONTENT,
  fileInfo,
  isExists,
  read,
  removeRing,
  setDefaultRing,
  validateRings,
  getRings,
} from "./bedrockYaml";

describe("Creation and Existence test on bedrock.yaml", () => {
  it("without folder name in creation function call", () => {
    const dir = create();
    expect(isExists(dir)).toBe(true);
    expect(read(dir)).toEqual(DEFAULT_CONTENT());
  });
  it("with folder name in creation function call", () => {
    const dir = createTempDir();
    create(dir);
    expect(isExists(dir)).toBe(true);
    expect(read(dir)).toEqual(DEFAULT_CONTENT());
  });
  it("withContent", () => {
    const dir = createTempDir();
    const data = {
      rings: {},
      services: [],
      version: "1.0",
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
  it("should update existing bedrock.yml with a new service and its helm chart config", () => {
    const servicePath = "packages/my-new-service";
    const svcDisplayName = "my-new-service";
    const helmConfig: HelmConfig = {
      chart: {
        chart: "somehelmchart",
        repository: "somehelmrepository",
      },
    };
    const traefikMiddlewares = ["foo", "bar"];
    const k8sBackendPort = 8080;
    const k8sBackend = "mybackendservice";
    const pathPrefix = "ingressprefix";
    const pathPrefixMajorVersion = "v2";

    const defaultBedrockFileObject = createTestBedrockYaml(
      false
    ) as BedrockFile;

    // "" means that bedrock.yaml is written to a random directory
    const dir = create("", defaultBedrockFileObject);

    addNewService(
      dir,
      servicePath,
      svcDisplayName,
      helmConfig,
      traefikMiddlewares,
      k8sBackendPort,
      k8sBackend,
      pathPrefix,
      pathPrefixMajorVersion
    );

    const expected: BedrockFile = {
      ...defaultBedrockFileObject,
      services: [
        ...(defaultBedrockFileObject as BedrockFile).services,
        {
          path: "./" + servicePath,
          displayName: svcDisplayName,
          helm: helmConfig,
          k8sBackend,
          k8sBackendPort,
          middlewares: traefikMiddlewares,
          pathPrefix,
          pathPrefixMajorVersion,
        },
      ],
      variableGroups: [],
      version: defaultBedrockFileObject.version,
    };

    expect(read(dir)).toEqual(expected);
  });
});

describe("Adding a new ring to an existing bedrock.yaml", () => {
  it("should update existing bedrock.yaml with a new service and its helm chart config", () => {
    const defaultBedrockFileObject = createTestBedrockYaml(
      false
    ) as BedrockFile;

    // "" means that bedrock.yaml is written to a random directory
    const dir = create("", defaultBedrockFileObject);

    const ringName = "new-ring";

    addNewRing(dir, ringName);

    const expected: BedrockFile = {
      rings: {
        ...(defaultBedrockFileObject as BedrockFile).rings,
        [ringName]: {},
      },
      services: [...(defaultBedrockFileObject as BedrockFile).services],
      variableGroups: [],
      version: defaultBedrockFileObject.version,
    };

    expect(read(dir)).toEqual(expected);
  });
});

describe("Bedrock file info", () => {
  it("Should File exist and hasVariableGroups both be false", () => {
    const dir = createTempDir();
    const file = fileInfo(dir);
    expect(file.exist).toEqual(false);
    expect(file.hasVariableGroups).toEqual(false);
  });

  it("Should File exist be true and hasVariableGroups be false", () => {
    const dir = createTempDir();
    create(dir);
    const file = fileInfo(dir);
    expect(file.exist).toEqual(true);
    expect(file.hasVariableGroups).toEqual(false);
  });

  it("Should File exist be true and hasVariableGroups be true", () => {
    const dir = createTempDir();
    const data = {
      rings: {},
      services: [],
      variableGroups: [uuid()],
      version: "1.0",
    };
    create(dir, data);
    const file = fileInfo(dir);
    expect(file.exist).toEqual(true);
    expect(file.hasVariableGroups).toEqual(true);
  });
});

describe("Set default ring", () => {
  it("Should set the default ring", () => {
    const dir = createTempDir();
    const data = {
      rings: {
        master: { isDefault: false },
        prod: {},
      },
      services: [],
      variableGroups: [uuid()],
      version: "1.0",
    };
    create(dir, data);
    setDefaultRing(data, "master", dir);
    const result = read(dir);
    expect(result.rings.master.isDefault).toBe(true);
    expect(result.rings.prod.isDefault).toBe(undefined);
  });
  it("Should change the default ring", () => {
    const dir = createTempDir();
    const data = {
      rings: {
        master: { isDefault: false },
        prod: { isDefault: true },
      },
      services: [],
      variableGroups: [uuid()],
      version: "1.0",
    };
    create(dir, data);
    setDefaultRing(data, "master", dir);
    const result = read(dir);
    expect(result.rings.master.isDefault).toBe(true);
    expect(result.rings.prod.isDefault).toBe(undefined);
  });
});

describe("removeRing", () => {
  it("removes a valid matching ring", () => {
    const original = createTestBedrockYaml(false) as BedrockFile;
    const ringToRemove = Object.keys(original.rings).pop() as string;
    expect(ringToRemove).toBeDefined();
    const updated = removeRing(original, ringToRemove);
    const originalWithoutRing = ((): BedrockFile => {
      const copy: BedrockFile = JSON.parse(JSON.stringify(original));
      delete copy.rings[ringToRemove];
      return copy;
    })();
    expect(Object.keys(updated.rings)).not.toContain(ringToRemove);
    expect(updated).toStrictEqual(originalWithoutRing);
  });

  it("throws when the ring doesn't exist", () => {
    const original = createTestBedrockYaml(false) as BedrockFile;
    expect(() => removeRing(original, uuid())).toThrow();
  });

  it("throws when the ring is found but isDefault === true", () => {
    const original = createTestBedrockYaml(false) as BedrockFile;
    const defaultRing = Object.entries(original.rings)
      .map(([name, config]) => ({ name, config }))
      .find(({ config }) => config.isDefault);
    const ringToRemove = defaultRing?.name;
    expect(ringToRemove).toBeDefined();
    expect(() => removeRing(original, ringToRemove as string)).toThrow();
  });
});

describe("validateRings", () => {
  const bedrockFile = createTestBedrockYaml(false) as BedrockFile;
  const tests: {
    name: string;
    actual: () => unknown;
    throws: boolean;
  }[] = [
    {
      name: "no default ring: does not throw",
      actual: (): unknown =>
        validateRings({
          ...bedrockFile,
          rings: { master: { isDefault: false }, qa: {} },
        }),
      throws: false,
    },
    {
      name: "one default ring: does not throw",
      actual: (): unknown =>
        validateRings({
          ...bedrockFile,
          rings: { master: { isDefault: true }, qa: {} },
        }),
      throws: false,
    },
    {
      name: "multiple default ring: throws",
      actual: (): unknown =>
        validateRings({
          ...bedrockFile,
          rings: { master: { isDefault: true }, qa: { isDefault: true } },
        }),
      throws: true,
    },
  ];

  for (const { name, actual, throws } of tests) {
    it(name, () => {
      if (throws) {
        expect(() => actual()).toThrow();
      } else {
        expect(() => actual()).not.toThrow();
      }
    });
  }
});

describe("getRings", () => {
  const tests: {
    name: string;
    actual: unknown;
    expected: Array<RingConfig & { name: string }>;
  }[] = [
    {
      name: "empty rings",
      actual: getRings({ rings: {}, services: [], version: "" }),
      expected: [],
    },
    {
      name: "one ring -- isDefault is automatically added to output",
      actual: getRings({
        rings: { master: {} },
        services: [],
        version: "",
      }),
      expected: [{ name: "master", isDefault: false }],
    },

    {
      name: "multiple rings -- isDefault is automatically added to output",
      actual: getRings({
        rings: {
          master: {},
          qa: { isDefault: false },
          dev: { isDefault: true },
        },
        services: [],
        version: "",
      }),
      expected: [
        { name: "master", isDefault: false },
        { name: "qa", isDefault: false },
        { name: "dev", isDefault: true },
      ],
    },
  ];

  for (const { name, actual, expected } of tests) {
    it(name, () => {
      expect(actual).toStrictEqual(expected);
    });
  }
});
