import Table from "cli-table";
import commander from "commander";
import Deployment from "spektate/lib/Deployment";
import AzureDevOpsPipeline from "spektate/lib/pipeline/AzureDevOpsPipeline";
import IPipeline from "spektate/lib/pipeline/Pipeline";
import { logger } from "../../logger";
import { config } from "../init";
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
    .option(
      "-o, --output <output-format>",
      "Output the information one of the following: normal, wide, JSON"
    )
    .option("-w, --watch", "Watch the deployments for a live view")
    .action(async opts => {
      try {
        initialize();
        if (opts.watch) {
          watchGetDeployments(
            processOutputFormat(opts.output),
            opts.env,
            opts.imageTag,
            opts.buildId,
            opts.commitId,
            opts.service,
            opts.deploymentId
          );
        } else {
          getDeployments(
            processOutputFormat(opts.output),
            opts.env,
            opts.imageTag,
            opts.buildId,
            opts.commitId,
            opts.service,
            opts.deploymentId
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
export const getDeployments = (
  outputFormat: OUTPUT_FORMAT,
  environment?: string,
  imageTag?: string,
  p1Id?: string,
  commitId?: string,
  service?: string,
  deploymentId?: string
): Promise<Deployment[]> => {
  return Deployment.getDeploymentsBasedOnFilters(
    config.introspection!.azure!.account_name!,
    config.introspection!.azure!.key!,
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
      printDeployments(deployments, outputFormat);
    }
    return deployments;
  });
};

/**
 * Initializes the pipelines assuming that the configuration has been loaded
 */
const initialize = () => {
  if (
    !config.introspection ||
    !config.azure_devops ||
    !config.introspection.azure ||
    !config.azure_devops.org ||
    !config.azure_devops.project ||
    !config.introspection.azure.account_name ||
    !config.introspection.azure.table_name ||
    !config.introspection.azure.key ||
    !config.introspection.azure.partition_key
  ) {
    logger.error("You need to run `spk init` to initialize.");
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
  deploymentId?: string
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
    deploymentId
  );

  setInterval(() => {
    getDeployments(
      outputFormat,
      environment,
      imageTag,
      p1Id,
      commitId,
      service,
      deploymentId
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
  outputFormat: OUTPUT_FORMAT
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
    // tslint:enable: object-literal-sort-keys

    deployments.forEach(deployment => {
      row = [];
      row.push(
        deployment.srcToDockerBuild
          ? deployment.srcToDockerBuild.startTime.toLocaleString()
          : ""
      );
      row.push(deployment.service);
      row.push(deployment.deploymentId);
      row.push(deployment.commitId);
      row.push(
        deployment.srcToDockerBuild ? deployment.srcToDockerBuild.id : ""
      );
      row.push(deployment.imageTag);
      row.push(
        deployment.srcToDockerBuild
          ? getStatus(deployment.srcToDockerBuild.result)
          : ""
      );
      row.push(
        deployment.dockerToHldRelease ? deployment.dockerToHldRelease.id : ""
      );
      row.push(deployment.environment.toUpperCase());
      row.push(deployment.hldCommitId);
      row.push(
        deployment.dockerToHldRelease
          ? getStatus(deployment.dockerToHldRelease.status)
          : ""
      );
      row.push(
        deployment.hldToManifestBuild ? deployment.hldToManifestBuild.id : ""
      );
      row.push(
        deployment.hldToManifestBuild
          ? getStatus(deployment.hldToManifestBuild.result)
          : ""
      );
      if (outputFormat === OUTPUT_FORMAT.WIDE) {
        row.push(deployment.duration() + " mins");
        row.push(deployment.status());
        row.push(deployment.manifestCommitId);
        row.push(
          deployment.hldToManifestBuild &&
            deployment.hldToManifestBuild.finishTime &&
            !isNaN(new Date(deployment.hldToManifestBuild.finishTime).getTime())
            ? deployment.hldToManifestBuild.finishTime.toLocaleString()
            : ""
        );
      }
      table.push(row);
    });

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
