import commander from "commander";
import { join } from "path";
import { Bedrock, Config } from "../../config";
import { createPullRequest } from "../../lib/git/azure";
import {
  getCurrentBranch,
  getOriginUrl,
  safeGitUrlForLogging
} from "../../lib/gitutils";
import { logger } from "../../logger";

export const createServiceRevisionCommandDecorator = (
  command: commander.Command
): void => {
  command
    .command("create-revision")
    .alias("cr")
    .description(
      "Create pull requests against the branches marked as `isDefault` in your bedrock config"
    )
    .option(
      "-s, --source-branch <source>",
      "Source branch to create the pull request from; defaults to the current branch"
    )
    .option("-t, --title <title>", "Title of the pull request; not required")
    .option(
      "-d, --description <description>",
      "Description of the pull request; not required"
    )
    .option(
      "--remote-url <remote-url>",
      "The remote host to create the pull request in; defaults to the URL for 'origin'"
    )
    .option(
      "--personal-access-token <pat>",
      "Personal access token associated with your Azure DevOps token; falls back to azure_devops.access_token in your spk config"
    )
    .option(
      "--org-name <organization-name>",
      "Your Azure DevOps organization name; falls back to azure_devops.org in your spk config"
    )
    .option(
      "--target-branch",
      "Target branch/ring to create a PR against; overwrites the default rings specified in bedrock.yaml"
    )
    .action(async opts => {
      try {
        const { azure_devops } = Config();
        const {
          orgName = azure_devops && azure_devops.org,
          personalAccessToken = azure_devops && azure_devops.access_token,
          targetBranch
        } = opts;
        let { description, remoteUrl, sourceBranch, title } = opts;

        ////////////////////////////////////////////////////////////////////////
        // Give defaults
        ////////////////////////////////////////////////////////////////////////
        // default pull request against initial ring
        const bedrockConfig = Bedrock();
        // Default to the --target-branch for creating a revision; if not specified, fallback to default rings in bedrock.yaml
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

        // default pull request source branch to the current branch
        if (
          typeof sourceBranch !== "string" ||
          (typeof sourceBranch === "string" && sourceBranch.length === 0)
        ) {
          // Parse the source branch from options
          // If it does not exist, parse from the git client
          logger.info(
            `No source-branch provided, parsing the current branch for git client`
          );
          sourceBranch = await getCurrentBranch().then(branch => {
            if (branch.length === 0) {
              throw Error(
                `Zero length branch string parsed from git client; cannot automate PR`
              );
            }
            return branch;
          });
        }

        // Make sure the user isn't trying to make a PR for a branch against itself
        if (defaultRings.includes(sourceBranch)) {
          throw Error(
            `A pull request for a branch cannot be made against itself. Ensure your target branch(es) '${JSON.stringify(
              defaultRings
            )}' do not include your source branch '${sourceBranch}'`
          );
        }

        // Give a default description
        if (typeof description !== "string") {
          description = `This is automated PR generated via SPK`;
          logger.info(`--description not set, defaulting to: '${description}'`);
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

        ////////////////////////////////////////////////////////////////////////
        // Type-check data
        ////////////////////////////////////////////////////////////////////////
        if (typeof description !== "string") {
          throw Error(
            `--description must be of type 'string', ${typeof description} given.`
          );
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

        ////////////////////////////////////////////////////////////////////////
        // Main
        ////////////////////////////////////////////////////////////////////////
        // Make a PR against all default rings
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
      } catch (err) {
        logger.error(err);
        process.exitCode = 1;
      }
    });
};
