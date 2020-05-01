import Table from "cli-table";
import commander from "commander";
import {
  duration,
  getDeploymentsBasedOnFilters,
  IDeployment,
  status as getDeploymentStatus,
  fetchPR,
  fetchAuthor,
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
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";
import { isIntegerString } from "../../lib/validator";
import { logger } from "../../logger";
import decorator from "./get.decorator.json";
import { IPullRequest } from "spektate/lib/repository/IPullRequest";
import { IAuthor } from "spektate/lib/repository/Author";
import {
  DeploymentRow,
  printDeploymentTable,
} from "../../lib/azure/deploymenttable";

const promises: Promise<void>[] = [];
const pullRequests: { [id: string]: IPullRequest } = {};
const authors: { [id: string]: IAuthor } = {};
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
  ring: string;
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
      throw buildError(errorStatusCode.VALIDATION_ERR, {
        errorKey: "introspect-get-cmd-err-validation-top-num",
        values: [opts.top],
      });
    }
  }

  return {
    buildId: opts.buildId,
    commitId: opts.commitId,
    deploymentId: opts.deploymentId,
    ring: opts.ring,
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
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "introspect-get-cmd-missing-vals"
    );
  }

  return {
    clusterPipeline: new AzureDevOpsPipeline(
      config.azure_devops.org,
      config.azure_devops.project,
      config.azure_devops.access_token
    ),
    hldPipeline: new AzureDevOpsPipeline(
      config.azure_devops.org,
      config.azure_devops.project,
      config.azure_devops.access_token
    ),
    key: config.introspection.azure.key,
    srcPipeline: new AzureDevOpsPipeline(
      config.azure_devops.org,
      config.azure_devops.project,
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
export const getClusterSyncStatuses = async (
  initObj: InitObject
): Promise<ITag[] | undefined> => {
  try {
    if (initObj.manifestRepo && initObj.manifestRepo.includes("azure.com")) {
      const manifestUrlSplit = initObj.manifestRepo.split("/");
      const manifestRepo: IAzureDevOpsRepo = {
        org: manifestUrlSplit[3],
        project: manifestUrlSplit[4],
        repo: manifestUrlSplit[6],
      };
      return await getAzureManifestSyncState(manifestRepo, initObj.accessToken);
    } else if (
      initObj.manifestRepo &&
      initObj.manifestRepo.includes("github.com")
    ) {
      const manifestUrlSplit = initObj.manifestRepo.split("/");
      const manifestRepo: IGitHub = {
        reponame: manifestUrlSplit[4],
        username: manifestUrlSplit[3],
      };

      return await getGithubManifestSyncState(
        manifestRepo,
        initObj.accessToken
      );
    } else {
      return undefined;
    }
  } catch (err) {
    throw buildError(
      errorStatusCode.GIT_OPS_ERR,
      "introspect-get-cmd-cluster-sync-stat-err",
      err
    );
  }
};

/**
 * Fetches author data for deployments
 *
 * @param deployment deployment for which author has to be fetched
 * @param initObj initialization object
 */
export const fetchAuthorInformation = async (
  deployment: IDeployment,
  initObj: InitObject
): Promise<void> => {
  let commitId =
    deployment.srcToDockerBuild?.sourceVersion ||
    deployment.hldToManifestBuild?.sourceVersion;
  let repo: IAzureDevOpsRepo | IGitHub | undefined =
    deployment.srcToDockerBuild?.repository ||
    deployment.hldToManifestBuild?.repository;
  if (!repo && deployment.sourceRepo) {
    repo = getRepositoryFromURL(deployment.sourceRepo);
    commitId = deployment.srcToDockerBuild?.sourceVersion;
  }
  if (!repo && deployment.hldRepo) {
    repo = getRepositoryFromURL(deployment.hldRepo);
    commitId = deployment.hldToManifestBuild?.sourceVersion;
  }
  if (repo && commitId !== "") {
    try {
      const author = await fetchAuthor(repo, commitId!, initObj.accessToken);
      if (author) {
        authors[deployment.deploymentId] = author;
      }
    } catch (err) {
      // verbose log, to make sure printed response from get command is scriptable
      logger.verbose(`Could not get author for ${commitId}: ` + err);
    }
  }
};

/**
 * Fetches pull request data for deployments that complete merge into HLD
 * by merging a PR
 *
 * @param deployment deployment for which PR has to be fetched
 * @param initObj initialization object
 */
export const fetchPRInformation = async (
  deployment: IDeployment,
  initObj: InitObject
): Promise<void> => {
  if (deployment.hldRepo && deployment.pr) {
    const repo = getRepositoryFromURL(deployment.hldRepo);
    const strPr = deployment.pr.toString();

    if (repo) {
      try {
        const pr = await fetchPR(repo, strPr, initObj.accessToken);
        if (pr) {
          pullRequests[deployment.deploymentId] = pr;
        }
      } catch (err) {
        // verbose log, to make sure printed response from get command is scriptable
        logger.verbose(`Could not get PR ${strPr} information: ` + err);
      }
    }
  }
};

/**
 * Gets author information for all the deployments.
 *
 * @param deployments all deployments to be displayed
 * @param initObj initialization object
 */
export const getAuthors = (
  deployments: IDeployment[] | undefined,
  initObj: InitObject
): void => {
  (deployments || []).forEach((d) => {
    promises.push(fetchAuthorInformation(d, initObj));
  });
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
  (deployments || []).forEach((d) => {
    promises.push(fetchPRInformation(d, initObj));
  });
};

/**
 * Returns a status indicator icon
 *
 * @param status Status
 * @return a status indicator icon
 */
export const getStatus = (status?: string): string => {
  if (!status) {
    return "";
  } else if (status === "succeeded") {
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
  const deploymentsToDisplay: DeploymentRow[] = [];
  if (deployments && deployments.length > 0) {
    const toDisplay = limit ? deployments.slice(0, limit) : deployments;

    toDisplay.forEach((deployment) => {
      const row = [];
      const deploymentToDisplay = {
        status: getDeploymentStatus(deployment),
        service: deployment.service,
        env: deployment.environment,
        author:
          deployment.deploymentId in authors
            ? authors[deployment.deploymentId].name
            : undefined,
        srctoAcrCommitId: deployment.commitId,
        srcToAcrPipelineId: deployment.srcToDockerBuild?.id,
        imageTag: deployment.imageTag,
        srcToAcrResult: getStatus(deployment.srcToDockerBuild?.result),
        AcrToHldPipelineId: deployment.dockerToHldRelease
          ? deployment.dockerToHldRelease.id
          : deployment.dockerToHldReleaseStage
          ? deployment.dockerToHldReleaseStage.id
          : undefined,
        AcrToHldResult: getStatus(
          deployment.dockerToHldRelease?.status ||
            deployment.dockerToHldReleaseStage?.result
        ),
        AcrToHldCommitId: deployment.hldCommitId,
        pr:
          deployment.deploymentId in pullRequests
            ? pullRequests[deployment.deploymentId].id.toString()
            : undefined,
        mergedBy:
          deployment.deploymentId in pullRequests
            ? pullRequests[deployment.deploymentId].mergedBy?.name
            : undefined,
        HldToManifestPipelineId: deployment.hldToManifestBuild?.id,
        HldToManifestResult: getStatus(deployment.hldToManifestBuild?.result),
        HldToManifestCommitId: deployment.manifestCommitId,
        duration: duration(deployment) + " mins",
        endTime:
          deployment.hldToManifestBuild?.finishTime &&
          !isNaN(new Date(deployment.hldToManifestBuild?.finishTime).getTime())
            ? deployment.hldToManifestBuild.finishTime.toLocaleString()
            : deployment.srcToDockerBuild?.finishTime &&
              !isNaN(new Date(deployment.srcToDockerBuild.finishTime).getTime())
            ? deployment.srcToDockerBuild.finishTime.toLocaleString()
            : undefined,
        syncStatus: syncStatuses
          ? getClusterSyncStatusForDeployment(deployment, syncStatuses)?.name
          : undefined,
      };
      if (deploymentToDisplay.pr && !deploymentToDisplay.mergedBy) {
        deploymentToDisplay.status = "Waiting";
      }

      deploymentsToDisplay.push(deploymentToDisplay);
    });

    return printDeploymentTable(outputFormat, deploymentsToDisplay);
  } else {
    logger.info("No deployments found for specified filters.");
    return undefined;
  }
};

// /**
//  * Prints deployments in a terminal table
//  * @param deployments list of deployments to print in terminal
//  * @param outputFormat output format: normal | wide | json
//  */
// export const printDeployments = (
//   deployments: IDeployment[] | undefined,
//   outputFormat: OUTPUT_FORMAT,
//   limit?: number,
//   syncStatuses?: ITag[] | undefined
// ): Table | undefined => {
//   if (deployments && deployments.length > 0) {
//     let header = [
//       "Status",
//       "Service",
//       "Ring",
//     ];

//     if (outputFormat === OUTPUT_FORMAT.WIDE) {
//       header = header.concat(["Author"]);
//     }

//     header = header.concat(["Commit",
//       "Src to ACR",
//       "Image Tag",
//       "Result",
//       "ACR to HLD",
//       "Hld Commit",
//       "Result"]);

//     let prsExist = false;
//     if (
//       Object.keys(pullRequests).length > 0 &&
//       outputFormat === OUTPUT_FORMAT.WIDE
//     ) {
//       header = header.concat(["Approval PR", "Merged By"]);
//       prsExist = true;
//     }
//     header = header.concat(["HLD to Manifest", "Result", "Duration"]);
//     if (outputFormat === OUTPUT_FORMAT.WIDE) {
//       header = header.concat([
//         "Manifest Commit",
//         "Start Time",
//         "End Time",
//       ]);
//     }
//     if (syncStatuses && syncStatuses.length > 0) {
//       header = header.concat(["Cluster Sync"]);
//     }

//     const table = new Table({
//       head: header,
//       chars: {
//         top: "",
//         "top-mid": "",
//         "top-left": "",
//         "top-right": "",
//         bottom: "",
//         "bottom-mid": "",
//         "bottom-left": "",
//         "bottom-right": "",
//         left: "",
//         "left-mid": "",
//         mid: "",
//         "mid-mid": "",
//         right: "",
//         "right-mid": "",
//         middle: " ",
//       },
//       style: { "padding-left": 0, "padding-right": 0 },
//     });

//     const toDisplay = limit ? deployments.slice(0, limit) : deployments;

//     toDisplay.forEach((deployment) => {
//       const row = [];
//       let deploymentStatus = getDeploymentStatus(deployment);
//       row.push(deploymentStatus);
//       row.push(deployment.service !== "" ? deployment.service : "-");
//       row.push(
//         deployment.environment !== ""
//           ? deployment.environment.toUpperCase()
//           : "-"
//       );
//       if (outputFormat === OUTPUT_FORMAT.WIDE) {
//         if (deployment.deploymentId in authors) {
//           row.push(authors[deployment.deploymentId].name);
//         } else {
//           row.push("-");
//         }
//       }
//       row.push(deployment.commitId !== "" ? deployment.commitId : "-");
//       row.push(
//         deployment.srcToDockerBuild ? deployment.srcToDockerBuild.id : "-"
//       );
//       row.push(deployment.imageTag !== "" ? deployment.imageTag : "-");
//       row.push(
//         deployment.srcToDockerBuild
//           ? getStatus(deployment.srcToDockerBuild.result)
//           : ""
//       );

//       let dockerToHldId = "-";
//       let dockerToHldStatus = "";

//       if (deployment.dockerToHldRelease) {
//         dockerToHldId = deployment.dockerToHldRelease.id;
//         dockerToHldStatus = getStatus(deployment.dockerToHldRelease.status);
//       } else if (
//         deployment.dockerToHldReleaseStage &&
//         deployment.srcToDockerBuild
//       ) {
//         dockerToHldId = deployment.dockerToHldReleaseStage.id;
//         dockerToHldStatus = getStatus(deployment.srcToDockerBuild.result);
//       }
//       row.push(dockerToHldId);

//       row.push(deployment.hldCommitId || "-");
//       row.push(dockerToHldStatus);

//       // Print PR if available
//       if (
//         prsExist &&
//         deployment.deploymentId in pullRequests
//       ) {
//         row.push(deployment.pr);
//         if (pullRequests[deployment.deploymentId].mergedBy) {
//           row.push(pullRequests[deployment.deploymentId].mergedBy?.name);
//         } else {
//           deploymentStatus = "Waiting";
//           row.push("-");
//         }
//       } else if (prsExist) {
//         row.push("-");
//         row.push("-");
//       }

//       row.push(
//         deployment.hldToManifestBuild ? deployment.hldToManifestBuild.id : "-"
//       );
//       row.push(
//         deployment.hldToManifestBuild
//           ? getStatus(deployment.hldToManifestBuild.result)
//           : ""
//       );
//       row.push(duration(deployment) + " mins");
//       if (outputFormat === OUTPUT_FORMAT.WIDE) {
//         row.push(deployment.manifestCommitId || "-");
//         row.push(
//           deployment.srcToDockerBuild
//             ? deployment.srcToDockerBuild.startTime.toLocaleString()
//             : deployment.hldToManifestBuild
//               ? deployment.hldToManifestBuild.startTime.toLocaleString()
//               : "-"
//         );
//         row.push(
//           deployment.hldToManifestBuild &&
//             deployment.hldToManifestBuild.finishTime &&
//             !isNaN(new Date(deployment.hldToManifestBuild.finishTime).getTime())
//             ? deployment.hldToManifestBuild.finishTime.toLocaleString()
//             : deployment.srcToDockerBuild &&
//               deployment.srcToDockerBuild.finishTime &&
//               !isNaN(new Date(deployment.srcToDockerBuild.finishTime).getTime())
//               ? deployment.srcToDockerBuild.finishTime.toLocaleString()
//               : "-"
//         );
//       }
//       if (syncStatuses && syncStatuses.length > 0) {
//         const tag = getClusterSyncStatusForDeployment(deployment, syncStatuses);
//         if (tag) {
//           row.push(tag.name);
//         } else {
//           row.push("-");
//         }
//       }
//       table.push(row);
//     });

//     console.log(table.toString());
//     return table;
//   } else {
//     logger.info("No deployments found for specified filters.");
//     return undefined;
//   }
// };

/**
 * Displays the deployments based on output format requested and top n
 * @param values validated command line values
 * @param deployments list of deployments to display
 * @param syncStatuses cluster sync statuses,
 * @param initObj initialization object
 */
export const displayDeployments = async (
  values: ValidatedOptions,
  deployments: IDeployment[] | undefined,
  syncStatuses: ITag[] | undefined,
  initObj: InitObject
): Promise<IDeployment[]> => {
  // Show authors and PRs only in wide output, to keep default narrow output fast and quick
  if (values.outputFormat === OUTPUT_FORMAT.WIDE) {
    getPRs(deployments, initObj);
    getAuthors(deployments, initObj);
  }

  if (values.outputFormat === OUTPUT_FORMAT.JSON) {
    console.log(JSON.stringify(deployments, null, 2));
    return deployments || [];
  }

  await Promise.all(promises);
  printDeployments(deployments, values.outputFormat, values.nTop, syncStatuses);
  return deployments || [];
};

/**
 * Gets a list of deployments for the specified filters
 * @param initObj captures keys and objects during the initialization process
 * @param values validated command line values
 */
export const getDeployments = async (
  initObj: InitObject,
  values: ValidatedOptions
): Promise<IDeployment[]> => {
  try {
    const syncStatusesPromise = getClusterSyncStatuses(initObj);
    const deploymentsPromise = getDeploymentsBasedOnFilters(
      initObj.accountName,
      initObj.key,
      initObj.tableName,
      initObj.partitionKey,
      initObj.srcPipeline,
      initObj.hldPipeline,
      initObj.clusterPipeline,
      values.ring,
      values.imageTag,
      values.buildId,
      values.commitId,
      values.service,
      values.deploymentId
    );

    const tuple: [
      IDeployment[] | undefined,
      ITag[] | undefined
    ] = await Promise.all([deploymentsPromise, syncStatusesPromise]);
    const deployments: IDeployment[] | undefined = tuple[0];
    const syncStatuses: ITag[] | undefined = tuple[1];

    return await displayDeployments(values, deployments, syncStatuses, initObj);
  } catch (err) {
    throw buildError(
      errorStatusCode.EXE_FLOW_ERR,
      "introspect-get-cmd-get-deployments-err",
      err
    );
  }
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
    logError(
      buildError(errorStatusCode.CMD_EXE_ERR, "introspect-get-cmd-failed", err)
    );
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
