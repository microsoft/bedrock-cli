import axios from "axios";
import commander from "commander";
import fs from "fs";
import inquirer from "inquirer";
import yaml from "js-yaml";
import {
  Config,
  defaultConfigFile,
  loadConfiguration,
  saveConfiguration,
} from "../config";
import { build as buildCmd, exit as exitCmd } from "../lib/commandBuilder";
import * as promptBuilder from "../lib/promptBuilder";
import { deepClone } from "../lib/util";
import { hasValue } from "../lib/validator";
import { logger } from "../logger";
import { ConfigYaml } from "../types";
import decorator from "./init.decorator.json";

interface CommandOptions {
  file: string | undefined;
  interactive: boolean;
}

interface Answer {
  azdo_org_name: string;
  azdo_project_name: string;
  azdo_pat: string;
  toSetupIntrospectionConfig: boolean;
}

/**
 * Handles the case where command is loading a file.
 *
 * @param file File name
 */
export const handleFileConfig = (file: string): void => {
  loadConfiguration(file);
  saveConfiguration(file);
  logger.info("Successfully initialized the spk tool!");
};

/**
 * Prompts for questions
 *
 * @param curConfig Configuration is used to provide default values to the questions.
 * @return answers to the questions
 */
export const prompt = async (curConfig: ConfigYaml): Promise<Answer> => {
  const questions = [
    promptBuilder.azureOrgName(curConfig.azure_devops?.org),
    promptBuilder.azureProjectName(curConfig.azure_devops?.project),
    promptBuilder.azureAccessToken(curConfig.azure_devops?.access_token),
    promptBuilder.askToSetupIntrospectionConfig(false),
  ];
  const answers = await inquirer.prompt(questions);
  return {
    azdo_org_name: answers.azdo_org_name as string,
    azdo_pat: answers.azdo_pat as string,
    azdo_project_name: answers.azdo_project_name as string,
    toSetupIntrospectionConfig: answers.toSetupIntrospectionConfig,
  };
};

/**
 * Returns SPK Configuration. Empty azure devops values are returned
 * if config.yaml is absent.
 */
export const getConfig = (): ConfigYaml => {
  try {
    loadConfiguration();
    return Config();
  } catch (_) {
    logger.info("current config is not found.");
    return {
      azure_devops: {
        access_token: "",
        org: "",
        project: "",
      },
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
  azure: ConfigYaml["azure_devops"]
): Promise<boolean> => {
  if (!azure || !azure.org || !azure.project || !azure.access_token) {
    throw Error(
      "Unable to validate personal access token because organization, project or access token information were missing"
    );
  }
  try {
    const res = await axios.get(
      `https://dev.azure.com/${azure.org}/_apis/projects/${azure.project}`,
      {
        auth: {
          password: azure.access_token as string,
          username: "",
        },
      }
    );
    return res.status === 200;
  } catch (_) {
    return false;
  }
};

export const isIntrospectionAzureDefined = (curConfig: ConfigYaml): boolean => {
  if (!curConfig.introspection) {
    return false;
  }
  const intro = curConfig.introspection;
  return intro.azure !== undefined;
};

export const handleIntrospectionInteractive = async (
  curConfig: ConfigYaml
): Promise<void> => {
  if (!isIntrospectionAzureDefined(curConfig)) {
    curConfig.introspection = {
      azure: {},
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const azure = curConfig.introspection!.azure!;

  const ans = await inquirer.prompt([
    promptBuilder.azureStorageAccountName(azure.account_name),
    promptBuilder.azureStorageTableName(azure.table_name),
    promptBuilder.azureStoragePartitionKey(azure.partition_key),
    promptBuilder.azureStorageAccessKey(azure.key),
    promptBuilder.azureKeyVaultName(curConfig.key_vault_name),
  ]);
  azure["account_name"] = ans.azdo_storage_account_name;
  azure["table_name"] = ans.azdo_storage_table_name;
  azure["partition_key"] = ans.azdo_storage_partition_key;
  azure.key = ans.azdo_storage_access_key;

  const keyVaultName = ans.azdo_storage_key_vault_name.trim();
  if (keyVaultName) {
    curConfig["key_vault_name"] = keyVaultName;
  } else {
    delete curConfig["key_vault_name"];
  }
};

/**
 * Handles the interactive mode of the command.
 */
export const handleInteractiveMode = async (): Promise<void> => {
  const conf = getConfig();
  if (conf.introspection && conf.introspection.azure) {
    delete conf.introspection.azure.key;
  }
  const curConfig = deepClone(conf);
  const answer = await prompt(curConfig);
  curConfig["azure_devops"] = curConfig.azure_devops || {};

  curConfig.azure_devops.org = answer.azdo_org_name;
  curConfig.azure_devops.project = answer.azdo_project_name;
  curConfig.azure_devops["access_token"] = answer.azdo_pat;

  if (answer.toSetupIntrospectionConfig) {
    await handleIntrospectionInteractive(curConfig);
  }

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
  opts: CommandOptions,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
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
      handleFileConfig(opts.file);
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
  buildCmd(command, decorator).action(async (opts: CommandOptions) => {
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
