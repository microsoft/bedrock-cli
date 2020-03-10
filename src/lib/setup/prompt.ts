import fs from "fs";
import inquirer from "inquirer";
import {
  validateAccessToken,
  validateOrgName,
  validateProjectName,
  validateServicePrincipalId,
  validateServicePrincipalPassword,
  validateServicePrincipalTenantId
} from "../validator";
import { DEFAULT_PROJECT_NAME, IRequestContext, WORKSPACE } from "./constants";
import { createWithAzCLI } from "./servicePrincipalService";

/**
 * Prompts for service principal identifer, password and tenant identifer.
 * Request context will have the service principal information
 * when this function is completed successfully.
 *
 * @param rc Request Context
 */
export const promptForServicePrincipal = async (rc: IRequestContext) => {
  const questions = [
    {
      message: "Enter Service Principal Id\n",
      name: "az_sp_id",
      type: "input",
      validate: validateServicePrincipalId
    },
    {
      mask: "*",
      message: "Enter Service Principal Password\n",
      name: "az_sp_password",
      type: "password",
      validate: validateServicePrincipalPassword
    },
    {
      message: "Enter Service Principal Tenant Id\n",
      name: "az_sp_tenant",
      type: "input",
      validate: validateServicePrincipalTenantId
    }
  ];
  const answers = await inquirer.prompt(questions);
  rc.servicePrincipalId = answers.az_sp_id as string;
  rc.servicePrincipalPassword = answers.az_sp_password as string;
  rc.servicePrincipalTenantId = answers.az_sp_tenant as string;
};

/**
 * Prompts for creating service principal. User can choose
 * Yes or No.
 *
 * @param rc Request Context
 */
export const promptForServicePrincipalCreation = async (
  rc: IRequestContext
) => {
  const questions = [
    {
      default: true,
      message: `Do you want to create a service principal?`,
      name: "create_service_principal",
      type: "confirm"
    }
  ];
  const answers = await inquirer.prompt(questions);
  if (answers.create_service_principal) {
    rc.toCreateSP = true;
    await createWithAzCLI(rc);
  } else {
    rc.toCreateSP = false;
    await promptForServicePrincipal(rc);
  }
};

/**
 * Prompts for questions
 *
 * @return answers to the questions
 */
export const prompt = async (): Promise<IRequestContext> => {
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
    },
    {
      default: true,
      message: `Do you like create a sample application repository?`,
      name: "create_app_repo",
      type: "confirm"
    }
  ];
  const answers = await inquirer.prompt(questions);
  const rc: IRequestContext = {
    accessToken: answers.azdo_pat as string,
    orgName: answers.azdo_org_name as string,
    projectName: answers.azdo_project_name as string,
    toCreateAppRepo: answers.create_app_repo as boolean,
    workspace: WORKSPACE
  };

  if (rc.toCreateAppRepo) {
    await promptForServicePrincipalCreation(rc);
  }
  return rc;
};

const validationServicePrincipalInfoFromFile = (
  rc: IRequestContext,
  map: { [key: string]: string }
) => {
  if (rc.toCreateAppRepo) {
    rc.toCreateSP = map.az_create_sp === "true";

    // file needs to contain sp information if user
    // choose not to create SP
    if (!rc.toCreateSP) {
      const vSPId = validateServicePrincipalId(map.az_sp_id);
      if (typeof vSPId === "string") {
        throw new Error(vSPId);
      }
      const vSPPassword = validateServicePrincipalPassword(map.az_sp_password);
      if (typeof vSPPassword === "string") {
        throw new Error(vSPPassword);
      }
      const vSPTenantId = validateServicePrincipalTenantId(map.az_sp_tenant);
      if (typeof vSPTenantId === "string") {
        throw new Error(vSPTenantId);
      }
    }
  }
};

const parseInformationFromFile = (file: string): { [key: string]: string } => {
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
  return map;
};

/**
 * Returns answers that are provided in a file.
 *
 * @param file file name
 */
export const getAnswerFromFile = (file: string): IRequestContext => {
  const map = parseInformationFromFile(file);
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

  const rc: IRequestContext = {
    accessToken: map.azdo_pat,
    orgName: map.azdo_org_name,
    projectName: map.azdo_project_name,
    servicePrincipalId: map.az_sp_id,
    servicePrincipalPassword: map.az_sp_password,
    servicePrincipalTenantId: map.az_sp_tenant,
    workspace: WORKSPACE
  };

  rc.toCreateAppRepo = map.az_create_app === "true";
  validationServicePrincipalInfoFromFile(rc, map);
  return rc;
};
