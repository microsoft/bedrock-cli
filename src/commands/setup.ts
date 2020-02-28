import { ICoreApi } from "azure-devops-node-api/CoreApi";
import {
  ProjectVisibility,
  SourceControlTypes
} from "azure-devops-node-api/interfaces/CoreInterfaces";
import commander from "commander";
import fs from "fs";
import inquirer from "inquirer";
import yaml from "js-yaml";
import { defaultConfigFile } from "../config";
import { getWebApi } from "../lib/azdoClient";
import { build as buildCmd, exit as exitCmd } from "../lib/commandBuilder";
import {
  validateAccessToken,
  validateOrgName,
  validateProjectName
} from "../lib/validator";
import { logger } from "../logger";
import decorator from "./setup.decorator.json";

interface ICommandOptions {
  file: string | undefined;
}

interface IAnswer {
  azdo_org_name: string;
  azdo_pat: string;
  azdo_project_name: string;
}

export const PROJECT_NAME = "BedrockRocks1";

/**
 * Prompts for questions
 *
 * @return answers to the questions
 */
export const prompt = async (): Promise<IAnswer> => {
  const questions = [
    {
      message: "Enter organization name\n",
      name: "azdo_org_name",
      type: "input",
      validate: validateOrgName
    },
    {
      default: PROJECT_NAME,
      message: "Enter name of project to be created\n",
      name: "azdo_project_name",
      type: "input",
      validate: validateProjectName
    },
    {
      mask: "*",
      message: "Enter your Azure DevOps personal access token\n",
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

export const getAnswerFromFile = (file: string): IAnswer => {
  let content = "";
  try {
    content = fs.readFileSync(file, "utf-8");
  } catch (_) {
    throw new Error(
      `${file} did not exist or not accessible. Make sure that it is accessible.`
    );
  }

  const arr = content.split("\n").filter(s => s.trim().length > 0);
  const map: { [key: string]: string } = {};
  arr.forEach(s => {
    const idx = s.indexOf("=");
    if (idx !== -1) {
      map[s.substring(0, idx).trim()] = s.substring(idx + 1).trim();
    }
  });
  map.azdo_project_name = map.azdo_project_name || PROJECT_NAME;

  const vOrgName = validateOrgName(map.azdo_org_name);
  if (typeof vOrgName === "string") {
    throw new Error(vOrgName);
  }

  const vProjectName = validateProjectName(map.azdo_project_name);
  if (typeof vProjectName === "string") {
    throw new Error(vProjectName);
  }

  const vToken = validateAccessToken(map.azdo_pat);
  if (typeof vToken === "string") {
    throw new Error(vToken);
  }

  return {
    azdo_org_name: map.azdo_org_name,
    azdo_pat: map.azdo_pat,
    azdo_project_name: map.azdo_project_name
  };
};

/**
 * Creates SPK config file under `user-home/.spk` folder
 *
 * @param answers Answers provided to the commander
 */
export const createSPKConfig = (answers: IAnswer) => {
  const data = yaml.safeDump({
    azure_devops: {
      access_token: answers.azdo_pat,
      org: answers.azdo_org_name,
      project: answers.azdo_project_name
    }
  });
  fs.writeFileSync(defaultConfigFile(), data);
};

/**
 * Creates an Azure DevOps Project.
 *
 * @param coreAPI Core API service
 * @param name Name of Project
 */
export const createProject = async (coreAPI: ICoreApi, name: string) => {
  try {
    await coreAPI.queueCreateProject({
      capabilities: {
        processTemplate: {
          templateTypeId: "27450541-8e31-4150-9947-dc59f998fc01" // TOFIX: do not know what this GUID is about
        },
        versioncontrol: {
          sourceControlType: SourceControlTypes.Git.toString()
        }
      },
      description: "Created by automated tool",
      name,
      visibility: ProjectVisibility.Organization
    });
  } catch (err) {
    if (err.statusCode === 401) {
      throw new Error(
        "Access Token did not have the permission to create project. Grant write to project permission to the token"
      );
    }
    throw err;
  }
};

/**
 * Returns Azure DevOps Project if it exists.
 *
 * @param coreAPI Core API service
 * @param name Name of Project
 */
export const getProject = async (coreAPI: ICoreApi, name: string) => {
  try {
    return await coreAPI.getProject(name);
  } catch (err) {
    if (err.statusCode === 401) {
      throw new Error(
        "Access Token did not have the permission to read project. Grant read project permission to the token"
      );
    }
    throw err;
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
    let answers: IAnswer;
    if (opts.file) {
      answers = getAnswerFromFile(opts.file);
    } else {
      answers = await prompt();
    }

    createSPKConfig(answers!);
    const webAPI = await getWebApi();
    const coreAPI = await webAPI.getCoreApi();

    const project = await getProject(coreAPI, answers!.azdo_project_name);
    if (!project) {
      await createProject(coreAPI, answers!.azdo_project_name);
      logger.info(`Project, ${PROJECT_NAME} is created.`);
    } else {
      logger.info(`Project, ${PROJECT_NAME} already exists.`);
    }

    await exitFn(0);
  } catch (err) {
    if (err.statusCode === 401) {
      logger.error(
        `Authentication Failed. Make sure that the organization name and access token are correct; or your access token may have expired.`
      );
    } else if (err.message && err.message.indexOf("VS402392") !== -1) {
      logger.error(
        `Project, ${PROJECT_NAME} might be deleted less than 28 days ago. Choose a different project name.`
      );
    } else {
      logger.error(err);
    }
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
