import Table from "cli-table";
import commander from "commander";
import Deployment from "spektate/lib/Deployment";
import AzureDevOpsPipeline from "spektate/lib/pipeline/AzureDevOpsPipeline";
import IPipeline from "spektate/lib/pipeline/Pipeline";
import { Config } from "../../config";
import { logger } from "../../logger";
export let hldPipeline: IPipeline;
export let clusterPipeline: IPipeline;
export let srcPipeline: IPipeline;
/**
 * Output formats to display service details
 */
export enum OUTPUT_FORMAT {
  /**
   * Normal format
   */
  NORMAL = 0,

  /**
   * Wide table format
   */
  WIDE = 1,

  /**
   * JSON format
   */
  JSON = 2
}

/**
 * Adds the get command to the commander command object
 * @param command Commander command object to decorate
 */
export const getCommandDecorator = (command: commander.Command): void => {
  command
    .command("get")
    .alias("g")
    .description(
      "Get the list of deployments and filter with these options: service name, environment, build ID, commit ID, container image tag."
    )
    .option(
      "-b, --build-id <build-id>",
      "Filter by the build ID of the source repository"
    )
    .option(
      "-c, --commit-id <commit-id>",
      "Filter by a commit ID from the source repository"
    )
    .option(
      "-d, --deployment-id <deployment-id>",
      "Filter by the deployment ID of the source repository"
    )
    .option("-i, --image-tag <image-tag>", "Filter by a container image tag")
    .option("-e, --env <environment>", "Filter by environment name")
    .option("-s, --service <service-name>", "Filter by service name")
    .option("-t, --top <top>", "Return only top N most recent deployments")
    .option(
      "-o, --output <output-format>",
      "Output the information one of the following: normal, wide, JSON"
    )
    .option("-w, --watch", "Watch the deployments for a live view")
    .action(async opts => {
      try {
        await initialize();
        if (opts.watch) {
          watchGetDeployments(
            processOutputFormat(opts.output),
            opts.env,
            opts.imageTag,
            opts.buildId,
            opts.commitId,
            opts.service,
            opts.deploymentId,
            opts.top
          );
        } else {
          await getDeployments(
            processOutputFormat(opts.output),
            opts.env,
            opts.imageTag,
            opts.buildId,
            opts.commitId,
            opts.service,
            opts.deploymentId,
            opts.top
          );
        }
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
export const processOutputFormat = (outputFormat: string): OUTPUT_FORMAT => {
  if (outputFormat && outputFormat.toLowerCase() === "wide") {
    return OUTPUT_FORMAT.WIDE;
  } else if (outputFormat && outputFormat.toLowerCase() === "json") {
    return OUTPUT_FORMAT.JSON;
  }

  return OUTPUT_FORMAT.NORMAL;
};

/**
 * Gets a list of deployments for the specified filters
 * @param outputFormat output format: normal | wide | json
 * @param environment release environment, such as Dev, Staging, Prod etc.
 * @param imageTag docker image tag name
 * @param p1Id identifier of the first build pipeline (src to ACR)
 * @param commitId commit Id into the source repo
 * @param service name of the service that was modified
 * @param deploymentId unique identifier for the deployment
 */
export const getDeployments = async (
  outputFormat: OUTPUT_FORMAT,
  environment?: string,
  imageTag?: string,
  p1Id?: string,
  commitId?: string,
  service?: string,
  deploymentId?: string,
  limit?: number
): Promise<Deployment[]> => {
  const config = Config();
  const key = await Config().introspection!.azure!.key;

  return Deployment.getDeploymentsBasedOnFilters(
    config.introspection!.azure!.account_name!,
    key!,
    config.introspection!.azure!.table_name!,
    config.introspection!.azure!.partition_key!,
    srcPipeline,
    hldPipeline,
    clusterPipeline,
    environment,
    imageTag,
    p1Id,
    commitId,
    service,
    deploymentId
  ).then((deployments: Deployment[]) => {
    if (outputFormat === OUTPUT_FORMAT.JSON) {
      logger.info(JSON.stringify(deployments, null, 2));
    } else {
      printDeployments(deployments, outputFormat, limit);
    }
    return deployments;
  });
};

/**
 * Initializes the pipelines assuming that the configuration has been loaded
 */
const initialize = async () => {
  const config = Config();
  const key = await Config().introspection!.azure!.key;

  if (
    !config.introspection ||
    !config.azure_devops ||
    !config.introspection.azure ||
    !config.azure_devops.org ||
    !config.azure_devops.project ||
    !config.introspection.azure.account_name ||
    !config.introspection.azure.table_name ||
    !key ||
    !config.introspection.azure.partition_key
  ) {
    logger.error(
      "You need to run `spk init` and `spk deployment onboard` to configure `spk."
    );
    process.exit(1);
    return;
  }

  srcPipeline = new AzureDevOpsPipeline(
    config.azure_devops.org,
    config.azure_devops.project,
    false,
    config.azure_devops.access_token
  );
  hldPipeline = new AzureDevOpsPipeline(
    config.azure_devops.org,
    config.azure_devops.project,
    true,
    config.azure_devops.access_token
  );
  clusterPipeline = new AzureDevOpsPipeline(
    config.azure_devops.org,
    config.azure_devops.project,
    false,
    config.azure_devops.access_token
  );
};

/**
 * Gets a list of deployments for the specified filters every 5 seconds
 * @param outputFormat output format: normal | wide | json
 * @param environment release environment, such as Dev, Staging, Prod etc.
 * @param imageTag docker image tag name
 * @param p1Id identifier of the first build pipeline (src to ACR)
 * @param commitId commit Id into the source repo
 * @param service name of the service that was modified
 * @param deploymentId unique identifier for the deployment
 */
export const watchGetDeployments = (
  outputFormat: OUTPUT_FORMAT,
  environment?: string,
  imageTag?: string,
  p1Id?: string,
  commitId?: string,
  service?: string,
  deploymentId?: string,
  limit?: number
): void => {
  const timeInterval = 5000;

  // Call get deployments once, and then set the timer.
  getDeployments(
    outputFormat,
    environment,
    imageTag,
    p1Id,
    commitId,
    service,
    deploymentId,
    limit
  );

  setInterval(() => {
    getDeployments(
      outputFormat,
      environment,
      imageTag,
      p1Id,
      commitId,
      service,
      deploymentId,
      limit
    );
  }, timeInterval);
};

/**
 * Prints deployments in a terminal table
 * @param deployments list of deployments to print in terminal
 * @param outputFormat output format: normal | wide | json
 */
export const printDeployments = (
  deployments: Deployment[],
  outputFormat: OUTPUT_FORMAT,
  limit?: number
): Table | undefined => {
  if (deployments.length > 0) {
    let row = [];
    row.push("Start Time");
    row.push("Service");
    row.push("Deployment");
    row.push("Commit");
    row.push("Src to ACR");
    row.push("Image Tag");
    row.push("Result");
    row.push("ACR to HLD");
    row.push("Env");
    row.push("Hld Commit");
    row.push("Result");
    row.push("HLD to Manifest");
    row.push("Result");
    if (outputFormat === OUTPUT_FORMAT.WIDE) {
      row.push("Duration");
      row.push("Status");
      row.push("Manifest Commit");
      row.push("End Time");
    }

    // tslint:disable: object-literal-sort-keys
    const table = new Table({
      head: row,
      chars: {
        top: "",
        "top-mid": "",
        "top-left": "",
        "top-right": "",
        bottom: "",
        "bottom-mid": "",
        "bottom-left": "",
        "bottom-right": "",
        left: "",
        "left-mid": "",
        mid: "",
        "mid-mid": "",
        right: "",
        "right-mid": "",
        middle: " "
      },
      style: { "padding-left": 0, "padding-right": 0 }
    });

    let count = 0;
    // disable for-of so that break can be used
    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < deployments.length; i++) {
      const deployment = deployments[i];
      row = [];
      row.push(
        deployment.srcToDockerBuild
          ? deployment.srcToDockerBuild.startTime.toLocaleString()
          : deployment.hldToManifestBuild
          ? deployment.hldToManifestBuild.startTime.toLocaleString()
          : "-"
      );
      row.push(deployment.service !== "" ? deployment.service : "-");
      row.push(deployment.deploymentId);
      row.push(deployment.commitId !== "" ? deployment.commitId : "-");
      row.push(
        deployment.srcToDockerBuild ? deployment.srcToDockerBuild.id : "-"
      );
      row.push(deployment.imageTag !== "" ? deployment.imageTag : "-");
      row.push(
        deployment.srcToDockerBuild
          ? getStatus(deployment.srcToDockerBuild.result)
          : ""
      );

      let dockerToHldId = "-";
      let dockerToHldStatus = "";

      if (deployment.dockerToHldRelease) {
        dockerToHldId = deployment.dockerToHldRelease.id;
        dockerToHldStatus = getStatus(deployment.dockerToHldRelease.status);
      } else if (deployment.dockerToHldReleaseStage) {
        dockerToHldId = deployment.dockerToHldReleaseStage.id;
        dockerToHldStatus = getStatus(
          deployment.dockerToHldReleaseStage.status
        );
      }
      row.push(dockerToHldId);

      row.push(
        deployment.environment !== ""
          ? deployment.environment.toUpperCase()
          : "-"
      );
      row.push(deployment.hldCommitId !== "" ? deployment.hldCommitId : "-");
      row.push(dockerToHldStatus);
      row.push(
        deployment.hldToManifestBuild ? deployment.hldToManifestBuild.id : "-"
      );
      row.push(
        deployment.hldToManifestBuild
          ? getStatus(deployment.hldToManifestBuild.result)
          : ""
      );
      if (outputFormat === OUTPUT_FORMAT.WIDE) {
        row.push(deployment.duration() + " mins");
        row.push(deployment.status());
        row.push(
          deployment.manifestCommitId !== "" ? deployment.manifestCommitId : "-"
        );
        row.push(
          deployment.hldToManifestBuild &&
            deployment.hldToManifestBuild.finishTime &&
            !isNaN(new Date(deployment.hldToManifestBuild.finishTime).getTime())
            ? deployment.hldToManifestBuild.finishTime.toLocaleString()
            : deployment.srcToDockerBuild &&
              deployment.srcToDockerBuild.finishTime &&
              !isNaN(new Date(deployment.srcToDockerBuild.finishTime).getTime())
            ? deployment.srcToDockerBuild.finishTime.toLocaleString()
            : "-"
        );
      }
      table.push(row);
      count++;
      if (limit && count >= limit) {
        break;
      }
    }

    logger.info("\n" + table.toString());
    return table;
  } else {
    logger.info("No deployments found for specified filters.");
    return undefined;
  }
};

/**
 * Gets a status indicator icon
 */
const getStatus = (status: string) => {
  if (status === "succeeded") {
    return "\u2713";
  } else if (!status) {
    return "...";
  }
  return "\u0445";
};
