import dotenv from "dotenv";
import fs from "fs";
import yaml from "js-yaml";
import * as os from "os";
import path from "path";
import { getSecret } from "./lib/azure/keyvault";
import { logger } from "./logger";
import {
  AzurePipelinesYaml,
  BedrockFile,
  ConfigYaml,
  MaintainersFile
} from "./types";

////////////////////////////////////////////////////////////////////////////////
// State
////////////////////////////////////////////////////////////////////////////////
let spkConfig: ConfigYaml = {}; // DANGEROUS! this var is globally retrievable and mutable via Config()
let hasWarnedAboutUninitializedConfig = false; // has emitted an initialization warning if global config does not exist
////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////
/**
 * Helper function to parse a YAML file
 *
 * @throws {Error} when the file does not exist
 *
 * @param filepath filepath of the yaml file
 */
export const readYaml = <T>(filepath: string): T => {
  if (fs.existsSync(filepath)) {
    const contents = fs.readFileSync(filepath, "utf8");
    return yaml.safeLoad(contents) as T;
  }
  throw Error(`Unable to load file '${filepath}'`);
};

/**
 * Updates env variable(s) from process.env
 * Supports multiple per value
 * @param value Value from config file to be replaced with env vars
 */
export const updateVariableWithLocalEnv = (value: string): string => {
  const regexp = /\${env:([a-zA-Z_$][a-zA-Z_$0-9]+)}/;
  let matches = regexp.exec(value);
  while (matches) {
    if (matches.length > 1) {
      if (process.env[matches[1]]) {
        value = value.replace(matches[0], process.env[matches[1]] as string);
      } else {
        logger.error(`Env variable needs to be defined for ${matches[1]}`);
        throw Error(
          `Environment variable needs to be defined for ${matches[1]} since it's referenced in the config file.`
        );
      }
      matches = regexp.exec(value);
    }
  }
  return value;
};

/**
 * Reads yaml file and loads any references to env vars from process.env
 * Throws an exception if any env variable references are not defined in
 * current shell.
 *
 * @param configYaml configuration in object form
 *
 * @returns The original object passed with the values referencing environment variables being swapped to their literal value
 */
export const loadConfigurationFromLocalEnv = <T>(configObj: T): T => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iterate = (obj: any): void => {
    if (obj !== null && obj !== undefined) {
      for (const [key, value] of Object.entries(obj)) {
        obj[key] = updateVariableWithLocalEnv(value as string);
        if (typeof obj[key] === "object") {
          iterate(obj[key]);
        }
      }
    }
  };

  iterate(configObj);
  return configObj;
};

const getKeyVaultSecret = async (
  keyVaultName: string | undefined,
  storageAccountName: string | undefined
): Promise<string | undefined> => {
  logger.debug(`Fetching key from key vault`);
  let keyVaultKey: string | undefined;

  // fetch storage access key from key vault when it is configured
  if (
    keyVaultName !== undefined &&
    keyVaultName !== null &&
    storageAccountName !== undefined
  ) {
    keyVaultKey = await getSecret(keyVaultName, `${storageAccountName}Key`);
  }

  if (keyVaultKey === undefined) {
    keyVaultKey = await spkConfig.introspection?.azure?.key;
  }

  return keyVaultKey;
};

/**
 * Fetches the absolute default directory of the spk global config
 */
export const defaultConfigDir = (): string => {
  const dir = path.join(os.homedir(), ".spk");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  return dir;
};

/**
 * Fetches the absolute default path of the spk global config
 */
export const defaultConfigFile = (): string =>
  path.join(defaultConfigDir(), "config.yaml");

/**
 * Loads configuration from a given filename, if provided, otherwise
 * uses the default file location ~/.spk-config.yaml
 *
 * @param filepath file to load configuration from
 */
export const loadConfiguration = (
  filepath: string = defaultConfigFile()
): void => {
  try {
    fs.statSync(filepath);
    dotenv.config();
    const data = readYaml<ConfigYaml>(filepath);
    spkConfig = loadConfigurationFromLocalEnv(data || {});
  } catch (err) {
    logger.verbose(`An error occurred while loading configuration\n ${err}`);
    throw err;
  }
};

////////////////////////////////////////////////////////////////////////////////
// Exported
////////////////////////////////////////////////////////////////////////////////
/**
 * Returns the global spk-config from the host user
 */
export const Config = (): ConfigYaml => {
  // Only load the config if it hasn't been loaded before (ie; its empty)
  if (Object.keys(spkConfig).length === 0) {
    try {
      loadConfiguration();
    } catch (err) {
      logger.verbose(err);
      if (!hasWarnedAboutUninitializedConfig) {
        logger.info(
          `Unable to load SPK configuration file; run \`spk init\` to initialize your global configuration or ensure you have passed all required parameters to the called function.`
        );
        hasWarnedAboutUninitializedConfig = true;
      }
    }
  }

  const introspectionAzure = {
    ...spkConfig.introspection?.azure,
    get key(): Promise<string | undefined> {
      const accountName = spkConfig.introspection?.azure?.account_name;
      return getKeyVaultSecret(spkConfig.key_vault_name, accountName);
    }
  };

  return {
    ...spkConfig,
    introspection: {
      ...spkConfig.introspection,
      azure: introspectionAzure
    }
  };
};

/**
 * Returns the current bedrock.yaml file for the project
 *
 * Does some validations against the file; if errors occur, an Exception is
 * thrown:
 * - Validates the helm configurations for all service entries
 *
 * @param fileDirectory the project directory containing the bedrock.yaml file
 */
export const Bedrock = (fileDirectory = process.cwd()): BedrockFile => {
  const bedrockYamlPath = path.join(fileDirectory, "bedrock.yaml");
  const bedrock = readYaml<BedrockFile>(bedrockYamlPath);
  const { services } = bedrock;

  // validate service helm configurations
  const helmErrors: Error[] = Object.entries(services)
    .map(([servicePath, serviceConfig]) => {
      const { chart } = serviceConfig.helm;
      const isGitBased =
        "git" in chart &&
        "path" in chart &&
        ("branch" in chart || "sha" in chart);
      const isHelmBased = "repository" in chart && "chart" in chart;
      if (!isGitBased && !isHelmBased) {
        const requiredGitValues = ["git", "path", "branch|sha"];
        const requiredHelmValues = ["repository", "chart"];
        return Error(
          `invalid helm configuration found in service ${servicePath}, helm configuration expects a set of keys matching ${JSON.stringify(
            requiredGitValues
          )} or ${JSON.stringify(requiredHelmValues)}; found: ${JSON.stringify(
            chart
          )}`
        );
      }
    })
    .filter(e => !!e) as Error[];
  // log all the errors and throw an exception if their are any
  if (helmErrors.length > 0) {
    for (const error of helmErrors) {
      logger.error(error);
    }
    throw Error(`invalid helm configuration found in ${bedrockYamlPath}`);
  }

  return { ...bedrock };
};

/**
 * Async wrapper for the Bedrock() function
 * Use this if preferring to use Promise based control flow over try/catch as
 * Bedrock() can throw and Error
 *
 * @param fileDirectory the project directory containing the bedrock.yaml file
 */
export const BedrockAsync = async (
  fileDirectory = process.cwd()
): Promise<BedrockFile> => Bedrock(fileDirectory);

/**
 * Returns the current maintainers.yaml file for the project
 */
export const Maintainers = (
  fileDirectory: string = process.cwd()
): MaintainersFile =>
  readYaml<MaintainersFile>(path.join(fileDirectory, "maintainers.yaml"));

/**
 * Async wrapper for Maintainers() function
 * Use this if preferring to use Promise based control flow over try/catch as
 * Maintainers() can throw and Error
 *
 * @param fileDirectory the project directory containing the maintainers.yaml file
 */
export const MaintainersAsync = async (
  fileDirectory: string = process.cwd()
): Promise<MaintainersFile> => Maintainers(fileDirectory);

/**
 * Helper to write out a bedrock.yaml or maintainers.yaml file to the project root
 *
 * @param file config file object to serialize and write out
 */
export const write = (
  file: BedrockFile | MaintainersFile | AzurePipelinesYaml,
  targetDirectory = process.cwd(),
  fileName?: string
): void => {
  const asYaml = yaml.safeDump(file, { lineWidth: Number.MAX_SAFE_INTEGER });
  if ("rings" in file) {
    // Is bedrock.yaml
    return fs.writeFileSync(path.join(targetDirectory, "bedrock.yaml"), asYaml);
  } else if ("services" in file) {
    // Is maintainers file
    return fs.writeFileSync(
      path.join(targetDirectory, "maintainers.yaml"),
      asYaml
    );
  } else {
    // Is azure pipelines yaml file
    if (typeof fileName === "undefined") {
      throw new Error(`Pipeline yaml file name is undefined`);
    }

    return fs.writeFileSync(path.join(targetDirectory, fileName), asYaml);
  }
};

/**
 * Writes the global config object to default location
 * @param sourceFilePath The source configuration file
 * @param targetDir The optional target directory to store the configuration to override the default directory
 */
export const saveConfiguration = (
  sourceFilePath: string,
  targetDir: string = defaultConfigDir()
): void => {
  try {
    const data = yaml.safeDump(readYaml<ConfigYaml>(sourceFilePath));
    const targetFile = path.join(targetDir, "config.yaml");
    fs.writeFileSync(targetFile, data);
  } catch (err) {
    logger.error(
      `Error occurred while writing config to default location ${err}`
    );
  }
};
