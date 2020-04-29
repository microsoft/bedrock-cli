import GitUrlParse from "git-url-parse";
import path from "path";
import url from "url";
import { logger } from "../logger";
import { exec } from "./shell";
import { build as buildError } from "./errorBuilder";
import { errorStatusCode } from "./errorStatusCode";
import { CommandOptions } from "../commands/project/pipeline";

/**
 * For git urls that you may want to log only!
 * Checks if a provided git url contains any user or auth information, and returns a safe url for logging.
 *
 * @param repoUrl Git Repo URL that _may_ contain a PAT or auth token.
 * @returns A safe string to log.
 */
export const safeGitUrlForLogging = (repoUrl: string): string => {
  const parsedUrl = GitUrlParse(repoUrl);

  if (parsedUrl.user !== "" || parsedUrl.token !== "") {
    return `${parsedUrl.protocol}://${parsedUrl.resource}${parsedUrl.pathname}`;
  }

  return repoUrl;
};

/**
 * Gets the current working branch.
 *
 * @param repoDir the directory of the git repository to get current branch of
 */
export const getCurrentBranch = async (
  repoDir: string = process.cwd()
): Promise<string> => {
  try {
    const branch = await exec("git", ["branch", "--show-current"], {
      cwd: path.resolve(repoDir),
    });
    return branch;
  } catch (err) {
    throw buildError(
      errorStatusCode.GIT_OPS_ERR,
      "git-err-show-current-branch",
      err
    );
  }
};

/**
 * Checkout the given branch; optionally create a new branch first.
 *
 * @param branchName
 * @param createNewBranch
 */
export const checkoutBranch = async (
  branchName: string,
  createNewBranch: boolean
): Promise<void> => {
  try {
    if (createNewBranch) {
      await exec("git", ["checkout", "-b", branchName]);
    } else {
      await exec("git", ["checkout", branchName]);
    }
  } catch (err) {
    throw buildError(
      errorStatusCode.GIT_OPS_ERR,
      {
        errorKey: "git-err-checkout",
        values: [branchName],
      },
      err
    );
  }
};

/**
 * Delete local branch.
 *
 * @param branchName
 */
export const deleteBranch = async (branchName: string): Promise<void> => {
  try {
    await exec("git", ["branch", "-D", branchName]);
  } catch (err) {
    throw buildError(
      errorStatusCode.GIT_OPS_ERR,
      {
        errorKey: "git-err-delete-branch",
        values: [branchName],
      },
      err
    );
  }
};

/**
 * Adds the provided pathspec and commits changes for a new service.
 *
 * @param pathspecs - https://git-scm.com/docs/git-add#Documentation/git-add.txt-ltpathspecgt82308203
 * @param branchName
 */
export const commitPath = async (
  branchName: string,
  ...pathspecs: string[]
): Promise<void> => {
  try {
    await exec("git", ["add", ...pathspecs]);
    await exec("git", ["commit", "-m", `Adding new service: ${branchName}`]);
  } catch (err) {
    throw buildError(
      errorStatusCode.GIT_OPS_ERR,
      {
        errorKey: "git-err-add-commit",
        values: [pathspecs.join(","), branchName],
      },
      err
    );
  }
};

/**
 * Pushes branch to origin.
 *
 * @param branchName
 */
export const pushBranch = async (branchName: string): Promise<void> => {
  try {
    await exec("git", ["push", "-u", "origin", `${branchName}`]);
  } catch (err) {
    throw buildError(
      errorStatusCode.GIT_OPS_ERR,
      {
        errorKey: "git-err-push",
        values: [branchName],
      },
      err
    );
  }
};

/**
 * Gets the origin url.
 * @param absRepositoryPath The Absolute Path to the Repository to fetch the origin
 */
export const getOriginUrl = async (
  absRepositoryPath = "."
): Promise<string> => {
  try {
    const originUrl = await exec(
      "git",
      ["config", "--get", "remote.origin.url"],
      { cwd: absRepositoryPath }
    );

    const safeLoggingUrl = safeGitUrlForLogging(originUrl);
    logger.debug(`Got git origin url ${safeLoggingUrl}`);
    return originUrl;
  } catch (err) {
    throw buildError(errorStatusCode.GIT_OPS_ERR, "git-err-get-orgin-url", err);
  }
};

export const getAzdoOriginUrl = async (): Promise<string> => {
  try {
    if (!process.env.APP_REPO_URL) {
      throw buildError(
        errorStatusCode.GIT_OPS_ERR,
        "git-err-azdo-get-orgin-url-no-pipeline"
      );
    }

    const originUrl = process.env.APP_REPO_URL;
    const safeLoggingUrl = safeGitUrlForLogging(originUrl);
    logger.debug(`Got azdo git origin url ${safeLoggingUrl}`);
    return originUrl;
  } catch (err) {
    throw buildError(
      errorStatusCode.GIT_OPS_ERR,
      "git-err-azdo-get-orgin-url",
      err
    );
  }
};

/**
 * Tries to fetch the Git origin from an AzDo set environment variable, else falls back to fetching it from Git directly.
 * @param absRepoPath The Absolute Path to the Repository to fetch the origin url.
 */
export const tryGetGitOrigin = async (
  absRepoPath?: string
): Promise<string> => {
  return getAzdoOriginUrl().catch(() => {
    logger.warn(
      "Could not get Git Origin for Azure DevOps - are you running 'bedrock' _not_ in a pipeline?"
    );
    return getOriginUrl(absRepoPath);
  });
};

/**
 * Will return the name of the repository
 * Currently only AzDo repos are supported
 * @param originUrl
 */
export const getRepositoryName = (originUrl: string): string => {
  const { resource, name } = GitUrlParse(originUrl);
  if (resource.includes("dev.azure.com")) {
    logger.debug("azure devops repo found.");
    return name;
  } else if (resource.includes("visualstudio.com")) {
    logger.debug("visualstudio.com repo found");
    return name;
  } else if (resource === "github.com") {
    logger.debug("github repo found.");
    return name;
  } else {
    if (!resource.startsWith("http")) {
      throw buildError(
        errorStatusCode.VALIDATION_ERR,
        "git-err-invalid-repository-url"
      );
    }
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "git-err-validating-remote-git"
    );
  }
};

/**
 * Will return the URL of the repository
 * Currently only AzDo and Github are supported.
 * @param originUrl
 */
export const getRepositoryUrl = (originUrl: string): string => {
  const { resource, organization, owner, name, protocol } = GitUrlParse(
    originUrl
  );
  if (resource.includes("dev.azure.com")) {
    logger.debug("azure devops repo found.");
    return `https://dev.azure.com/${organization}/${owner}/_git/${name}`;
  } else if (resource.includes("visualstudio.com")) {
    logger.debug(`visualstudio.com repo found`);
    switch (protocol.toLowerCase()) {
      case "ssh":
        return `https://${organization}.visualstudio.com/${owner}/_git/${name}`;
      case "https":
        return `https://${resource}/${owner}/_git/${name}`;
      default:
        throw buildError(errorStatusCode.GIT_OPS_ERR, {
          errorKey: "git-err-get-repo-url-unknown-protocol",
          values: [protocol, originUrl],
        });
    }
  } else if (resource === "github.com") {
    logger.debug("github repo found.");
    return `https://github.com/${organization}/${name}`;
  } else {
    throw buildError(errorStatusCode.GIT_OPS_ERR, "git-err-get-repo-url");
  }
};

/**
 * Will create a link to create a PR for a given origin, base branch, and new branch.
 * Currently only AzDo and Github are supported.
 *
 * @param baseBranch
 * @param newBranch
 * @param originUrl
 */
export const getPullRequestLink = async (
  baseBranch: string,
  newBranch: string,
  originUrl: string
): Promise<string> => {
  try {
    const { protocol, organization, name, owner, resource } = GitUrlParse(
      originUrl
    );
    if (resource.includes("dev.azure.com")) {
      logger.debug("azure devops repo found.");
      return `https://dev.azure.com/${organization}/${owner}/_git/${name}/pullrequestcreate?sourceRef=${newBranch}&targetRef=${baseBranch}`;
    } else if (resource.includes("visualstudio.com")) {
      logger.debug("visualstudio.com repo found");
      switch (protocol.toLowerCase()) {
        case "ssh":
          return `https://${organization}.visualstudio.com/${owner}/_git/${name}/pullrequestcreate?sourceRef=${newBranch}&targetRef=${baseBranch}`;
        case "https":
          return `https://${resource}/${owner}/_git/${name}/pullrequestcreate?sourceRef=${newBranch}&targetRef=${baseBranch}`;
        default:
          throw buildError(errorStatusCode.GIT_OPS_ERR, {
            errorKey: "git-err-get-pull-request-link-unknown-prototype",
            values: [protocol, originUrl],
          });
      }
    } else if (resource === "github.com") {
      logger.debug("github repo found.");
      return `https://github.com/${organization}/${name}/compare/${baseBranch}...${newBranch}?expand=1`;
    } else {
      logger.error(
        "Could not determine origin repository, or it is not a supported type."
      );
      return "Could not determine origin repository, or it is not a supported provider. Please check for the newly pushed branch and open a PR manually.";
    }
  } catch (err) {
    throw buildError(
      errorStatusCode.GIT_OPS_ERR,
      "git-err-get-pull-request-link-err",
      err
    );
  }
};

/**
 * If the git repository is empty, git rev-parse HEAD will throw an error.
 */
export const isEmptyRepository = async (): Promise<boolean> => {
  try {
    await exec("git", ["rev-parse", "HEAD"]);
  } catch (e) {
    // No commits, repository is empty.
    return true;
  }

  // Commits exist, repository is not empty.
  return false;
};

/**
 * Returns a git repository url
 *
 * @param opts Options object from commander.
 * @param gitOriginUrl Git origin URL which is used to set values
 *        for pipeline, repoName and repoUrl
 */
export const validateRepoUrl = (
  opts: CommandOptions,
  gitOriginUrl: string
): string => {
  return opts.repoUrl || getRepositoryUrl(gitOriginUrl);
};

/**
 * Validates whether a url is a github url
 * TEMPORARY, UNTIL GITHUB REPOS ARE SUPPORTED
 *
 * @param sUrl the url string
 */
export const isGitHubUrl = (sUrl: string): boolean => {
  const oUrl = url.parse(sUrl);
  return oUrl.hostname === "www.github.com" || oUrl.hostname === "github.com";
};
