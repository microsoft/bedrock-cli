import commander from "commander";
import dotenv = require("dotenv");
import * as fs from "fs";
import yaml from "js-yaml";
import * as os from "os";
import { logger } from "../logger";
import { IConfigYaml } from "../types";

export const defaultFileLocation = os.homedir() + "/.spk/config.yaml";
export let config: IConfigYaml = {};

/**
 * Adds the init command to the commander command object
 * @param command Commander command object to decorate
 */
export const initCommandDecorator = (command: commander.Command): void => {
  command
    .command("init")
    .alias("i")
    .description("Initialize the spk tool for the first time")
    .option("-f, --file <config-file-path>", "Path to the config file")
    .action(async opts => {
      try {
        if (!opts.file) {
          logger.error(
            "You need to specify a file that stores configuration. "
          );
          return;
        }
        loadConfiguration(opts.file);

        await writeConfigToDefaultLocation();

        logger.info("Successfully initialized the spk tool!");
      } catch (err) {
        logger.error(`Error occurred while initializing`);
        logger.error(err);
      }
    });
};

/**
 * Loads configuration from a given filename, if provided, otherwise
 * uses the default file location ~/.spk-config.yaml
 * @param fileName file to load configuration from
 */
export const loadConfiguration = (fileName?: string) => {
  if (!fileName) {
    fileName = defaultFileLocation;
  }
  try {
    fs.statSync(fileName);
    dotenv.config();
    const data: IConfigYaml = readYamlFile<IConfigYaml>(fileName!);
    loadConfigurationFromLocalEnv<IConfigYaml>(data);
  } catch (err) {
    logger.error(`An error occurred while loading configuration\n ${err}`);
    throw err;
  }
};

/**
 * Reads yaml file and loads any references to env vars from process.env
 * Throws an exception if any env variable references are not defined in
 * current shell
 * @param configYaml configuration in object form
 */
export const loadConfigurationFromLocalEnv = <T>(configObj: T) => {
  const iterate = (obj: any) => {
    if (obj != null && obj !== undefined) {
      Object.keys(obj).forEach(key => {
        const regexp = /\${env:([a-zA-Z_$][a-zA-Z_$0-9]+)}/g;
        const match = regexp.exec(obj[key]);
        if (match && match.length >= 2) {
          if (process.env[match[1]]) {
            obj[key] = process.env[match[1]];
          } else {
            logger.error(`Env variable needs to be defined for ${match[1]}`);
            throw new Error(
              `Environment variable needs to be defined for ${match[1]} since it's referenced in the config file.`
            );
          }
        }
        if (typeof obj[key] === "object") {
          iterate(obj[key]);
        }
      });
    }
  };

  iterate(configObj);
  // Set the global config so env vars are loaded into it
  config = configObj;
};

/**
 * Reads a YAML file and loads it into an object
 * @param fileLocation path to the config file to read
 */
export const readYamlFile = <T>(fileLocation: string): T => {
  const data: string = fs.readFileSync(fileLocation, "utf-8");
  try {
    const response = yaml.safeLoad(data) as T;
    return response;
  } catch (err) {
    logger.error(`Unable to parse config file ${fileLocation}`);
    throw err;
  }
};

/**
 * Writes the global config object to default location
 */
export const writeConfigToDefaultLocation = async () => {
  try {
    const data = yaml.safeDump(config);
    const defaultDir = os.homedir() + "/.spk";
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir);
    }
    fs.writeFileSync(defaultFileLocation, data);
  } catch (err) {
    logger.error(
      `Error occurred while writing config to default location ${err}`
    );
  }
};
