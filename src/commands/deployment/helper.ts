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
export enum OUTPUT_FORMAT {
  NORMAL = 0,
  WIDE = 1,
  JSON = 2
}

export class Helper {
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

  public static verifyAppConfiguration = (callback?: () => void) => {
    if (
      config.STORAGE_TABLE_NAME === "" ||
      config.STORAGE_TABLE_NAME === undefined ||
      config.STORAGE_PARTITION_KEY === "" ||
      config.STORAGE_PARTITION_KEY === undefined ||
      config.STORAGE_ACCOUNT_NAME === "" ||
      config.STORAGE_ACCOUNT_NAME === undefined ||
      config.STORAGE_ACCOUNT_KEY === "" ||
      config.STORAGE_ACCOUNT_KEY === undefined ||
      config.GITHUB_MANIFEST_USERNAME === "" ||
      config.GITHUB_MANIFEST_USERNAME === undefined ||
      config.MANIFEST === "" ||
      config.MANIFEST === undefined ||
      config.AZURE_PROJECT === "" ||
      config.AZURE_PROJECT === undefined ||
      config.AZURE_ORG === "" ||
      config.AZURE_ORG === undefined
    ) {
      Helper.configureAppFromFile(callback);
    } else {
      Helper.initializePipelines();
      if (callback) {
        callback();
      }
    }
  };

  public static configureAppFromFile = (callback?: () => void) => {
    fs.readFile(fileLocation, (error, data) => {
      if (error) {
        logger.error(error);
      }
      const array = data.toString().split("\n");
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

  public static writeConfigToFile = (configMap: any) => {
    let data = "";
    Object.keys(configMap).forEach(key => {
      data += "\n" + key + "=" + configMap[key];
    });
    fs.writeFile(fileLocation, data, (error: any) => {
      if (error) {
        logger.error(error);
      }
    });
  };

  public static getDeployments = (
    outputFormat: OUTPUT_FORMAT,
    environment?: string,
    imageTag?: string,
    p1Id?: string,
    commitId?: string,
    service?: string
  ) => {
    Deployment.getDeploymentsBasedOnFilters(
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
      (deployments: Deployment[]) => {
        if (outputFormat === OUTPUT_FORMAT.JSON) {
          logger.info(JSON.stringify(deployments));
        } else {
          Helper.printDeployments(deployments, outputFormat);
        }
      }
    );
  };

  public static printDeployments = (
    deployments: Deployment[],
    outputFormat: OUTPUT_FORMAT
  ) => {
    if (deployments.length > 0) {
      let row = [];
      row.push("Start Time");
      row.push("Service");
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
      const table = new Table({ head: row });
      deployments.forEach(deployment => {
        row = [];
        row.push(
          deployment.srcToDockerBuild
            ? deployment.srcToDockerBuild.startTime.toLocaleString()
            : ""
        );
        row.push(deployment.service);
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

      logger.info(table.toString());
    } else {
      logger.info("No deployments found for specified filters.");
    }
  };

  public static getStatus = (status: string) => {
    if (status === "succeeded") {
      return "\u2713";
    } else if (!status) {
      return "...";
    }
    return "\u0445";
  };
}
