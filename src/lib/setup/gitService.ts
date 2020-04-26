import { WebApi } from "azure-devops-node-api";
import { IGitApi } from "azure-devops-node-api/GitApi";
import { GitRepository } from "azure-devops-node-api/interfaces/TfvcInterfaces";
import { SimpleGit } from "simple-git/promise";
import {
  completePullRequest as approvePR,
  getActivePullRequests,
} from "../git/azure";
import { build as buildError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";
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
  return gitAPI;
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
    name: repoName,
  };
  try {
    return await gitApi.createRepository(createOptions, projectName);
  } catch (err) {
    if (err.statusCode === 401) {
      throw buildError(
        errorStatusCode.GIT_OPS_ERR,
        "git-create-repo-no-permissions",
        err
      );
    }
    throw buildError(errorStatusCode.GIT_OPS_ERR, "git-create-repo-err", err);
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
    throw buildError(errorStatusCode.GIT_OPS_ERR, "git-delete-repo-id-missing");
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
    return (respositories || []).find((repo) => {
      return repo.project?.name === projectName && repo.name === repoName;
    });
  } catch (err) {
    if (err.statusCode === 401) {
      throw buildError(
        errorStatusCode.GIT_OPS_ERR,
        "git-get-repo-no-permissions",
        err
      );
    }
    throw buildError(
      errorStatusCode.GIT_OPS_ERR,
      "git-get-repo-azure-err",
      err
    );
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
  return repo.remoteUrl ? repo.remoteUrl.replace(`${orgName}@`, "") : "";
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

  try {
    // Commit and check the local git log
    await git.commit(`Initial commit for ${repoName} repo`);

    const resultLog = await git.log();
    logger.info("Log Messages from Git:");
    resultLog.all.forEach((f) =>
      logger.info("\t" + f.date + " --> " + f.message)
    );

    // TOFIX: We know AzDO url style so hack it for now instead of discovering via API
    const remoteURL = `dev.azure.com/${rc.orgName}/${rc.projectName}/_git/${repoName}`;
    const remote = `https://${SP_USER_NAME}:${rc.accessToken}@${remoteURL}`;

    if ((await git.getRemotes(false)).length === 0) {
      await git.addRemote("origin", remote);
    }
    await git.push("origin", "master");
    logger.info(`Completed pushing to ${repoName} repo.`);
  } catch (err) {
    throw buildError(
      errorStatusCode.GIT_OPS_ERR,
      "git-commit-Push-to_remote-err",
      err
    );
  }
};

export const completePullRequest = async (
  gitApi: IGitApi,
  rc: RequestContext,
  repoName: string
): Promise<number> => {
  const pullRequests = await getActivePullRequests(
    gitApi,
    repoName,
    rc.projectName
  );
  if (pullRequests && pullRequests.length > 0) {
    const pr = pullRequests[0];
    if (pr && pr.pullRequestId) {
      await approvePR(pr, rc);
      return pr.pullRequestId;
    }
  }
  throw buildError(
    errorStatusCode.GIT_OPS_ERR,
    "setup-cmd-cannot-locate-pr-for-approval"
  );
};
