import Table from "cli-table";
import commander from "commander";
import Deployment from "spektate/lib/Deployment";
import AzureDevOpsPipeline from "spektate/lib/pipeline/AzureDevOpsPipeline";
import { AzureDevOpsRepo } from "spektate/lib/repository/AzureDevOpsRepo";
import { GitHub } from "spektate/lib/repository/GitHub";
import { IRepository } from "spektate/lib/repository/Repository";
import { ITag } from "spektate/lib/repository/Tag";
import { Config } from "../../config";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { isIntegerString } from "../../lib/validator";
import { logger } from "../../logger";
import { IConfigYaml } from "../../types";
import decorator from "./get.decorator.json";

/**
 * Output formats to display service details
 */
export enum OUTPUT_FORMAT {
  NORMAL = 0, // normal format
  WIDE = 1, // Wide table format
  JSON = 2
}

/**
 * Interface for capturing all the
 * objects and key during the initialization
 * process
 */
export interface IInitObject {
  config: IConfigYaml;
  clusterPipeline: AzureDevOpsPipeline;
  hldPipeline: AzureDevOpsPipeline;
  key: string;
  srcPipeline: AzureDevOpsPipeline;
}

/**
 * Command Line values from the commander
 */
export interface ICommandOptions {
  watch: boolean;
  output: string;
  env: string;
  imageTag: string;
  buildId: string;
  commitId: string;
  service: string;
  deploymentId: string;
  top: string;
}

/**
 * Validated commandline values. After verify top value and
 * the output format.
 */
export interface IValidatedOptions extends ICommandOptions {
  nTop: number;
  outputFormat: OUTPUT_FORMAT;
}

/**
 * Validating the options values from commander.
 *
 * @param opts options values from commander
 * @return validated values
 * @throws Error if opts.top is not a positive integer
 */
export const validateValues = (opts: ICommandOptions): IValidatedOptions => {
  let top = 0; // no limits
  if (opts.top) {
    if (isIntegerString(opts.top)) {
      top = parseInt(opts.top, 10);
    } else {
      throw new Error("value for top option has to be a positive number");
    }
  }

  return {
    buildId: opts.buildId,
    commitId: opts.commitId,
    deploymentId: opts.deploymentId,
    env: opts.env,
    imageTag: opts.imageTag,
    nTop: top,
    output: opts.output,
    outputFormat: processOutputFormat(opts.output),
    service: opts.service,
    top: opts.top,
    watch: opts.watch
  };
};

/**
 * Executes the command, can all exit function with 0 or 1
 * when command completed successfully or failed respectively.
 *
 * @param opts validated option values
 * @param exitFn exit function
 */
export const execute = async (
  opts: ICommandOptions,
  exitFn: (status: number) => Promise<void>
) => {
  try {
    const values = validateValues(opts);
    const initObjects = await initialize();
    if (opts.watch) {
      await watchGetDeployments(initObjects, values);
    } else {
      await getDeployments(initObjects, values);
      await exitFn(0);
    }
  } catch (err) {
    logger.error(`Error occurred while getting deployment(s)`);
    logger.error(err);
    await exitFn(1);
  }
};

/**
 * Adds the get command to the commander command object
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: ICommandOptions) => {
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};

/**
 * Processes the output format based on defaults
 * @param outputFormat Output format specified by the user
 */
export const processOutputFormat = (outputFormat: string): OUTPUT_FORMAT => {
  if (outputFormat && outputFormat.toLowerCase() === "wide") {
    return OUTPUT_FORMAT.WIDE;
  }
  if (outputFormat && outputFormat.toLowerCase() === "json") {
    return OUTPUT_FORMAT.JSON;
  }
  return OUTPUT_FORMAT.NORMAL;
};

/**
 * Gets a list of deployments for the specified filters
 * @param initObj captures keys and objects during the initialization process
 * @param values validated command line values
 */
export const getDeployments = (
  initObj: IInitObject,
  values: IValidatedOptions
): Promise<Deployment[]> => {
  const config = initObj.config;
  const syncStatusesPromise = getClusterSyncStatuses(initObj);
  const deploymentsPromise = Deployment.getDeploymentsBasedOnFilters(
    config.introspection!.azure!.account_name!,
    initObj.key,
    config.introspection!.azure!.table_name!,
    config.introspection!.azure!.partition_key!,
    initObj.srcPipeline,
    initObj.hldPipeline,
    initObj.clusterPipeline,
    values.env,
    values.imageTag,
    values.buildId,
    values.commitId,
    values.service,
    values.deploymentId
  );
  return new Promise((resolve, reject) => {
    Promise.all([deploymentsPromise, syncStatusesPromise])
      .then((tuple: [Deployment[] | undefined, ITag[] | undefined]) => {
        const deployments: Deployment[] | undefined = tuple[0];
        const syncStatuses: ITag[] | undefined = tuple[1];
        if (values.outputFormat === OUTPUT_FORMAT.JSON) {
          // tslint:disable-next-line: no-console
          console.log(JSON.stringify(deployments, null, 2));
          resolve(deployments);
        } else {
          printDeployments(
            deployments,
            values.outputFormat,
            values.nTop,
            syncStatuses
          );
          resolve(deployments);
        }
      })
      .catch(e => {
        reject(new Error(e));
      });
  });
};

/**
 * Gets cluster sync statuses
 * @param initObj captures keys and objects during the initialization process
 */
export const getClusterSyncStatuses = (
  initObj: IInitObject
): Promise<ITag[] | undefined> => {
  const config = initObj.config;
  return new Promise((resolve, reject) => {
    try {
      if (
        config.azure_devops?.manifest_repository &&
        config.azure_devops?.manifest_repository.includes("azure.com")
      ) {
        const manifestUrlSplit = config.azure_devops?.manifest_repository.split(
          "/"
        );
        const manifestRepo: IRepository = new AzureDevOpsRepo(
          manifestUrlSplit[3],
          manifestUrlSplit[4],
          manifestUrlSplit[6],
          config.azure_devops.access_token
        );
        manifestRepo
          .getManifestSyncState()
          .then((syncCommits: ITag[]) => {
            resolve(syncCommits);
          })
          .catch(e => {
            reject(e);
          });
      } else if (
        config.azure_devops?.manifest_repository &&
        config.azure_devops?.manifest_repository.includes("github.com")
      ) {
        const manifestUrlSplit = config.azure_devops?.manifest_repository.split(
          "/"
        );
        const manifestRepo: IRepository = new GitHub(
          manifestUrlSplit[3],
          manifestUrlSplit[4],
          config.azure_devops.access_token
        );
        manifestRepo
          .getManifestSyncState()
          .then((syncCommits: ITag[]) => {
            resolve(syncCommits);
          })
          .catch(e => {
            reject(e);
          });
      } else {
        resolve();
      }
    } catch (err) {
      logger.error(err);
      reject(err);
    }
  });
};

/**
 * Initializes the pipelines assuming that the configuration has been loaded
 */
export const initialize = async (): Promise<IInitObject> => {
  const config = Config();
  const key = await config.introspection!.azure!.key;

  if (
    !key ||
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
    throw new Error(
      "You need to run `spk init` and `spk deployment onboard` to configure `spk."
    );
  }

  return {
    clusterPipeline: new AzureDevOpsPipeline(
      config.azure_devops.org,
      config.azure_devops.project,
      false,
      config.azure_devops.access_token
    ),
    config,
    hldPipeline: new AzureDevOpsPipeline(
      config.azure_devops.org,
      config.azure_devops.project,
      true,
      config.azure_devops.access_token
    ),
    key,
    srcPipeline: new AzureDevOpsPipeline(
      config.azure_devops.org,
      config.azure_devops.project,
      false,
      config.azure_devops.access_token
    )
  };
};

/**
 * Returns a list of deployments for the specified filters every 5 seconds
 *
 * @param initObject Initialization Object
 * @param values Validated values from commander
 */
export const watchGetDeployments = async (
  initObjects: IInitObject,
  values: IValidatedOptions
) => {
  const timeInterval = 5000;

  // Call get deployments once, and then set the timer.
  await getDeployments(initObjects, values);

  setInterval(async () => {
    await getDeployments(initObjects, values);
  }, timeInterval);
};

/**
 * Prints deployments in a terminal table
 * @param deployments list of deployments to print in terminal
 * @param outputFormat output format: normal | wide | json
 */
export const printDeployments = (
  deployments: Deployment[] | undefined,
  outputFormat: OUTPUT_FORMAT,
  limit?: number,
  syncStatuses?: ITag[] | undefined
): Table | undefined => {
  if (deployments && deployments.length > 0) {
    let header = [
      "Start Time",
      "Service",
      "Deployment",
      "Commit",
      "Src to ACR",
      "Image Tag",
      "Result",
      "ACR to HLD",
      "Env",
      "Hld Commit",
      "Result",
      "HLD to Manifest",
      "Result"
    ];
    if (outputFormat === OUTPUT_FORMAT.WIDE) {
      header = header.concat([
        "Duration",
        "Status",
        "Manifest Commit",
        "End Time"
      ]);
    }
    if (syncStatuses && syncStatuses.length > 0) {
      header = header.concat(["Cluster Sync"]);
    }

    // tslint:disable: object-literal-sort-keys
    const table = new Table({
      head: header,
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

    const toDisplay = limit ? deployments.slice(0, limit) : deployments;

    toDisplay.forEach(deployment => {
      const row = [];
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
      row.push(deployment.hldCommitId || "-");
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
        row.push(deployment.manifestCommitId || "-");
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
      if (syncStatuses && syncStatuses.length > 0) {
        const tag = getClusterSyncStatusForDeployment(deployment, syncStatuses);
        if (tag) {
          row.push(tag.name);
        } else {
          row.push("-");
        }
      }
      table.push(row);
    });

    // tslint:disable-next-line: no-console
    console.log(table.toString());
    return table;
  } else {
    logger.info("No deployments found for specified filters.");
    return undefined;
  }
};

/**
 * Returns a matching sync status for a deployment
 * @param deployment Deployment object
 * @param syncStatuses list of sync statuses for manifest
 */
export const getClusterSyncStatusForDeployment = (
  deployment: Deployment,
  syncStatuses: ITag[]
): ITag | undefined => {
  return syncStatuses.find(tag => tag.commit === deployment.manifestCommitId);
};

/**
 * Returns a status indicator icon
 *
 * @param status Status
 * @return a status indicator icon
 */
export const getStatus = (status: string) => {
  if (status === "succeeded") {
    return "\u2713";
  } else if (!status) {
    return "...";
  }
  return "\u0445";
};
