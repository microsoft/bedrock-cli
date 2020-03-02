import fs from "fs";
import inquirer from "inquirer";
import {
  validateAccessToken,
  validateOrgName,
  validateProjectName
} from "../validator";

export interface IAnswer {
  azdo_org_name: string;
  azdo_pat: string;
  azdo_project_name: string;
}

export const DEFAULT_PROJECT_NAME = "BedrockRocks";

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
      default: DEFAULT_PROJECT_NAME,
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
  map.azdo_project_name = map.azdo_project_name || DEFAULT_PROJECT_NAME;

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
