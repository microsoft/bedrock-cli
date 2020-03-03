import * as azdo from "azure-devops-node-api";
import { IGitApi } from "azure-devops-node-api/GitApi";
import AZGitInterfaces, {
  GitPullRequestSearchCriteria,
  GitRepository
} from "azure-devops-node-api/interfaces/GitInterfaces";
import { IAzureDevOpsOpts, PullRequest } from ".";
import { Config } from "../../config";
import { logger } from "../../logger";
import { azdoUrl } from "../azdoClient";
import { getOriginUrl, safeGitUrlForLogging } from "../gitutils";

////////////////////////////////////////////////////////////////////////////////
// State
////////////////////////////////////////////////////////////////////////////////
let obfuscatedPAT: string | undefined; // an obfuscated version of the PAT to output in logs
let gitApi: IGitApi | undefined; // keep track of the gitApi so it can be reused

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

/**
 * Helper function to generate a web-link for an AZDO Pull Request
 *
 * @param pr Target PR to generate a link for
 */
export const generatePRUrl = async (
  pr: AZGitInterfaces.GitPullRequest
): Promise<string> => {
  if (
    typeof pr.repository !== "undefined" &&
    typeof pr.repository.id !== "undefined"
  ) {
    const gitAPI = await GitAPI();
    const parentRepo = await gitAPI.getRepository(pr.repository.id);
    return `${parentRepo.webUrl!}/pullrequest/${pr.pullRequestId}`;
  }
  throw Error(
    `Failed to generate PR URL; PR did not contain a valid repository ID`
  );
};

////////////////////////////////////////////////////////////////////////////////
// Exported
////////////////////////////////////////////////////////////////////////////////

/**
 * Authenticates using config and credentials from global config and returns
 * an Azure DevOps Git API
 */
export const GitAPI = async (opts: IAzureDevOpsOpts = {}): Promise<IGitApi> => {
  // Load the gitApi if it has not been initialized
  if (typeof gitApi === "undefined") {
    // Load config from opts and fallback to spk config
    const { azure_devops } = Config();
    const {
      personalAccessToken = azure_devops && azure_devops.access_token,
      orgName = azure_devops && azure_devops.org
    } = opts;

    // PAT and devops URL are required
    if (typeof personalAccessToken === "undefined") {
      throw Error(
        `Unable to parse Azure DevOps Personal Access Token (azure_devops.personal_access_token) from spk config`
      );
    }

    if (typeof orgName === "undefined") {
      throw Error(
        `Unable to parse Azure DevOps Organization URL (azure_devops.devops_org_url) from spk config`
      );
    }

    // Authenticate with AZDO
    obfuscatedPAT = personalAccessToken
      .split("")
      .map((char, i, arr) => (i > arr.length - 5 ? char : "*"))
      .join("");
    logger.info(
      `Attempting to authenticate with Azure DevOps organization '${orgName}' using PAT '${obfuscatedPAT}'`
    );
    const authHandler = azdo.getPersonalAccessTokenHandler(personalAccessToken);
    const connection = new azdo.WebApi(azdoUrl(orgName), authHandler);

    // Instantiate the git API
    try {
      gitApi = await connection.getGitApi();
      logger.info(`Successfully connected to Azure DevOps Git API!`);
    } catch (err) {
      logger.error(`Error connecting Azure DevOps Git API`);
      throw err;
    }
  }

  return gitApi;
};

/**
 * Get the git origin from args or fallback to parsing from git client
 *
 * @param originPushUrl origin push URL
 */
export const getGitOrigin = async (originPushUrl: string): Promise<string> => {
  if (originPushUrl) {
    return originPushUrl;
  }

  try {
    return await getOriginUrl();
  } catch (err) {
    logger.error(err);
    logger.error(
      `Error parsing remote origin from git client, run 'git config --get remote.origin.url' for more information`
    );
    throw new Error(`No remote origin found in the current git repository`);
  }
};

/**
 * Fetches all repositories associated with the personal access token
 *
 * @param gitAPI GIT API client
 * @param gitOriginUrlForLogging URL for logging
 */
export const getAllRepos = async (
  gitAPI: IGitApi,
  gitOriginUrlForLogging: string
): Promise<GitRepository[]> => {
  logger.info(
    `Retrieving repositories associated with Azure PAT '${obfuscatedPAT}'`
  );
  const allRepos = await gitAPI.getRepositories();
  if (allRepos.length === 0) {
    throw new Error(
      `0 repositories found in Azure DevOps associated with PAT '${obfuscatedPAT}'`
    );
  }

  // Search for repos matching the current git origin
  logger.info(
    `${allRepos.length} repositor${
      allRepos.length > 1 ? "ies" : "y"
    } found; searching for entries matching '${gitOriginUrlForLogging}'`
  );
  return allRepos;
};

export const getMatchingBranch = async (
  gitAPI: IGitApi,
  sourceRef: string,
  targetRef: string,
  gitOrigin: string,
  allRepos: GitRepository[],
  gitOriginUrlForLogging: string
): Promise<GitRepository> => {
  const reposWithMatchingOrigin = allRepos.filter(repo =>
    [repo.url, repo.sshUrl, repo.webUrl, repo.remoteUrl].includes(gitOrigin)
  );
  logger.info(
    `Found ${reposWithMatchingOrigin.length} repositor${
      reposWithMatchingOrigin.length === 1 ? "y" : "ies"
    } with matching URL '${gitOriginUrlForLogging}'`
  );

  // Search for repos with branches matching those to make the PR against
  const reposWithMatchingBranches = (
    await Promise.all(
      reposWithMatchingOrigin.map(async repo => {
        logger.info(`Retrieving branches for repository '${repo.name}'`);
        const branches = await gitAPI.getBranches(repo.id!);
        return {
          branches: branches.filter(branch => {
            return [sourceRef, targetRef].includes(branch.name!);
          }),
          repo
        };
      })
    )
  )
    .filter(repo => {
      // Valid repos must contain both the source and target repo
      return repo.branches.length >= 2;
    })
    .map(repo => repo.repo);

  // Only allow one matching repo to be found
  if (reposWithMatchingBranches.length === 0) {
    throw new Error(
      `0 repositories found with remote url '${gitOriginUrlForLogging}' and branches '${sourceRef}' and '${targetRef}'; Ensure both '${sourceRef}' and '${targetRef}' exist on '${gitOriginUrlForLogging}'. Cannot automate pull request`
    );
  }
  if (reposWithMatchingBranches.length > 1) {
    throw new Error(
      `Multiple repositories (${reposWithMatchingBranches.length}) found with branches '${sourceRef}' and '${targetRef}'; Cannot automate pull request`
    );
  }

  return reposWithMatchingBranches[0];
};

const handleErrorForCreatePullRequest = async (
  gitAPI: IGitApi,
  sourceRef: string,
  targetRef: string,
  repoToPRAgainst: GitRepository,
  err: Error
) => {
  if (err instanceof Error && err.message.match(/TF401179/)) {
    // PR already exists targeting source and target refs
    // Search for the existing PR
    logger.warn(
      `Existing pull requests found in repository '${repoToPRAgainst.name}' matching target refs; Searching for matching pull requests`
    );
    const searchCriteria: GitPullRequestSearchCriteria = {
      sourceRefName: `refs/heads/${sourceRef}`,
      targetRefName: `refs/heads/${targetRef}`
    };
    const existingPRs = await gitAPI.getPullRequests(
      repoToPRAgainst.id!,
      searchCriteria
    );
    for (const pr of existingPRs) {
      logger.info(
        `Existing pull request found targeting source '${sourceRef}' and target '${targetRef}': '${await generatePRUrl(
          pr
        )}'`
      );
    }
  }
  throw err;
};

/**
 * Creates a pull request in the DevOps organization associated with the
 * personal access token in global config; Refer to GitAPI() on how that is
 * saturated.
 *
 * @param title Title of the pull request
 * @param sourceRef Source git ref to rebase from
 * @param targetRef Target git ref to rebase onto
 * @param options Additional options
 */
export const createPullRequest = async (
  title: string,
  sourceRef: string,
  targetRef: string,
  options: { [key: string]: string }
) => {
  const { description = "Automated PR generated by SPK", originPushUrl = "" } =
    options || {};

  // Minimal config to generate a PR
  const prConfig: AZGitInterfaces.GitPullRequest = {
    description,
    sourceRefName: `refs/heads/${sourceRef}`,
    targetRefName: `refs/heads/${targetRef}`,
    title
  };

  // Get the git origin from args or fallback to parsing from git client
  const gitOrigin = await getGitOrigin(originPushUrl);
  const gitOriginUrlForLogging = safeGitUrlForLogging(originPushUrl);
  const gitAPI = await GitAPI(options);
  const allRepos = await getAllRepos(gitAPI, gitOriginUrlForLogging);
  const repoToPRAgainst = await getMatchingBranch(
    gitAPI,
    sourceRef,
    targetRef,
    gitOrigin,
    allRepos,
    gitOriginUrlForLogging
  );

  logger.info(
    `Creating pull request in repository '${repoToPRAgainst.name!}' to merge branch '${sourceRef}' into '${targetRef}'`
  );

  try {
    const createdPR = await gitAPI.createPullRequest(
      prConfig,
      repoToPRAgainst.id!
    );
    logger.info(
      `Successfully created pull request '${await generatePRUrl(createdPR)}'`
    );
    return createdPR;
  } catch (err) {
    await handleErrorForCreatePullRequest(
      gitAPI,
      sourceRef,
      targetRef,
      repoToPRAgainst,
      err
    );
  }
};
