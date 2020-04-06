import * as azdo from "azure-devops-node-api";
import { IGitApi } from "azure-devops-node-api/GitApi";
import AZGitInterfaces, {
  GitPullRequestSearchCriteria,
  GitRepository,
} from "azure-devops-node-api/interfaces/GitInterfaces";
import { AzureDevOpsOpts } from ".";
import { Config } from "../../config";
import { logger } from "../../logger";
import { azdoUrl } from "../azdoClient";
import { build as buildError } from "../errorBuilder";
import { errorStatusCode } from "../errorStatusCode";
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
 * Authenticates using config and credentials from global config and returns
 * an Azure DevOps Git API
 */
export const GitAPI = async (opts: AzureDevOpsOpts = {}): Promise<IGitApi> => {
  // Load the gitApi if it has not been initialized
  if (!gitApi) {
    // Load config from opts and fallback to spk config
    const config = Config();
    const azureDevops = config["azure_devops"];
    const {
      personalAccessToken = azureDevops && azureDevops.access_token,
      orgName = azureDevops && azureDevops.org,
    } = opts;

    // PAT and devops URL are required
    if (typeof personalAccessToken === "undefined") {
      throw buildError(
        errorStatusCode.GIT_OPS_ERR,
        "git-azure-git-api-err-missing-access-token"
      );
    }

    if (typeof orgName === "undefined") {
      throw buildError(
        errorStatusCode.GIT_OPS_ERR,
        "git-azure-git-api-err-missing-org"
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
      throw buildError(
        errorStatusCode.GIT_OPS_ERR,
        "git-azure-git-api-err",
        err
      );
    }
  }

  return gitApi;
};

/**
 * Helper function to generate a web-link for an AZDO Pull Request
 *
 * @param pr Target PR to generate a link for
 */
export const generatePRUrl = async (
  pr: AZGitInterfaces.GitPullRequest
): Promise<string> => {
  if (pr.repository && pr.repository.id) {
    try {
      const gitAPI = await GitAPI();
      const parentRepo = await gitAPI.getRepository(pr.repository.id);
      return `${parentRepo.webUrl}/pullrequest/${pr.pullRequestId}`;
    } catch (err) {
      throw buildError(
        errorStatusCode.GIT_OPS_ERR,
        "git-azure-generate-pr-err",
        err
      );
    }
  }
  throw buildError(
    errorStatusCode.GIT_OPS_ERR,
    "git-azure-generate-pr-err-missing-id"
  );
};

////////////////////////////////////////////////////////////////////////////////
// Exported
////////////////////////////////////////////////////////////////////////////////

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
    throw buildError(
      errorStatusCode.GIT_OPS_ERR,
      "git-azure-get-git-origin-err",
      err
    );
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
  try {
    const allRepos = await gitAPI.getRepositories();
    if (allRepos.length === 0) {
      throw buildError(
        errorStatusCode.GIT_OPS_ERR,
        "git-azure-get-all-repo-none"
      );
    }

    // Search for repos matching the current git origin
    logger.info(
      `${allRepos.length} repositor${
        allRepos.length > 1 ? "ies" : "y"
      } found; searching for entries matching '${gitOriginUrlForLogging}'`
    );
    return allRepos;
  } catch (err) {
    throw buildError(
      errorStatusCode.GIT_OPS_ERR,
      "git-azure-get-all-repo-err",
      err
    );
  }
};

export const getMatchingBranch = async (
  gitAPI: IGitApi,
  sourceRef: string,
  targetRef: string,
  gitOrigin: string,
  allRepos: GitRepository[],
  gitOriginUrlForLogging: string
): Promise<GitRepository> => {
  const reposWithMatchingOrigin = allRepos.filter((repo) =>
    [repo.url, repo.sshUrl, repo.webUrl, repo.remoteUrl].includes(gitOrigin)
  );
  logger.info(
    `Found ${reposWithMatchingOrigin.length} repositor${
      reposWithMatchingOrigin.length === 1 ? "y" : "ies"
    } with matching URL '${gitOriginUrlForLogging}'`
  );

  try {
    // Search for repos with branches matching those to make the PR against
    const reposWithMatchingBranches = (
      await Promise.all(
        reposWithMatchingOrigin.map(async (repo) => {
          logger.info(`Retrieving branches for repository '${repo.name}'`);
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const branches = await gitAPI.getBranches(repo.id!);
          return {
            branches: branches.filter((branch) => {
              return (
                branch.name && [sourceRef, targetRef].includes(branch.name)
              );
            }),
            repo,
          };
        })
      )
    )
      .filter((repo) => {
        // Valid repos must contain both the source and target repo
        return repo.branches.length >= 2;
      })
      .map((repo) => repo.repo);

    // Only allow one matching repo to be found
    if (reposWithMatchingBranches.length === 0) {
      throw buildError(errorStatusCode.GIT_OPS_ERR, {
        errorKey: "git-azure-get-match-branch-none",
        values: [gitOriginUrlForLogging, sourceRef, targetRef],
      });
    }
    if (reposWithMatchingBranches.length > 1) {
      throw buildError(errorStatusCode.GIT_OPS_ERR, {
        errorKey: "git-azure-get-match-branch-multiple",
        values: [gitOriginUrlForLogging, sourceRef, targetRef],
      });
    }

    return reposWithMatchingBranches[0];
  } catch (err) {
    throw buildError(
      errorStatusCode.GIT_OPS_ERR,
      "git-azure-get-match-branch-err",
      err
    );
  }
};

const handleErrorForCreatePullRequest = async (
  gitAPI: IGitApi,
  sourceRef: string,
  targetRef: string,
  repoToPRAgainst: GitRepository,
  err: Error
): Promise<never> => {
  if (err instanceof Error && err.message.match(/TF401179/)) {
    // PR already exists targeting source and target refs
    // Search for the existing PR
    logger.warn(
      `Existing pull requests found in repository '${repoToPRAgainst.name}' matching target refs; Searching for matching pull requests`
    );
    const searchCriteria: GitPullRequestSearchCriteria = {
      sourceRefName: `refs/heads/${sourceRef}`,
      targetRefName: `refs/heads/${targetRef}`,
    };
    const existingPRs = await gitAPI.getPullRequests(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
  throw buildError(
    errorStatusCode.GIT_OPS_ERR,
    "git-azure-create-pull-request-err",
    err
  );
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
): Promise<AZGitInterfaces.GitPullRequest | undefined> => {
  const { description = "Automated PR generated by SPK", originPushUrl = "" } =
    options || {};

  // Minimal config to generate a PR
  const prConfig: AZGitInterfaces.GitPullRequest = {
    description,
    sourceRefName: `refs/heads/${sourceRef}`,
    targetRefName: `refs/heads/${targetRef}`,
    title,
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
    `Creating pull request in repository '${repoToPRAgainst.name}' to merge branch '${sourceRef}' into '${targetRef}'`
  );

  try {
    const createdPR = await gitAPI.createPullRequest(
      prConfig,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

/**
 * Checks if the repository has a given file.
 * @param fileName The name of the file
 * @param branch The branch name
 * @param repoName The name of the repository
 * @param accessOpts The Azure DevOps access options to the repository
 */
export const repositoryHasFile = async (
  fileName: string,
  branch: string,
  repoName: string,
  accessOpts: AzureDevOpsOpts
): Promise<void> => {
  const gitApi = await GitAPI(accessOpts);
  const versionDescriptor = { version: branch }; // change to branch
  const gitItem = await gitApi.getItem(
    repoName,
    fileName, // Add path to service
    accessOpts.project,
    "",
    undefined,
    undefined,
    undefined,
    undefined,
    versionDescriptor
  );

  if (gitItem === null) {
    throw Error(
      "Error installing build pipeline. Repository does not have a " +
        fileName +
        " file."
    );
  }
};

/**
 * Validates if a repository exists and if it contains the given file
 * @param project  The Azure DevOps project name
 * @param fileName The name of the file
 * @param branch The branch name
 * @param repoName The name of the repository
 * @param accessOpts The Azure DevOps access options to the repository
 */
export const validateRepository = async (
  project: string,
  fileName: string,
  branch: string,
  repoName: string,
  accessOpts: AzureDevOpsOpts
): Promise<void> => {
  const gitApi = await GitAPI(accessOpts);
  const repo = await gitApi.getRepository(repoName, project);

  if (!repo) {
    throw Error(
      `Project '${project}' does not contain repository '${repoName}'.`
    );
  }

  await repositoryHasFile(fileName, branch, repoName, accessOpts);
};
