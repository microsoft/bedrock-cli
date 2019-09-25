import commander from "commander";
import { logger } from "../../logger";
import { Helper, OUTPUT_FORMAT } from "./helper";

/**
 * Adds the get command to the commander command object
 * @param command Commander command object to decorate
 */
export const getCommandDecorator = (command: commander.Command): void => {
  command
    .command("get")
    .alias("g")
    .description(
      "Get deployment(s) for a service, release environment, build Id, commit Id, or image tag."
    )
    .option(
      "-b, --build-id <build-id>",
      "Get deployments for a particular build Id from source repository"
    )
    .option(
      "-c, --commit-id <commit-id>",
      "Get deployments for a particular commit Id from source repository"
    )
    .option(
      "-d, --deployment-id <deployment-id>",
      "Get deployments for a particular deployment Id from source repository"
    )
    .option(
      "-i, --image-tag <image-tag>",
      "Get deployments for a particular image tag"
    )
    .option(
      "-e, --env <environment>",
      "Get deployments for a particular environment"
    )
    .option(
      "-s, --service <service-name>",
      "Get deployments for a particular service"
    )
    .option(
      "-o, --output <output-format>",
      "Get output in one of these forms: normal, wide, JSON"
    )
    .action(async opts => {
      try {
        Helper.verifyAppConfiguration(() => {
          Helper.getDeployments(
            processOutputFormat(opts.output),
            opts.env,
            opts.imageTag,
            opts.buildId,
            opts.commitId,
            opts.service,
            opts.deploymentId
          );
        });
      } catch (err) {
        logger.error(`Error occurred while getting deployment(s)`);
        logger.error(err);
      }
    });
};

/**
 * Processes the output format based on defaults
 * @param outputFormat Output format specified by the user
 */
function processOutputFormat(outputFormat: string): OUTPUT_FORMAT {
  if (outputFormat && outputFormat.toLowerCase() === "wide") {
    return OUTPUT_FORMAT.WIDE;
  } else if (outputFormat && outputFormat.toLowerCase() === "json") {
    return OUTPUT_FORMAT.JSON;
  }

  return OUTPUT_FORMAT.NORMAL;
}
