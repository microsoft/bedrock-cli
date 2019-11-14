import GitUrlParse from "git-url-parse";
import { logger } from "../logger";
import { exec } from "./shell";

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
 */
export const getCurrentBranch = async (): Promise<string> => {
  try {
    const branch = await exec("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
    return branch;
  } catch (_) {
    throw Error("Unable to determine current branch: " + _);
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
      await exec("git", ["checkout", "-b", `${branchName}`]);
    } else {
      await exec("git", ["checkout", `${branchName}`]);
    }
  } catch (_) {
    throw Error(`Unable to checkout git branch ${branchName}: ` + _);
  }
};

/**
 * Delete local branch.
 *
 * @param branchName
 */
export const deleteBranch = async (branchName: string): Promise<void> => {
  try {
    await exec("git", ["branch", "-D", `${branchName}`]);
  } catch (_) {
    throw Error(`Unable to delete git branch ${branchName}: ` + _);
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
  } catch (_) {
    throw Error(
      `Unable to commit changes in ${pathspecs.join(
        ","
      )} to git branch ${branchName}: ` + _
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
  } catch (_) {
    throw Error(`Unable to push git branch ${branchName}: ` + _);
  }
};

/**
 * Gets the origin url.
 */
export const getOriginUrl = async (): Promise<string> => {
  try {
    const originUrl = await exec("git", [
      "config",
      "--get",
      "remote.origin.url"
    ]);

    const safeLoggingUrl = safeGitUrlForLogging(originUrl);
    logger.debug(`Got git origin url ${safeLoggingUrl}`);
    return originUrl;
  } catch (_) {
    throw Error(`Unable to get git origin URL.: ` + _);
  }
};

/**
 * Will return the name of the repository
 * Currently only AzDo and Github are supported.
 * @param originUrl
 */
export const getRepositoryName = (originUrl: string) => {
  const gitComponents = GitUrlParse(originUrl);
  if (gitComponents.resource.includes("dev.azure.com")) {
    logger.debug("azure devops repo found.");
    return gitComponents.name;
  } else if (gitComponents.resource === "github.com") {
    logger.debug("github repo found.");
    return gitComponents.name;
  } else {
    throw Error(
      "Could not determine origin repository, or it is not a supported type."
    );
  }
};

/**
 * Will return the URL of the repository
 * Currently only AzDo and Github are supported.
 * @param originUrl
 */
export const getRepositoryUrl = (originUrl: string) => {
  const gitComponents = GitUrlParse(originUrl);
  if (gitComponents.resource.includes("dev.azure.com")) {
    logger.debug("azure devops repo found.");
    return `https://dev.azure.com/${gitComponents.organization}/${gitComponents.owner}/_git/${gitComponents.name}`;
  } else if (gitComponents.resource === "github.com") {
    logger.debug("github repo found.");
    return `https://github.com/${gitComponents.organization}/${gitComponents.name}`;
  } else {
    throw Error(
      "Could not determine origin repository, or it is not a supported type."
    );
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
    const gitComponents = GitUrlParse(originUrl);
    if (gitComponents.resource.includes("dev.azure.com")) {
      logger.debug("azure devops repo found.");
      return `https://dev.azure.com/${gitComponents.organization}/${gitComponents.owner}/_git/${gitComponents.name}/pullrequestcreate?sourceRef=${newBranch}&targetRef=${baseBranch}`;
    } else if (gitComponents.resource === "github.com") {
      logger.debug("github repo found.");
      return `https://github.com/${gitComponents.organization}/${gitComponents.name}/compare/${baseBranch}...${newBranch}?expand=1`;
    } else {
      logger.error(
        "Could not determine origin repository, or it is not a supported type."
      );
      return "Could not determine origin repository, or it is not a supported provider. Please check for the newly pushed branch and open a PR manually.";
    }
  } catch (_) {
    throw Error(
      `"Could not determine git provider, or it is not a supported type.": ` + _
    );
  }
};

export const checkoutCommitPushCreatePRLink = async (
  newBranchName: string,
  ...pathspecs: string[]
): Promise<void> => {
  try {
    const currentBranch = await getCurrentBranch().catch(e => {
      throw Error(
        `Cannot fetch current branch. Changes will have to be manually committed. ${e}`
      );
    });
    await checkoutBranch(newBranchName, true).catch(e => {
      throw Error(
        `Cannot create and checkout new branch ${newBranchName}. Changes will have to be manually committed. ${e}`
      );
    });
    await commitPath(newBranchName, ...pathspecs).catch(e => {
      throw Error(
        `Cannot commit changes in ${pathspecs.join(
          ", "
        )} to branch ${newBranchName}. Changes will have to be manually committed. ${e}`
      );
    });
    await pushBranch(newBranchName).catch(e => {
      throw Error(
        `Cannot push branch ${newBranchName}. Changes will have to be manually committed. ${e}`
      );
    });

    const pullRequestLink = await getPullRequestLink(
      currentBranch,
      newBranchName,
      await getOriginUrl()
    ).catch(e => {
      throw Error(
        `Could not create link for Pull Request. It will need to be done manually. ${e}`
      );
    });
    logger.info(`Link to create PR: ${pullRequestLink}`);

    // cleanup
    await checkoutBranch(currentBranch, false).catch(e => {
      throw Error(
        `Cannot checkout original branch ${currentBranch}. Clean up will need to be done manually. ${e}`
      );
    });
    await deleteBranch(newBranchName).catch(e => {
      throw Error(
        `Cannot delete new branch ${newBranchName}. Cleanup will need to be done manually. ${e}`
      );
    });
  } catch (err) {
    logger.error(err);
    throw err;
  }
};
