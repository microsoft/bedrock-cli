import { BedrockFile } from "../../../types";
import * as migration from "./service-map-to-list";
import { LegacyBedrockFile } from "./service-map-to-list";
import uuid from "uuid/v4";
import * as fs from "fs";
import * as bedrockYaml from "../bedrockYaml";
import * as os from "os";
import * as path from "path";
import yaml from "js-yaml";
import { getVersion } from "../../fileutils";

describe("isLegacySchema", () => {
  type test = {
    name: string;
    actual: () => unknown;
    expected: unknown;
    effects?: (() => void)[];
  };
  const createTest = (
    b: LegacyBedrockFile | BedrockFile,
    legacy: boolean
  ): test => {
    return {
      name: `${JSON.stringify(b.services)} == ${legacy}`,
      actual: (): unknown => migration.isLegacySchema(b),
      expected: legacy,
    };
  };
  const tests: test[] = [
    createTest(
      {
        rings: {},
        services: {},
        version: "0.5.8",
      },
      true
    ),
    createTest(
      {
        rings: {},
        services: [],
        version: "0.5.8",
      },
      false
    ),
  ];

  for (const { name, actual, expected, effects } of tests) {
    it(name, () => {
      expect(actual()).toStrictEqual(expected);
      for (const effect of effects ?? []) {
        effect();
      }
    });
  }
});

describe("convertToNewSchema", () => {
  const tests: {
    name: string;
    actual: () => unknown;
    expected: BedrockFile;
    effects?: (() => void)[];
  }[] = [
    {
      name: "converts empty service map to empty list",
      actual: (): BedrockFile =>
        migration.convertToNewSchema({
          rings: {},
          services: {},
          version: "0.5.8",
        }),
      expected: {
        rings: {},
        services: [],
        version: "0.5.8",
      },
    },

    {
      name:
        "service index is swapped with displayName, correct path is injected, displayName is removed",
      actual: (): BedrockFile =>
        migration.convertToNewSchema({
          rings: {
            master: { isDefault: true },
            preProd: { isDefault: false },
            qa: {},
          },
          services: {
            "./foo": {
              displayName: "foo-display-name",
              helm: {
                chart: {
                  git: "foo.bar.git",
                  path: "foo",
                  branch: "master",
                },
              },
              k8sBackendPort: 80,
            },
            "./src/bar": {
              displayName: "bar-display-name",
              helm: {
                chart: {
                  git: "foo.bar.git",
                  path: "bar",
                  branch: "master",
                },
              },
              k8sBackendPort: 80,
            },
          },
          version: "0.5.8",
        }),
      expected: {
        rings: {
          master: { isDefault: true },
          preProd: { isDefault: false },
          qa: {},
        },
        services: [
          {
            displayName: "foo-display-name",
            path: "./foo",
            helm: {
              chart: {
                git: "foo.bar.git",
                path: "foo",
                branch: "master",
              },
            },
            k8sBackendPort: 80,
          },
          {
            displayName: "bar-display-name",
            path: "./src/bar",
            helm: {
              chart: {
                git: "foo.bar.git",
                path: "bar",
                branch: "master",
              },
            },
            k8sBackendPort: 80,
          },
        ],
        version: "0.5.8",
      },
    },
  ];

  for (const { name, actual, expected, effects } of tests) {
    it(name, () => {
      expect(actual()).toStrictEqual(expected);
      for (const effect of effects ?? []) {
        effect();
      }
    });
  }
});

describe("migrate", () => {
  let tempDir: string;
  let tempBed: LegacyBedrockFile | BedrockFile;

  const tests: {
    name: string;
    actual: () => unknown;
    expected: unknown;
    effects?: (() => void)[];
  }[] = [
    {
      name: "Non-legacy is noop",
      actual: (): unknown => {
        // scaffold a "current" schema bedrock
        tempDir = bedrockYaml.create();
        tempBed = yaml.load(
          fs.readFileSync(path.join(tempDir, bedrockYaml.YAML_NAME), "utf8")
        );
        // migrate non-legacy yaml
        return migration.migrate(tempBed, tempDir);
      },
      expected: {
        rings: {},
        services: [],
        variableGroups: [],
        version: getVersion(),
      },
    },

    {
      name: "Legacy gets converted - empty service map",
      actual: (): unknown => {
        // scaffold a legacy style bedrock.yaml
        tempDir = path.join(os.tmpdir(), uuid());
        const bedPath = path.join(tempDir, bedrockYaml.YAML_NAME);
        fs.mkdirSync(tempDir);
        fs.writeFileSync(
          bedPath,
          yaml.safeDump({ rings: {}, services: {}, version: "" })
        );
        tempBed = yaml.safeLoad(fs.readFileSync(bedPath, "utf8"));
        // migrate the legacy yaml
        return migration.migrate(tempBed, tempDir);
      },
      expected: { rings: {}, services: [], version: "" },
      effects: [
        (): void => {
          // load the modified yaml via filesystem
          const modified = yaml.load(
            fs.readFileSync(path.join(tempDir, bedrockYaml.YAML_NAME), "utf8")
          );
          // it should match the new schema
          expect(modified).toStrictEqual({
            rings: {},
            services: [],
            version: "",
          });
        },
      ],
    },

    {
      name: "Legacy gets converted - non-empty service map",
      actual: (): unknown => {
        // scaffold legacy bedrock.yaml with services
        tempDir = path.join(os.tmpdir(), uuid());
        const bedPath = path.join(tempDir, bedrockYaml.YAML_NAME);
        fs.mkdirSync(tempDir);
        fs.writeFileSync(
          bedPath,
          yaml.safeDump({
            rings: {},
            services: {
              "./foo": { displayName: "foo-service" },
              "./bar": { displayName: "bar-service" },
            },
            version: "",
          })
        );
        tempBed = yaml.safeLoad(fs.readFileSync(bedPath, "utf8"));
        // migrate the yaml
        return migration.migrate(tempBed, tempDir);
      },
      expected: {
        rings: {},
        services: expect.arrayContaining([
          expect.objectContaining({
            path: "./foo",
            displayName: "foo-service",
          }),
          expect.objectContaining({
            path: "./bar",
            displayName: "bar-service",
          }),
        ]),
        version: "",
      },
      effects: [
        (): void => {
          // load the modified yaml from system
          const modified = yaml.load(
            fs.readFileSync(path.join(tempDir, bedrockYaml.YAML_NAME), "utf8")
          );
          // updated yaml should match new schema
          expect(modified).toStrictEqual({
            rings: {},
            services: expect.arrayContaining([
              expect.objectContaining({
                path: "./foo",
                displayName: "foo-service",
              }),
              expect.objectContaining({
                path: "./bar",
                displayName: "bar-service",
              }),
            ]),
            version: "",
          });
        },
      ],
    },
  ];

  for (const { name, actual, expected, effects } of tests) {
    it(name, () => {
      expect(actual()).toStrictEqual(expected);
      for (const effect of effects ?? []) {
        effect();
      }
    });
  }
});
