/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/camelcase */
import commander from "commander";
import { join } from "path";
import { Bedrock, Config } from "../../config";
import {
  build as buildCmd,
  exit as exitCmd,
  validateForRequiredValues,
} from "../../lib/commandBuilder";
import { createPullRequest } from "../../lib/git/azure";
import {
  getCurrentBranch,
  getOriginUrl,
  safeGitUrlForLogging,
} from "../../lib/gitutils";
import { hasValue } from "../../lib/validator";
import { logger } from "../../logger";
import { BedrockFile } from "../../types";
import decorator from "./create-revision.decorator.json";

export interface CommandOptions {
  sourceBranch: string | undefined;
  title: string | undefined;
  description: string | undefined;
  remoteUrl: string | undefined;
  personalAccessToken: string | undefined;
  orgName: string | undefined;
  targetBranch: string | undefined;
}

export const getRemoteUrl = async (
  remoteUrl: string | undefined
): Promise<string> => {
  if (!remoteUrl) {
    // if remoteUrl is not provided
    logger.info(
      `No remote-url provided, parsing remote from 'origin' on git client`
    );
    remoteUrl = await getOriginUrl();
    const safeLoggingUrl = safeGitUrlForLogging(remoteUrl);
    logger.info(`Parsed remote-url for origin: ${safeLoggingUrl}`);
  }
  return remoteUrl;
};

/**
 * Gets the default rings
 * @param targetBranch Target branch/ring to create a PR against
 * @param bedrockConfig The bedrock configuration file
 */
export const getDefaultRings = (
  targetBranch: string | undefined,
  bedrockConfig: BedrockFile
): string[] => {
  const defaultRings: string[] = targetBranch
    ? [targetBranch]
    : Object.entries(bedrockConfig.rings || {})
        .map(([branch, config]) => ({ branch, ...config }))
        .filter((ring) => !!ring.isDefault)
        .map((ring) => ring.branch);
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
  if (!hasValue(sourceBranch)) {
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
 * @param opts option values
 */
export const makePullRequest = async (
  defaultRings: string[],
  opts: CommandOptions
): Promise<void> => {
  for (const ring of defaultRings) {
    const title = opts.title || `[SPK] ${opts.sourceBranch} => ${ring}`;
    await createPullRequest(title, opts.sourceBranch!, ring, {
      description: opts.description!,
      orgName: opts.orgName!,
      originPushUrl: opts.remoteUrl!,
      personalAccessToken: opts.personalAccessToken!,
    });
  }
};

export const execute = async (
  opts: CommandOptions,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  try {
    const { azure_devops } = Config();
    opts.orgName = opts.orgName || azure_devops?.org;
    opts.personalAccessToken =
      opts.personalAccessToken || azure_devops?.access_token!;
    opts.description =
      opts.description || "This is automated PR generated via SPK";

    ////////////////////////////////////////////////////////////////////////
    // Give defaults
    ////////////////////////////////////////////////////////////////////////
    // default pull request against initial ring
    const bedrockConfig = Bedrock();
    // Default to the --target-branch for creating a revision; if not specified, fallback to default rings in bedrock.yaml
    const defaultRings = getDefaultRings(opts.targetBranch, bedrockConfig);

    // default pull request source branch to the current branch
    opts.sourceBranch = await getSourceBranch(opts.sourceBranch);

    // Make sure the user isn't trying to make a PR for a branch against itself
    if (defaultRings.includes(opts.sourceBranch)) {
      throw Error(
        `A pull request for a branch cannot be made against itself. Ensure your target branch(es) '${JSON.stringify(
          defaultRings
        )}' do not include your source branch '${opts.sourceBranch}'`
      );
    }

    // Default the remote to the git origin
    opts.remoteUrl = await getRemoteUrl(opts.remoteUrl);
    const errors = validateForRequiredValues(decorator, {
      orgName: opts.orgName,
      personalAccessToken: opts.personalAccessToken,
      remoteUrl: opts.remoteUrl,
      sourceBranch: opts.sourceBranch,
    });

    if (errors.length > 0) {
      await exitFn(1);
    } else {
      await makePullRequest(defaultRings, opts);
      await exitFn(0);
    }
  } catch (err) {
    logger.error(err);
    await exitFn(1);
  }
};

export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: CommandOptions) => {
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
