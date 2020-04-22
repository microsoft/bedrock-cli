import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import { logger } from "../../logger";
import {
  BedrockFile,
  BedrockFileInfo,
  HelmConfig,
  RingConfig,
  Rings,
} from "../../types";
import { writeVersion, getVersion } from "../fileutils";
import { build as buildError } from "../errorBuilder";
import { errorStatusCode } from "../errorStatusCode";
import { createTempDir } from "../ioUtil";
import * as indexByNameMigration from "./migrations/service-map-to-list";

export const YAML_NAME = "bedrock.yaml";

export const DEFAULT_CONTENT = (): BedrockFile => ({
  rings: {},
  services: [],
  variableGroups: [],
  version: getVersion(),
});

/**
 * Creates a <code>Bedrock.yaml</code> file.
 *
 * @param dir Folder where yaml shall be created.
 *            Yaml shall be created in a temporary directory
 *            if this value is not provided.
 * @param data Bedrock file content. Default content shall be
 *             created if this value is not provided
 * @return Folder where yaml is created.
 */
export const create = (dir?: string, data?: BedrockFile): string => {
  dir = dir || createTempDir();
  const absPath = path.resolve(dir);
  data = data || DEFAULT_CONTENT();
  const asYaml = yaml.safeDump(data, {
    lineWidth: Number.MAX_SAFE_INTEGER,
  });
  writeVersion(path.join(absPath, YAML_NAME));
  fs.appendFileSync(path.join(absPath, YAML_NAME), asYaml);
  return absPath;
};

/**
 * Returns true if bedrock.yaml exists in a given directory.
 *
 * @param dir path where bedrock.yaml is supposed to reside.
 * @return true if bedrock.yaml exists in a given directory.
 */
export const isExists = (dir: string): boolean => {
  if (!dir) {
    return false;
  }
  const absPath = path.resolve(dir);

  // Check if a bedrock.yaml already exists
  const bedrockFilePath = path.join(absPath, YAML_NAME);
  return fs.existsSync(bedrockFilePath);
};

/**
 * Read bedrock.yaml content as JSON object.
 *
 * @param dir path where bedrock.yaml is supposed to reside.
 */
export const read = (dir: string): BedrockFile => {
  const absPath = path.resolve(dir);
  const file = path.join(absPath, YAML_NAME);
  const b = yaml.safeLoad(fs.readFileSync(file, "utf8"));
  return indexByNameMigration.migrate(b, dir);
};

/**
 * Update bedrock.yaml with new service
 *
 * @param dir Directory where <code>bedrock.yaml</code> file resides.
 * @param newServicePath Service Path
 * @param svcDisplayName Service Display Name
 * @param helmConfig Helm Configuration
 * @param middlewares List of middlewares
 * @param k8sBackendPort Kubernetes Service Port
 * @param k8sBackend Kubernetes Backend Service name
 * @param pathPrefix Pathprefix for IngressRoute
 * @param pathPrefixMajorVersion PathPrefix major version
 * @param buildVariableGroup Variable group Name
 */
export const addNewService = (
  dir: string,
  newServicePath: string,
  svcDisplayName: string,
  helmConfig: HelmConfig,
  middlewares: string[],
  k8sBackendPort: number,
  k8sBackend: string,
  pathPrefix: string,
  pathPrefixMajorVersion: string,
  serviceBuildVg: string[],
  serviceBuildVariables: string[]
): void => {
  const absPath = path.resolve(dir);
  const data = read(absPath);

  data.services = [
    ...data.services.filter((s) => s.displayName !== svcDisplayName),
    {
      displayName: svcDisplayName,
      path: "./" + newServicePath,
      helm: helmConfig,
      k8sBackend,
      k8sBackendPort,
      middlewares,
      pathPrefix,
      pathPrefixMajorVersion,
      serviceBuildVg,
      serviceBuildVariables,
    },
  ];

  const asYaml = yaml.safeDump(data, {
    lineWidth: Number.MAX_SAFE_INTEGER,
  });
  fs.writeFileSync(path.join(absPath, YAML_NAME), asYaml);
};

/**
 * Sets the default ring in bedrock.yaml
 * @param bedrockFile The bedrock.yaml file
 * @param ringName The name of the ring
 */
export const setDefaultRing = (
  bedrockFile: BedrockFile,
  ringName: string,
  dir: string
): void => {
  const rings = Object.keys(bedrockFile.rings);
  if (!rings.includes(ringName)) {
    throw buildError(errorStatusCode.FILE_IO_ERR, {
      errorKey: "bedrock-yaml-ring-set-default-not-found",
      values: [ringName, YAML_NAME],
    });
  }

  for (const [name, value] of Object.entries(bedrockFile.rings)) {
    if (value === null) {
      bedrockFile.rings[name] = {};
    }
    const ring = bedrockFile.rings[name];

    if (name === ringName) {
      ring.isDefault = true;
    } else {
      if (typeof ring.isDefault !== "undefined") {
        delete ring.isDefault;
      }
    }
  }

  create(dir, bedrockFile);
};
/**
 * Update bedrock.yaml with new ring
 *
 * @param dir Directory where <code>bedrock.yaml</code> file resides.
 * @param ringName ring to be added.
 */
export const addNewRing = (dir: string, ringName: string): void => {
  const absPath = path.resolve(dir);
  const data: BedrockFile = read(absPath);

  data.rings[ringName] = {}; // Alternatively, we can set isDefault = false or some passable value.

  const asYaml = yaml.safeDump(data, {
    lineWidth: Number.MAX_SAFE_INTEGER,
  });
  fs.writeFileSync(path.join(absPath, YAML_NAME), asYaml);
};

/**
 * Returns bedrock file information
 *
 * @param rootProjectPath Path to read the bedrock.yaml file
 */
export const fileInfo = (rootProjectPath?: string): BedrockFileInfo => {
  rootProjectPath = rootProjectPath || process.cwd();

  const absProjectPath = path.resolve(rootProjectPath);

  try {
    const bedrockFile = read(absProjectPath);
    logger.debug(
      `variableGroups length: ${bedrockFile?.variableGroups?.length}`
    );
    logger.verbose(`bedrockFile: \n ${JSON.stringify(bedrockFile)}`);
    return {
      exist: true,
      hasVariableGroups: (bedrockFile?.variableGroups ?? []).length > 0,
    };
  } catch (error) {
    logger.error(error);
    return {
      exist: false,
      hasVariableGroups: false,
    };
  }
};

/**
 * Deletes the target ring with name `ringToDelete` from the provided `bedrock`
 * config.
 *
 * @throws {Error} if ring is not found in `bedrock`
 * @throws {Error} if the matching ring is `isDefault === true`
 *
 * @param bedrock the bedrock file to remove the ring from
 * @param ringToDelete the name of the ring to remove
 */
export const removeRing = (
  bedrock: BedrockFile,
  ringToDelete: string
): BedrockFile => {
  // Check if ring exists, if not, warn and exit
  const rings = Object.entries(bedrock.rings).map(([name, config]) => ({
    config,
    name,
  }));
  const matchingRing = rings.find(({ name }) => name === ringToDelete);
  if (matchingRing === undefined) {
    throw buildError(errorStatusCode.FILE_IO_ERR, {
      errorKey: "bedrock-yaml-ring-remove-not-found",
      values: [ringToDelete, "bedrock.yaml"],
    });
  }

  // Check if ring is default, if so, warn "Cannot delete default ring
  // set a new default via `spk ring set-default` first." and exit
  if (matchingRing.config.isDefault) {
    throw buildError(errorStatusCode.ENV_SETTING_ERR, {
      errorKey: "bedrock-yaml-ring-remove-default",
      values: [matchingRing.name],
    });
  }

  // Remove the ring
  const updatedRings: Rings = rings.reduce((updated, ring) => {
    if (ring.name === ringToDelete) {
      return updated;
    }
    return { ...updated, [ring.name]: ring.config };
  }, {});
  const bedrockWithoutRing: BedrockFile = {
    ...bedrock,
    rings: updatedRings,
  };

  return bedrockWithoutRing;
};

/**
 * Returns a list of Ring configurations with an added `name` parameter which
 * it is indexed on.
 *
 * @param b bedrock config file
 */
export const getRings = (
  b: BedrockFile
): Array<RingConfig & { name: string }> => {
  return Object.entries(b.rings).map(([name, config]) => ({
    ...config,
    name,
    isDefault: !!config.isDefault,
  }));
};

/**
 * Validates that the rings in `bedrock` are valid and throws an Error if not.
 *
 * @param bedrock file to validate the rings
 * @throws if more than one ring is marked `isDefault`
 */
export const validateRings = (bedrock: BedrockFile): void => {
  const rings = getRings(bedrock);
  const defaultRings = rings.filter((ring) => ring.isDefault);
  if (defaultRings.length > 1) {
    const defaultRingsNames = defaultRings.map((ring) => ring.name).join(", ");
    throw buildError(errorStatusCode.ENV_SETTING_ERR, {
      errorKey: "bedrock-yaml-ring-validation-err-many-rings",
      values: [defaultRingsNames],
    });
  }
};
