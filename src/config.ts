import dotenv from "dotenv";
import fs from "fs";
import yaml from "js-yaml";
import * as os from "os";
import path from "path";
import { logger } from "./logger";
import { IBedrockFile, IConfigYaml, IMaintainersFile } from "./types";

////////////////////////////////////////////////////////////////////////////////
// State
////////////////////////////////////////////////////////////////////////////////
let spkConfig: IConfigYaml = {}; // DANGEROUS! this var is globally retrievable and mutable via Config()

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
 * Reads yaml file and loads any references to env vars from process.env
 * Throws an exception if any env variable references are not defined in
 * current shell.
 *
 * @param configYaml configuration in object form
 *
 * @returns The original object passed with the values referencing environment variables being swapped to their literal value
 */
const loadConfigurationFromLocalEnv = <T>(configObj: T): T => {
  const iterate = (obj: any) => {
    if (obj != null && obj !== undefined) {
      for (const [key, value] of Object.entries(obj)) {
        const regexp = /\${env:([a-zA-Z_$][a-zA-Z_$0-9]+)}/g;
        const match = regexp.exec(value as any);
        if (match && match.length >= 2) {
          const matchValue = match[1];
          if (process.env[matchValue]) {
            obj[key] = process.env[matchValue];
          } else {
            logger.error(`Env variable needs to be defined for ${matchValue}`);
            throw Error(
              `Environment variable needs to be defined for ${matchValue} since it's referenced in the config file.`
            );
          }
        }
        if (typeof obj[key] === "object") {
          iterate(obj[key]);
        }
      }
    }
  };

  iterate(configObj);
  return configObj;
};

////////////////////////////////////////////////////////////////////////////////
// Exported
////////////////////////////////////////////////////////////////////////////////
/**
 * Returns the global spk-config from the host user
 */
export const Config = (): IConfigYaml => {
  // Only load the config if it hasn't been loaded before (ie; its empty)
  if (Object.keys(spkConfig).length === 0) {
    try {
      loadConfiguration();
    } catch (err) {
      logger.warn(err);
    }
  }
  return spkConfig;
};

/**
 * Returns the current bedrock.yaml file for the project
 */
export const Bedrock = () =>
  readYaml<IBedrockFile>(path.join(process.cwd(), "bedrock.yaml"));

/**
 * Returns the current maintainers.yaml file for the project
 */
export const Maintainers = () =>
  readYaml<IMaintainersFile>(path.join(process.cwd(), "maintainers.yaml"));

/**
 * Helper to write out a bedrock.yaml or maintainers.yaml file to the project root
 *
 * @param file config file object to serialize and write out
 */
export const write = (
  file: IBedrockFile | IMaintainersFile,
  parentDirectory = process.cwd()
) => {
  const asYaml = yaml.safeDump(file, { lineWidth: Number.MAX_SAFE_INTEGER });
  if ("rings" in file) {
    // Is bedrock.yaml
    return fs.writeFileSync(path.join(parentDirectory, "bedrock.yaml"), asYaml);
  } else {
    // Is maintainers file
    return fs.writeFileSync(
      path.join(parentDirectory, "maintainers.yaml"),
      asYaml
    );
  }
};

/**
 * Fetches the absolute default path of the spk global config
 */
export const defaultFileLocation = () =>
  path.join(os.homedir(), ".spk", "config.yaml");

/**
 * Loads configuration from a given filename, if provided, otherwise
 * uses the default file location ~/.spk-config.yaml
 *
 * @param filepath file to load configuration from
 */
export const loadConfiguration = (filepath: string = defaultFileLocation()) => {
  try {
    fs.statSync(filepath);
    dotenv.config();
    const data = readYaml<IConfigYaml>(filepath);
    spkConfig = loadConfigurationFromLocalEnv(data);
  } catch (err) {
    logger.error(`An error occurred while loading configuration\n ${err}`);
    throw err;
  }
};
