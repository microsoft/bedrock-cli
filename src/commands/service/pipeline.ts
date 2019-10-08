import fs from "fs";
import yaml from "js-yaml";
import path from "path";

import commander = require("commander");
import { logger } from "../../logger";

import { IBuildApi } from "azure-devops-node-api/BuildApi";
import {
  createPipelineForDefinition,
  definitionForAzureRepoPipeline,
  getBuildApiClient,
  queueBuild
} from "../../lib/pipelines/pipelines";

import { BuildDefinition } from "azure-devops-node-api/interfaces/BuildInterfaces";

export const createPipelineCommandDecorator = (
  command: commander.Command
): void => {
  command
    .command("create-pipeline <service-name>")
    .alias("p")
    .description("Configure Azure DevOps for a bedrock managed service")
    .option(
      "-n, --pipeline-name <pipeline-name>",
      "Name of the pipeline to be created"
    )
    .option(
      "-p, --personal-access-token <personal-access-token>",
      "Personal Access Token"
    )
    .option("-o, --org-url <org-url>", "Organization URL for Azure DevOps")
    .option("-r, --repo-name <repo-name>", "Repository Name in Azure DevOps")
    .option("-u, --repo-url <repo-url>", "Repository URL")
    .option("-d, --devops-project <devops-project>", "Azure DevOps Project")
    .option("-l, --project-path <project-path>", "Path to Bedrock Project")
    .action(async (serviceName, opts) => {
      const {
        pipelineName,
        personalAccessToken,
        orgUrl,
        repoName,
        repoUrl,
        devopsProject,
        projectPath
      } = opts;

      try {
        if (typeof pipelineName !== "string") {
          throw new Error(
            `--pipeline-name must be of type 'string', ${typeof pipelineName} given.`
          );
        }

        if (typeof personalAccessToken !== "string") {
          throw new Error(
            `--personal-access-token must be of type 'string', ${typeof personalAccessToken} given.`
          );
        }

        if (typeof orgUrl !== "string") {
          throw new Error(
            `--org-url must be of type 'string', ${typeof orgUrl} given.`
          );
        }

        if (typeof repoName !== "string") {
          throw new Error(
            `--repo-name must be of type 'string', ${typeof repoName} given.`
          );
        }

        if (typeof repoUrl !== "string") {
          throw new Error(
            `--repo-url must be of type 'string', ${typeof repoUrl} given.`
          );
        }

        if (typeof devopsProject !== "string") {
          throw new Error(
            `--devops-project must be of type 'string', ${typeof devopsProject} given.`
          );
        }

        if (typeof projectPath !== "string") {
          throw new Error(
            `--project-path projectPath must be of type 'string', ${typeof projectPath} given.`
          );
        }
      } catch (err) {
        logger.error(`Error occurred validating inputs for ${serviceName}`);
        logger.error(err);
        process.exit(1);
      }

      try {
        await installPipeline(
          serviceName,
          orgUrl,
          personalAccessToken,
          pipelineName,
          repoName,
          repoUrl,
          devopsProject,
          process.exit
        );
      } catch (err) {
        logger.error(`Error occured installing pipeline for ${serviceName}`);
        logger.error(err);
        process.exit(1);
      }
    });
};

/**
 *
 * @param serviceName
 * @param orgUrl
 * @param personalAccessToken
 * @param pipelineName
 * @param repoName
 * @param repoUrl
 * @param project
 * @param projectPath
 */
export const installPipeline = async (
  serviceName: string,
  orgUrl: string,
  personalAccessToken: string,
  pipelineName: string,
  repoName: string,
  repoUrl: string,
  project: string,
  exitFn: (status: number) => void
) => {
  let devopsClient;
  let builtDefinition;

  try {
    devopsClient = await getBuildApiClient(orgUrl, personalAccessToken);
    logger.info("Fetched DevOps Client");
    logger.info(devopsClient!);
  } catch (err) {
    logger.error(err);
    return exitFn(1);
  }

  const definition = definitionForAzureRepoPipeline({
    branchFilters: ["master"],
    maximumConcurrentBuilds: 1,
    /* tslint:disable-next-line object-literal-shorthand */
    pipelineName: pipelineName,
    repositoryName: repoName,
    repositoryUrl: repoUrl,
    yamlFileBranch: "master",
    yamlFilePath: `packages/${serviceName}/azure-pipelines.yaml`
  });

  try {
    builtDefinition = await createPipelineForDefinition(
      devopsClient as IBuildApi,
      project,
      definition
    );
  } catch (err) {
    logger.error(`Error occurred during pipeline creation for ${pipelineName}`);
    logger.error(err);
    return exitFn(1);
  }

  logger.info(`Created pipeline for ${pipelineName}`);
  logger.info(builtDefinition as BuildDefinition);
  logger.info(`Pipeline ID: ${(builtDefinition as BuildDefinition).id}`);

  try {
    await queueBuild(
      devopsClient as IBuildApi,
      project,
      (builtDefinition as BuildDefinition).id as number
    );
  } catch (err) {
    logger.error(`Error occurred when queueing build for ${pipelineName}`);
    logger.error(err);
    return exitFn(1);
  }
};
