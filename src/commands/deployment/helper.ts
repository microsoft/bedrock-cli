import Table from "cli-table";
import * as fs from "fs";
import * as os from "os";
import Deployment from "spektate/lib/Deployment";
import AzureDevOpsPipeline from "spektate/lib/pipeline/AzureDevOpsPipeline";
import IPipeline from "spektate/lib/pipeline/Pipeline";
import { logger } from "../../logger";

let hldPipeline: IPipeline;
let clusterPipeline: IPipeline;
let srcPipeline: IPipeline;
const fileLocation = os.homedir() + "/.Spektate";
export let config: { [id: string]: string } = {};

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
 * Helper functions for `deployment` commands
 */
export class Helper {
  /**
   * Initializes the pipelines assuming that the configuration has been loaded
   */
  public static initializePipelines() {
    srcPipeline = new AzureDevOpsPipeline(
      config.AZURE_ORG,
      config.AZURE_PROJECT,
      false,
      config.AZURE_PIPELINE_ACCESS_TOKEN
    );
    hldPipeline = new AzureDevOpsPipeline(
      config.AZURE_ORG,
      config.AZURE_PROJECT,
      true,
      config.AZURE_PIPELINE_ACCESS_TOKEN
    );
    clusterPipeline = new AzureDevOpsPipeline(
      config.AZURE_ORG,
      config.AZURE_PROJECT,
      false,
      config.AZURE_PIPELINE_ACCESS_TOKEN
    );
  }

  /**
   * Performs verification of config values to make sure subsequent commands can be run
   */
  public static verifyAppConfiguration = async (callback?: () => void) => {
    if (
      config.STORAGE_TABLE_NAME === "" ||
      config.STORAGE_TABLE_NAME === undefined ||
      config.STORAGE_PARTITION_KEY === "" ||
      config.STORAGE_PARTITION_KEY === undefined ||
      config.STORAGE_ACCOUNT_NAME === "" ||
      config.STORAGE_ACCOUNT_NAME === undefined ||
      config.STORAGE_ACCOUNT_KEY === "" ||
      config.STORAGE_ACCOUNT_KEY === undefined ||
      config.AZURE_PROJECT === "" ||
      config.AZURE_PROJECT === undefined ||
      config.AZURE_ORG === "" ||
      config.AZURE_ORG === undefined
    ) {
      await Helper.configureAppFromFile(callback);
    } else {
      Helper.initializePipelines();
      if (callback) {
        callback();
      }
    }
  };

  /**
   * Loads configuration from a file
   */
  public static configureAppFromFile = async (callback?: () => void) => {
    await fs.readFile(fileLocation, "utf8", (error, data) => {
      if (error) {
        logger.error(error);
        throw error;
      }
      const array = data.split(/\r?\n/);
      array.forEach((row: string) => {
        const key = row.split(/=(.+)/)[0];
        const value = row.split(/=(.+)/)[1];
        config[key] = value;
      });
      Helper.initializePipelines();
      if (callback) {
        callback();
      }
    });
  };

  /**
   * Writes configuration to a file
   */
  public static writeConfigToFile = async (configMap: any) => {
    let data = "";
    Object.keys(configMap).forEach(key => {
      data += "\n" + key + "=" + configMap[key];
    });
    await fs.writeFile(fileLocation, data, (error: any) => {
      if (error) {
        logger.error(error);
      }
    });
  };

  /**
   * Gets a list of deployments for the specified filters
   */
  public static getDeployments = (
    outputFormat: OUTPUT_FORMAT,
    environment?: string,
    imageTag?: string,
    p1Id?: string,
    commitId?: string,
    service?: string,
    deploymentId?: string
  ): Promise<Deployment[]> => {
    return Deployment.getDeploymentsBasedOnFilters(
      config.STORAGE_ACCOUNT_NAME,
      config.STORAGE_ACCOUNT_KEY,
      config.STORAGE_TABLE_NAME,
      config.STORAGE_PARTITION_KEY,
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
        Helper.printDeployments(deployments, outputFormat);
      }
      return deployments;
    });
  };

  /**
   * Prints deployments in a terminal table
   */
  public static printDeployments = (
    deployments: Deployment[],
    outputFormat: OUTPUT_FORMAT
  ) => {
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
            ? Helper.getStatus(deployment.srcToDockerBuild.result)
            : ""
        );
        row.push(
          deployment.dockerToHldRelease ? deployment.dockerToHldRelease.id : ""
        );
        row.push(deployment.environment.toUpperCase());
        row.push(deployment.hldCommitId);
        row.push(
          deployment.dockerToHldRelease
            ? Helper.getStatus(deployment.dockerToHldRelease.status)
            : ""
        );
        row.push(
          deployment.hldToManifestBuild ? deployment.hldToManifestBuild.id : ""
        );
        row.push(
          deployment.hldToManifestBuild
            ? Helper.getStatus(deployment.hldToManifestBuild.result)
            : ""
        );
        if (outputFormat === OUTPUT_FORMAT.WIDE) {
          row.push(deployment.duration() + " mins");
          row.push(deployment.status());
          row.push(deployment.manifestCommitId);
          row.push(
            deployment.hldToManifestBuild &&
              deployment.hldToManifestBuild.finishTime &&
              !isNaN(deployment.hldToManifestBuild.finishTime.getTime())
              ? deployment.hldToManifestBuild.finishTime.toLocaleString()
              : ""
          );
        }
        table.push(row);
      });

      logger.info("\n" + table.toString());
    } else {
      logger.info("No deployments found for specified filters.");
    }
  };

  /**
   * Gets a status indicator icon
   */
  public static getStatus = (status: string) => {
    if (status === "succeeded") {
      return "\u2713";
    } else if (!status) {
      return "...";
    }
    return "\u0445";
  };

  public getModuleName = (): string => "Helper";
}
