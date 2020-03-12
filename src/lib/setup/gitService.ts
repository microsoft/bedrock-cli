import { WebApi } from "azure-devops-node-api";
import { IGitApi } from "azure-devops-node-api/GitApi";
import { GitRepository } from "azure-devops-node-api/interfaces/TfvcInterfaces";
import { SimpleGit } from "simple-git/promise";
import { logger } from "../../logger";
import { RequestContext, SP_USER_NAME } from "./constants";

let gitAPI: IGitApi | undefined;

/**
 * Returns Git API client.
 */
export const getGitApi = async (webAPI: WebApi): Promise<IGitApi> => {
  if (gitAPI) {
    return gitAPI;
  }
  gitAPI = await webAPI.getGitApi();
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return gitAPI!;
};

/**
 * Returns azure git URL.
 *
 * @param orgName Organization name
 * @param projectName Project name
 * @param repoName Repo name
 */
export const getAzureRepoUrl = (
  orgName: string,
  projectName: string,
  repoName: string
): string => {
  return `https://dev.azure.com/${orgName}/${projectName}/_git/${repoName}`;
};

/**
 * Creates git repo
 *
 * @param gitApi Git API Client
 * @param repoName Git report name
 * @param projectName project name
 */
export const createRepo = async (
  gitApi: IGitApi,
  repoName: string,
  projectName: string
): Promise<GitRepository> => {
  const createOptions = {
    name: repoName
  };
  try {
    return await gitApi.createRepository(createOptions, projectName);
  } catch (err) {
    if (err.statusCode === 401) {
      throw new Error(
        `Did not have permissions to create git repo. Add code write permission to the personal access token`
      );
    }
    throw err;
  }
};

/**
 * Deletes a git repository.
 *
 * @param gitApi Git API client
 * @param repo Repo to be deleted.
 * @param projectName project name
 */
export const deleteRepo = async (
  gitApi: IGitApi,
  repo: GitRepository,
  projectName: string
): Promise<void> => {
  logger.info("Deleting repository " + repo.name);
  if (repo.id) {
    await gitApi.deleteRepository(repo.id, projectName);
    logger.info("Deleted repository " + repo.name);
  } else {
    throw new Error("Repository Id is undefined, cannot delete repository");
  }
};

/**
 * Return git repo if it does not exist in a project.
 *
 * @param gitApi Git API Client
 * @param repoName Git report name
 * @param projectName project name
 */
export const getRepoInAzureOrg = async (
  gitApi: IGitApi,
  repoName: string,
  projectName: string
): Promise<GitRepository | undefined> => {
  try {
    const respositories = await gitApi.getRepositories();
    return (respositories || []).find(repo => {
      return repo.project?.name === projectName && repo.name === repoName;
    });
  } catch (err) {
    if (err.statusCode === 401) {
      throw new Error(
        `Did not have permissions to get git repo. Add code read permission to the personal access token`
      );
    }
    throw err;
  }
};

/**
 * Creates git repo if it does not exist.
 *
 * @param gitApi Git API Client
 * @param repoName Git report name
 * @param projectName project name
 * @param removeIfExist remove it if it exist and ceate
 */
export const createRepoInAzureOrg = async (
  gitApi: IGitApi,
  repoName: string,
  projectName: string,
  removeIfExist = false
): Promise<GitRepository> => {
  let repo = await getRepoInAzureOrg(gitApi, repoName, projectName);
  if (repo) {
    logger.info(`Repo, ${repoName} already exists.`);

    if (removeIfExist) {
      await deleteRepo(gitApi, repo, projectName);
    } else {
      return repo;
    }
  }
  repo = await createRepo(gitApi, repoName, projectName);
  logger.info(`Repo, ${repoName} is created.`);
  return repo;
};

/**
 * Returns repo URL.
 *
 * @param repo Repo object
 * @param orgName organization name
 */
export const getRepoURL = (repo: GitRepository, orgName: string): string => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return repo.remoteUrl!.replace(`${orgName}@`, "");
};

/**
 * Commits and push to remote origin.
 *
 * @param git git instance
 * @param rc Request Context
 * @param repoName repo name
 */
export const commitAndPushToRemote = async (
  git: SimpleGit,
  rc: RequestContext,
  repoName: string
): Promise<void> => {
  logger.info(`Pushing to ${repoName} repo.`);
  // Commit and check the local git log
  await git.commit(`Initial commit for ${repoName} repo`);

  const resultLog = await git.log();
  logger.info("Log Messages from Git:");
  resultLog.all.forEach(f => logger.info("\t" + f.date + " --> " + f.message));

  // TOFIX: We know AzDO url style so hack it for now instead of discovering via API
  const remoteURL = `dev.azure.com/${rc.orgName}/${rc.projectName}/_git/${repoName}`;
  const remote = `https://${SP_USER_NAME}:${rc.accessToken}@${remoteURL}`;

  if ((await git.getRemotes(false)).length === 0) {
    await git.addRemote("origin", remote);
  }
  await git.push("origin", "master");
  logger.info(`Completed pushing to ${repoName} repo.`);
};
