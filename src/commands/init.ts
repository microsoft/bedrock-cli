import axios from "axios";
import commander from "commander";
import fs from "fs";
import inquirer from "inquirer";
import yaml from "js-yaml";
import {
  Config,
  defaultConfigFile,
  loadConfiguration,
  saveConfiguration
} from "../config";
import { build as buildCmd, exit as exitCmd } from "../lib/commandBuilder";
import { deepClone } from "../lib/util";
import { hasValue } from "../lib/validator";
import { logger } from "../logger";
import { IConfigYaml } from "../types";
import decorator from "./init.decorator.json";

interface ICommandOptions {
  file: string | undefined;
  interactive: boolean;
}

interface IAnswer {
  azdo_org_name: string;
  azdo_project_name: string;
  azdo_pat: string;
}

export const ORG_NAME_VIOLATION =
  "Organization names must start with a letter or number, followed by letters, numbers or hyphens, and must end with a letter or number.";

/**
 * Handles the case where command is loading a file.
 *
 * @param file File name
 */
export const handleFileConfig = async (file: string) => {
  loadConfiguration(file);
  await saveConfiguration(file);
  logger.info("Successfully initialized the spk tool!");
};

/**
 * Returns true if organization name is proper.
 *
 * @param value Organization Name
 */
export const validateOrgName = (value: string): string | boolean => {
  if (!hasValue(value.trim())) {
    return "Must enter an organization";
  }
  const pass = value.match(
    /^[0-9a-zA-Z][^\s]*[0-9a-zA-Z]$/ // No Spaces
  );
  if (pass) {
    return true;
  }
  return ORG_NAME_VIOLATION;
};

/**
 * Returns true if project name is proper.
 *
 * @param value Project Name
 */
export const validateProjectName = (value: string): string | boolean => {
  if (!hasValue(value)) {
    return "Must enter a project name";
  }
  if (value.indexOf(" ") !== -1) {
    return "Project name cannot contains spaces";
  }
  if (value.length > 64) {
    return "Project name cannot be longer than 64 characters";
  }
  if (value.startsWith("_")) {
    return "Project name cannot begin with an underscore";
  }
  if (value.startsWith(".") || value.endsWith(".")) {
    return "Project name cannot begin or end with a period";
  }

  const invalidChars = [
    "/",
    ":",
    "\\",
    "~",
    "&",
    "%",
    ";",
    "@",
    "'",
    '"',
    "?",
    "<",
    ">",
    "|",
    "#",
    "$",
    "*",
    "}",
    "{",
    ",",
    "+",
    "=",
    "[",
    "]"
  ];
  if (invalidChars.some(x => value.indexOf(x) !== -1)) {
    return `Project name can't contain special characters, such as / : \ ~ & % ; @ ' " ? < > | # $ * } { , + = [ ]`;
  }

  return true;
};

/**
 * Returns true if access token is not empty string
 *
 * @param value Access token
 */
export const validateAccessToken = (value: string): string | boolean => {
  if (!hasValue(value)) {
    return "Must enter a personal access token with read/write/manage permissions";
  }
  return true;
};

/**
 * Prompts for questions
 *
 * @param curConfig Configuration is used to provide default values to the questions.
 * @return answers to the questions
 */
export const prompt = async (curConfig: IConfigYaml): Promise<IAnswer> => {
  const questions = [
    {
      default: curConfig.azure_devops?.org || undefined,
      message: "Enter organization name\n",
      name: "azdo_org_name",
      type: "input",
      validate: validateOrgName
    },
    {
      default: curConfig.azure_devops?.project || undefined,
      message: "Enter project name\n",
      name: "azdo_project_name",
      type: "input",
      validate: validateProjectName
    },
    {
      default: curConfig.azure_devops?.access_token || undefined,
      mask: "*",
      message: "Enter your AzDO personal access token\n",
      name: "azdo_pat",
      type: "password",
      validate: validateAccessToken
    }
  ];
  const answers = await inquirer.prompt(questions);
  return {
    azdo_org_name: answers.azdo_org_name as string,
    azdo_pat: answers.azdo_pat as string,
    azdo_project_name: answers.azdo_project_name as string
  };
};

/**
 * Returns SPK Configuration. Empty azure devops values are returned
 * if config.yaml is absent.
 */
export const getConfig = (): IConfigYaml => {
  try {
    loadConfiguration();
    return Config();
  } catch (_) {
    // current config is not found.
    return {
      azure_devops: {
        access_token: "",
        org: "",
        project: ""
      }
    };
  }
};

/**
 * Verifying organization, project name and access token as
 * azure dev-op API.
 *
 * @param azure Azure devops values
 * @return true if verification is successful
 */
export const validatePersonalAccessToken = async (
  azure: IConfigYaml["azure_devops"]
): Promise<boolean> => {
  try {
    const res = await axios.get(
      `https://dev.azure.com/${azure!.org}/_apis/projects/${azure!.project}`,
      {
        auth: {
          password: azure!.access_token as string,
          username: ""
        }
      }
    );
    return res.status === 200;
  } catch (_) {
    return false;
  }
};

/**
 * Handles the interactive mode of the command.
 */
export const handleInteractiveMode = async () => {
  const curConfig = deepClone(getConfig());
  const answer = await prompt(curConfig);
  curConfig.azure_devops!.org = answer.azdo_org_name;
  curConfig.azure_devops!.project = answer.azdo_project_name;
  curConfig.azure_devops!.access_token = answer.azdo_pat;
  const data = yaml.safeDump(curConfig);
  fs.writeFileSync(defaultConfigFile(), data);
  logger.info("Successfully constructed SPK configuration file.");
  const ok = await validatePersonalAccessToken(curConfig.azure_devops);
  if (ok) {
    logger.info(
      "Organization name, project name and personal access token are verified."
    );
  } else {
    logger.error(
      "Unable to verify organization name, project name and personal access token."
    );
  }
};

/**
 * Executes the command, can all exit function with 0 or 1
 * when command completed successfully or failed respectively.
 *
 * @param opts option value from commander
 * @param exitFn exit function
 */
export const execute = async (
  opts: ICommandOptions,
  exitFn: (status: number) => Promise<void>
) => {
  try {
    if (!hasValue(opts.file) && !opts.interactive) {
      throw new Error(
        "File that stores configuration is not provided and interactive mode is not turn on"
      );
    }
    if (hasValue(opts.file) && opts.interactive) {
      throw new Error(
        "Not supported option while configuration file is provided and interactive mode is turn on"
      );
    }

    if (hasValue(opts.file)) {
      await handleFileConfig(opts.file);
    } else {
      await handleInteractiveMode();
    }

    await exitFn(0);
  } catch (err) {
    logger.error(`Error occurred while initializing`);
    logger.error(err);
    await exitFn(1);
  }
};

/**
 * Adds the init command to the commander command object
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: ICommandOptions) => {
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
