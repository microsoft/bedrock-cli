import { ICoreApi } from "azure-devops-node-api/CoreApi";
import {
  ProjectVisibility,
  SourceControlTypes
} from "azure-devops-node-api/interfaces/CoreInterfaces";
import { logger } from "../../logger";
import { DEFAULT_PROJECT_NAME, IAnswer } from "./prompt";

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

export const createProjectIfNotExist = async (
  coreAPI: ICoreApi,
  answers: IAnswer
) => {
  const project = await getProject(coreAPI, answers!.azdo_project_name);
  if (!project) {
    await createProject(coreAPI, answers!.azdo_project_name);
    logger.info(`Project, ${DEFAULT_PROJECT_NAME} is created.`);
  } else {
    logger.info(`Project, ${DEFAULT_PROJECT_NAME} already exists.`);
  }
};
