import Table from "cli-table";
import commander from "commander";
import {
  duration,
  getDeploymentsBasedOnFilters,
  IDeployment,
  status as getDeploymentStatus,
  fetchPR,
  getRepositoryFromURL,
} from "spektate/lib/IDeployment";
import AzureDevOpsPipeline from "spektate/lib/pipeline/AzureDevOpsPipeline";
import {
  getManifestSyncState as getAzureManifestSyncState,
  IAzureDevOpsRepo,
} from "spektate/lib/repository/IAzureDevOpsRepo";
import {
  getManifestSyncState as getGithubManifestSyncState,
  IGitHub,
} from "spektate/lib/repository/IGitHub";
import { ITag } from "spektate/lib/repository/Tag";
import { Config } from "../../config";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { isIntegerString } from "../../lib/validator";
import { logger } from "../../logger";
import decorator from "./get.decorator.json";
import { IPullRequest } from "spektate/lib/repository/IPullRequest";

const promises: Promise<IPullRequest | undefined>[] = [];
const pullRequests: { [id: string]: IPullRequest } = {};
/**
 * Output formats to display service details
 */
export enum OUTPUT_FORMAT {
  NORMAL = 0, // normal format
  WIDE = 1, // Wide table format
  JSON = 2,
}

/**
 * Interface for capturing all the
 * objects and key during the initialization
 * process
 */
export interface InitObject {
  accountName: string;
  tableName: string;
  partitionKey: string;
  clusterPipeline: AzureDevOpsPipeline;
  hldPipeline: AzureDevOpsPipeline;
  key: string;
  srcPipeline: AzureDevOpsPipeline;
  manifestRepo?: string;
  accessToken?: string;
}

/**
 * Command Line values from the commander
 */
export interface CommandOptions {
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
export interface ValidatedOptions extends CommandOptions {
  nTop: number;
  outputFormat: OUTPUT_FORMAT;
}

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
 * Validating the options values from commander.
 *
 * @param opts options values from commander
 * @return validated values
 * @throws Error if opts.top is not a positive integer
 */
export const validateValues = (opts: CommandOptions): ValidatedOptions => {
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
    watch: opts.watch,
  };
};

/**
 * Initializes the pipelines assuming that the configuration has been loaded
 */
export const initialize = async (): Promise<InitObject> => {
  const config = Config();

  if (
    !config.introspection ||
    !config.azure_devops ||
    !config.introspection.azure ||
    !config.azure_devops.org ||
    !config.azure_devops.project ||
    !config.introspection.azure.account_name ||
    !config.introspection.azure.table_name ||
    !config.introspection.azure.key ||
    !config.introspection.azure.partition_key ||
    !config.introspection.azure.key
  ) {
    throw Error(
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
    hldPipeline: new AzureDevOpsPipeline(
      config.azure_devops.org,
      config.azure_devops.project,
      true,
      config.azure_devops.access_token
    ),
    key: config.introspection.azure.key,
    srcPipeline: new AzureDevOpsPipeline(
      config.azure_devops.org,
      config.azure_devops.project,
      false,
      config.azure_devops.access_token
    ),
    accountName: config.introspection.azure.account_name,
    tableName: config.introspection.azure.table_name,
    partitionKey: config.introspection.azure.partition_key,
    manifestRepo: config.azure_devops.manifest_repository,
    accessToken: config.azure_devops.access_token,
  };
};

/**
 * Gets cluster sync statuses
 * @param initObj captures keys and objects during the initialization process
 */
export const getClusterSyncStatuses = (
  initObj: InitObject
): Promise<ITag[] | undefined> => {
  return new Promise((resolve, reject) => {
    try {
      if (initObj.manifestRepo && initObj.manifestRepo.includes("azure.com")) {
        const manifestUrlSplit = initObj.manifestRepo.split("/");
        const manifestRepo: IAzureDevOpsRepo = {
          org: manifestUrlSplit[3],
          project: manifestUrlSplit[4],
          repo: manifestUrlSplit[6],
        };
        getAzureManifestSyncState(manifestRepo, initObj.accessToken)
          .then((syncCommits: ITag[]) => {
            resolve(syncCommits);
          })
          .catch((e) => {
            reject(e);
          });
      } else if (
        initObj.manifestRepo &&
        initObj.manifestRepo.includes("github.com")
      ) {
        const manifestUrlSplit = initObj.manifestRepo.split("/");
        const manifestRepo: IGitHub = {
          reponame: manifestUrlSplit[4],
          username: manifestUrlSplit[3],
        };

        getGithubManifestSyncState(manifestRepo, initObj.accessToken)
          .then((syncCommits: ITag[]) => {
            resolve(syncCommits);
          })
          .catch((e) => {
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
 * Fetches pull request data for deployments that complete merge into HLD
 * by merging a PR
 *
 * @param deployment deployment for which PR has to be fetched
 * @param initObj initialization object
 */
export const fetchPRInformation = (
  deployment: IDeployment,
  initObj: InitObject
): void => {
  if (deployment.hldRepo && deployment.pr) {
    const repo = getRepositoryFromURL(deployment.hldRepo);
    const strPr = deployment.pr.toString();

    if (repo) {
      const promise = fetchPR(repo, strPr, initObj.accessToken);
      promise.then((pr) => {
        if (pr) {
          pullRequests[strPr] = pr;
        }
      });
      promises.push(promise);
    }
  }
};

/**
 * Gets PR information for all the deployments.
 *
 * @param deployments all deployments to be displayed
 * @param initObj initialization object
 */
export const getPRs = (
  deployments: IDeployment[] | undefined,
  initObj: InitObject
): void => {
  (deployments || []).forEach((d) => fetchPRInformation(d, initObj));
};

/**
 * Returns a status indicator icon
 *
 * @param status Status
 * @return a status indicator icon
 */
export const getStatus = (status: string): string => {
  if (status === "succeeded") {
    return "\u2713";
  } else if (!status) {
    return "...";
  }
  return "\u0445";
};

/**
 * Returns a matching sync status for a deployment
 * @param deployment Deployment object
 * @param syncStatuses list of sync statuses for manifest
 */
export const getClusterSyncStatusForDeployment = (
  deployment: IDeployment,
  syncStatuses: ITag[]
): ITag | undefined => {
  return syncStatuses.find((tag) => tag.commit === deployment.manifestCommitId);
};

/**
 * Prints deployments in a terminal table
 * @param deployments list of deployments to print in terminal
 * @param outputFormat output format: normal | wide | json
 */
export const printDeployments = (
  deployments: IDeployment[] | undefined,
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
    ];
    let prsExist = false;
    if (
      Object.keys(pullRequests).length > 0 &&
      outputFormat === OUTPUT_FORMAT.WIDE
    ) {
      header = header.concat(["Approval PR", "Merged By"]);
      prsExist = true;
    }
    header = header.concat(["HLD to Manifest", "Result"]);
    if (outputFormat === OUTPUT_FORMAT.WIDE) {
      header = header.concat([
        "Duration",
        "Status",
        "Manifest Commit",
        "End Time",
      ]);
    }
    if (syncStatuses && syncStatuses.length > 0) {
      header = header.concat(["Cluster Sync"]);
    }

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
        middle: " ",
      },
      style: { "padding-left": 0, "padding-right": 0 },
    });

    const toDisplay = limit ? deployments.slice(0, limit) : deployments;

    toDisplay.forEach((deployment) => {
      const row = [];
      let deploymentStatus = getDeploymentStatus(deployment);
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
      } else if (
        deployment.dockerToHldReleaseStage &&
        deployment.srcToDockerBuild
      ) {
        dockerToHldId = deployment.dockerToHldReleaseStage.id;
        dockerToHldStatus = getStatus(deployment.srcToDockerBuild.result);
      }
      row.push(dockerToHldId);

      row.push(
        deployment.environment !== ""
          ? deployment.environment.toUpperCase()
          : "-"
      );
      row.push(deployment.hldCommitId || "-");
      row.push(dockerToHldStatus);

      // Print PR if available
      if (
        prsExist &&
        deployment.pr &&
        deployment.pr.toString() in pullRequests
      ) {
        row.push(deployment.pr);
        if (pullRequests[deployment.pr.toString()].mergedBy) {
          row.push(pullRequests[deployment.pr.toString()].mergedBy?.name);
        } else {
          deploymentStatus = "Waiting";
          row.push("-");
        }
      } else if (prsExist) {
        row.push("-");
        row.push("-");
      }

      row.push(
        deployment.hldToManifestBuild ? deployment.hldToManifestBuild.id : "-"
      );
      row.push(
        deployment.hldToManifestBuild
          ? getStatus(deployment.hldToManifestBuild.result)
          : ""
      );
      if (outputFormat === OUTPUT_FORMAT.WIDE) {
        row.push(duration(deployment) + " mins");
        row.push(deploymentStatus);
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

    console.log(table.toString());
    return table;
  } else {
    logger.info("No deployments found for specified filters.");
    return undefined;
  }
};

/**
 * Displays the deployments based on output format requested and top n
 * @param values validated command line values
 * @param deployments list of deployments to display
 * @param syncStatuses cluster sync statuses,
 * @param initObj initialization object
 */
export const displayDeployments = (
  values: ValidatedOptions,
  deployments: IDeployment[] | undefined,
  syncStatuses: ITag[] | undefined,
  initObj: InitObject
): Promise<IDeployment[]> => {
  return new Promise((resolve, reject) => {
    if (values.outputFormat === OUTPUT_FORMAT.WIDE) {
      getPRs(deployments, initObj);
    }
    if (values.outputFormat === OUTPUT_FORMAT.JSON) {
      console.log(JSON.stringify(deployments, null, 2));
      resolve(deployments);
    } else {
      Promise.all(promises)
        .then(() => {
          printDeployments(
            deployments,
            values.outputFormat,
            values.nTop,
            syncStatuses
          );
          resolve(deployments);
        })
        .catch((e) => {
          reject(e);
        });
    }
  });
};

/**
 * Gets a list of deployments for the specified filters
 * @param initObj captures keys and objects during the initialization process
 * @param values validated command line values
 */
export const getDeployments = (
  initObj: InitObject,
  values: ValidatedOptions
): Promise<IDeployment[]> => {
  const syncStatusesPromise = getClusterSyncStatuses(initObj);
  const deploymentsPromise = getDeploymentsBasedOnFilters(
    initObj.accountName,
    initObj.key,
    initObj.tableName,
    initObj.partitionKey,
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
      .then(async (tuple: [IDeployment[] | undefined, ITag[] | undefined]) => {
        const deployments: IDeployment[] | undefined = tuple[0];
        const syncStatuses: ITag[] | undefined = tuple[1];
        const displayedDeployments = await displayDeployments(
          values,
          deployments,
          syncStatuses,
          initObj
        );
        resolve(displayedDeployments);
      })
      .catch((e) => {
        reject(new Error(e));
      });
  });
};

/**
 * Returns a list of deployments for the specified filters every 5 seconds
 *
 * @param initObject Initialization Object
 * @param values Validated values from commander
 */
export const watchGetDeployments = async (
  initObjects: InitObject,
  values: ValidatedOptions
): Promise<void> => {
  const timeInterval = 5000;

  // Call get deployments once, and then set the timer.
  await getDeployments(initObjects, values);

  setInterval(async () => {
    await getDeployments(initObjects, values);
  }, timeInterval);
};

/**
 * Executes the command, can all exit function with 0 or 1
 * when command completed successfully or failed respectively.
 *
 * @param opts validated option values
 * @param exitFn exit function
 */
export const execute = async (
  opts: CommandOptions,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
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
  buildCmd(command, decorator).action(async (opts: CommandOptions) => {
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
