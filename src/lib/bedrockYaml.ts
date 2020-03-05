import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import { createTempDir } from "../lib/ioUtil";
import { logger } from "../logger";
import { IBedrockFile, IBedrockFileInfo, IHelmConfig } from "../types";

export const YAML_NAME = "bedrock.yaml";

export const DEFAULT_CONTENT: IBedrockFile = {
  rings: {},
  services: {},
  variableGroups: []
};

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
export const create = (dir?: string, data?: IBedrockFile): string => {
  dir = dir || createTempDir();
  const absPath = path.resolve(dir);
  data = data || DEFAULT_CONTENT;
  const asYaml = yaml.safeDump(data, {
    lineWidth: Number.MAX_SAFE_INTEGER
  });
  fs.writeFileSync(path.join(absPath, YAML_NAME), asYaml);
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
export const read = (dir: string): IBedrockFile => {
  const absPath = path.resolve(dir);
  const file = path.join(absPath, YAML_NAME);
  return yaml.safeLoad(fs.readFileSync(file, "utf8"));
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
 */
export const addNewService = (
  dir: string,
  newServicePath: string,
  svcDisplayName: string,
  helmConfig: IHelmConfig,
  middlewares: string[],
  k8sBackendPort: number,
  k8sBackend: string,
  pathPrefix: string,
  pathPrefixMajorVersion: string
) => {
  const absPath = path.resolve(dir);
  const data = read(absPath);

  data.services["./" + newServicePath] = {
    displayName: svcDisplayName,
    helm: helmConfig,
    k8sBackend,
    k8sBackendPort,
    middlewares,
    pathPrefix,
    pathPrefixMajorVersion
  };

  const asYaml = yaml.safeDump(data, {
    lineWidth: Number.MAX_SAFE_INTEGER
  });
  fs.writeFileSync(path.join(absPath, YAML_NAME), asYaml);
};

/**
 * Update bedrock.yaml with new ring
 *
 * @param dir Directory where <code>bedrock.yaml</code> file resides.
 * @param ringName ring to be added.
 */
export const addNewRing = (dir: string, ringName: string) => {
  const absPath = path.resolve(dir);
  const data: IBedrockFile = read(absPath);

  data.rings[ringName] = {}; // Alternatively, we can set isDefault = false or some passable value.

  const asYaml = yaml.safeDump(data, {
    lineWidth: Number.MAX_SAFE_INTEGER
  });
  fs.writeFileSync(path.join(absPath, YAML_NAME), asYaml);
};

/**
 * Returns bedrock file information
 *
 * @param rootProjectPath Path to read the bedrock.yaml file
 */
export const fileInfo = (rootProjectPath?: string): IBedrockFileInfo => {
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
      hasVariableGroups: (bedrockFile?.variableGroups ?? []).length > 0
    };
  } catch (error) {
    logger.error(error);
    return {
      exist: false,
      hasVariableGroups: false
    };
  }
};
