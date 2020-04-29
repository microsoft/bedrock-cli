import {
  isEmptyRepository,
  getCurrentBranch,
  checkoutBranch,
  commitPath,
  pushBranch,
  getOriginUrl,
  getPullRequestLink,
  deleteBranch,
} from "./gitutils";

import { logger } from "../logger";
import { errorStatusCode } from "./errorStatusCode";
import { build as buildError } from "./errorBuilder";

/**
 * Creates a new branch of name `newBranchName`, commits all `pathspecs` to the
 * new branch, pushes the new branch, and creates a PR to merge `newBranchName`
 * into the hosts current branch.
 *
 * @param newBranchName name of branch to create and which the a PR will be made for
 * @param pathspecs
 */
export const checkoutCommitPushCreatePRLink = async (
  newBranchName: string,
  ...pathspecs: string[]
): Promise<void> => {
  try {
    if (await isEmptyRepository()) {
      logger.error(
        `You have checked out an empty git repository. Please create a base commit. Run 'git commit -m "Init HLD" --allow-empty && git push origin HEAD'`
      );
      return;
    }

    const currentBranch = await getCurrentBranch();
    await checkoutBranch(newBranchName, true);
    await commitPath(newBranchName, ...pathspecs);
    await pushBranch(newBranchName);

    const originUrl = await getOriginUrl();
    const pullRequestLink = await getPullRequestLink(
      currentBranch,
      newBranchName,
      originUrl
    );
    logger.info(`Link to create PR: ${pullRequestLink}`);

    // cleanup
    await checkoutBranch(currentBranch, false);
    await deleteBranch(newBranchName);
  } catch (err) {
    throw buildError(
      errorStatusCode.GIT_OPS_ERR,
      "git-checkout-commit-push-create-PR-link",
      err
    );
  }
};
