import commander from "commander";
import { join } from "path";
import { Bedrock, Config } from "../../config";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { createPullRequest } from "../../lib/git/azure";
import {
  getCurrentBranch,
  getOriginUrl,
  safeGitUrlForLogging
} from "../../lib/gitutils";
import { logger } from "../../logger";
import { IBedrockFile } from "../../types";
import decorator from "./create-revision.decorator.json";

export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async opts => {
    try {
      const { azure_devops } = Config();
      const {
        orgName = azure_devops && azure_devops.org,
        personalAccessToken = azure_devops && azure_devops.access_token,
        targetBranch
      } = opts;
      let { remoteUrl, sourceBranch } = opts;
      const description = opts.description;
      const title = opts.title;

      ////////////////////////////////////////////////////////////////////////
      // Give defaults
      ////////////////////////////////////////////////////////////////////////
      // default pull request against initial ring
      const bedrockConfig = Bedrock();
      // Default to the --target-branch for creating a revision; if not specified, fallback to default rings in bedrock.yaml
      const defaultRings: string[] = getDefaultRings(
        targetBranch,
        bedrockConfig
      );

      // default pull request source branch to the current branch
      sourceBranch = await getSourceBranch(sourceBranch);

      // Make sure the user isn't trying to make a PR for a branch against itself
      if (defaultRings.includes(sourceBranch)) {
        throw Error(
          `A pull request for a branch cannot be made against itself. Ensure your target branch(es) '${JSON.stringify(
            defaultRings
          )}' do not include your source branch '${sourceBranch}'`
        );
      }

      // Default the remote to the git origin
      if (typeof remoteUrl !== "string") {
        logger.info(
          `No remote-url provided, parsing remote from 'origin' on git client`
        );
        remoteUrl = await getOriginUrl();
        const safeLoggingUrl = safeGitUrlForLogging(remoteUrl);
        logger.info(`Parsed remote-url for origin: ${safeLoggingUrl}`);
      }

      await makePullRequest(
        defaultRings,
        title,
        sourceBranch,
        description,
        orgName,
        remoteUrl,
        personalAccessToken
      );

      await exitCmd(logger, process.exit, 0);
    } catch (err) {
      logger.error(err);
      await exitCmd(logger, process.exit, 1);
    }
  });
};

/**
 * Gets the default rings
 * @param targetBranch Target branch/ring to create a PR against
 * @param bedrockConfig The bedrock configuration file
 */
export const getDefaultRings = (
  targetBranch: string | undefined,
  bedrockConfig: IBedrockFile
): string[] => {
  const defaultRings: string[] = targetBranch
    ? [targetBranch]
    : Object.entries(bedrockConfig.rings || {})
        .map(([branch, config]) => ({ branch, ...config }))
        .filter(ring => !!ring.isDefault)
        .map(ring => ring.branch);
  if (defaultRings.length === 0) {
    throw Error(
      `Default branches/rings must either be specified in ${join(
        __dirname,
        "bedrock.yaml"
      )} or provided via --target-branch`
    );
  }
  logger.info(
    `Creating pull request against branches: ${defaultRings.join(", ")}`
  );
  return defaultRings;
};

/**
 * Gets the source branch or parses git for the source branch
 * @param sourceBranch The source branch
 */
export const getSourceBranch = async (
  sourceBranch: string | undefined
): Promise<string> => {
  if (
    typeof sourceBranch !== "string" ||
    (typeof sourceBranch === "string" && sourceBranch.length === 0)
  ) {
    // Parse the source branch from options
    // If it does not exist, parse from the git client
    logger.info(
      `No source-branch provided, parsing the current branch for git client`
    );
    sourceBranch = await getCurrentBranch();
    if (sourceBranch.length === 0) {
      throw Error(
        `Zero length branch string parsed from git client; cannot automate PR`
      );
    }
  }
  return sourceBranch;
};

/**
 * Creates a pull request from the given source branch
 * @param defaultRings List of default rings
 * @param title Title of pr
 * @param sourceBranch Source branch for pr
 * @param description Description for pr
 * @param orgName Organization name
 * @param remoteUrl Remote url
 * @param personalAccessToken Access token
 */
export const makePullRequest = async (
  defaultRings: string[],
  title: string | undefined,
  sourceBranch: string | undefined,
  description: string | undefined,
  orgName: string | undefined,
  remoteUrl: string | undefined,
  personalAccessToken: string | undefined
) => {
  // Give a default description
  if (typeof description !== "string") {
    description = `This is automated PR generated via SPK`;
    logger.info(`--description not set, defaulting to: '${description}'`);
  }
  if (typeof remoteUrl !== "string") {
    throw Error(
      `--remote-url must be of type 'string', ${typeof remoteUrl} given.`
    );
  }
  if (typeof sourceBranch !== "string") {
    throw Error(
      `--source-branch must be of type 'string', ${typeof sourceBranch} given.`
    );
  }
  if (typeof personalAccessToken !== "string") {
    throw Error(
      `--personal-access-token must be of type 'string', ${typeof personalAccessToken} given.`
    );
  }
  if (typeof orgName !== "string") {
    throw Error(
      `--org-name must be of type 'string', ${typeof orgName} given.`
    );
  }
  for (const ring of defaultRings) {
    if (typeof title !== "string") {
      title = `[SPK] ${sourceBranch} => ${ring}`;
      logger.info(`--title not set, defaulting to: '${title}'`);
    }
    await createPullRequest(title, sourceBranch, ring, {
      description,
      orgName,
      originPushUrl: remoteUrl,
      personalAccessToken
    });
  }
};
