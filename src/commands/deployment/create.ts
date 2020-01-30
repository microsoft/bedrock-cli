import commander from "commander";
import {
  addSrcToACRPipeline,
  IDeploymentTable,
  updateACRToHLDPipeline,
  updateHLDToManifestPipeline,
  updateManifestCommitId
} from "../../lib/azure/deploymenttable";
import { logger } from "../../logger";

/**
 * Creates a create command decorator for the command to update a deployment in storage
 * @param command
 */
export const createCommandDecorator = (command: commander.Command): void => {
  command
    .command("create")
    .alias("c")
    .description("Insert the deployment in storage from pipelines")
    .option(
      "-k, --access-key <access-key>",
      "Access key of the storage account"
    )
    .option("-n, --name <account-name>", "Name of the storage account")
    .option(
      "-p, --partition-key <partition-key>",
      "Partition key for the storage account"
    )
    .option("-t, --table-name <table-name>", "Name of table in storage account")
    .option("--p1 <p1>", "Identifier for the first pipeline")
    .option("--image-tag <image-tag>", "Image tag")
    .option("--commit-id <commit-id>", "Commit Id in source repository")
    .option("--service <service>", "Service name")
    .option("--p2 <p2>", "Identifier for the second pipeline")
    .option("--hld-commit-id <hld-commit-id>", "Commit id in HLD repository")
    .option("--env <env>", "Release environment name")
    .option("--p3 <p3>", "Identifier for the third pipeline")
    .option(
      "--pr <pr-id>",
      "Pull request identifier for a PR opened/closed in the HLD"
    )
    .option(
      "--manifest-commit-id <manifest-commit-id>",
      "Commit Id in the manifest repository"
    )
    .action(async opts => {
      if (
        !opts.accessKey ||
        !opts.name ||
        !opts.partitionKey ||
        !opts.tableName
      ) {
        logger.error(
          "You must specify all of access key, storage account name, partition key, table name, filter name and filter value"
        );
        return;
      }

      const tableInfo: IDeploymentTable = {
        accountKey: opts.accessKey,
        accountName: opts.name,
        partitionKey: opts.partitionKey,
        tableName: opts.tableName
      };

      // This is being called from the first pipeline. Make sure all other fields are defined.
      if (opts.p1) {
        if (!opts.imageTag || !opts.commitId || !opts.service) {
          logger.error(
            "For updating the details of source pipeline, you must specify --image-tag, --commit-id and --service"
          );
          return;
        }

        addSrcToACRPipeline(
          tableInfo,
          opts.p1,
          opts.imageTag,
          opts.service,
          opts.commitId
        );
        return;
      }

      // This is being called from the second pipeline. Make sure all other fields are defined.
      if (opts.imageTag || opts.p2) {
        if (!opts.p2 || !opts.hldCommitId || !opts.env || !opts.imageTag) {
          logger.error(
            "For updating the details of image tag release pipeline, you must specify --p2, --hld-commit-id, --image-tag and --env"
          );
          return;
        }
        updateACRToHLDPipeline(
          tableInfo,
          opts.p2,
          opts.imageTag,
          opts.hldCommitId,
          opts.env,
          opts.pr
        );
        return;
      }

      // This is being called from the third pipeline. Make sure all other fields are defined.
      if (opts.hldCommitId && opts.p3) {
        if (!opts.p3) {
          logger.error(
            "For updating the details of manifest generation pipeline, you must specify --p3"
          );
          return;
        }
        updateHLDToManifestPipeline(
          tableInfo,
          opts.hldCommitId,
          opts.p3,
          opts.manifestCommitId,
          opts.pr
        );
        return;
      }

      // This is being called from the third pipeline to update manifest id. Make sure all other fields are defined.
      if (opts.p3 && opts.manifestCommitId) {
        if (!opts.manifestCommitId) {
          logger.error(
            "For updating the details of manifest generation pipeline, you must specify --manifest-commit-id"
          );
          return;
        }
        updateManifestCommitId(tableInfo, opts.p3, opts.manifestCommitId);
        return;
      }

      //  Execution should not get here; request user to specify arguments correctly
      logger.error("No action could be performed for specified arguments.");
    });
};
