import commander from "commander";

import { IBuildApi } from "azure-devops-node-api/BuildApi";
import { logger } from "../../logger";

import { config, loadConfiguration } from "../init";

import {
  createPipelineForDefinition,
  definitionForAzureRepoPipeline,
  getBuildApiClient,
  IAzureRepoPipelineConfig,
  queueBuild
} from "../../lib/pipelines/pipelines";

import {
  BuildDefinition,
  BuildDefinitionVariable
} from "azure-devops-node-api/interfaces/BuildInterfaces";

export const installHldToManifestPipelineDecorator = (
  command: commander.Command
): void => {
  command
    .command("install-manifest-pipeline")
    .alias("m")
    .description(
      "Install the manifest generation pipeline to your Azure DevOps instance"
    )
    .action(async () => {
      loadConfiguration();

      if (!config) {
        logger.error("Config failed to load");
        process.exit(1);
        return;
      }

      if (!config.azure_devops) {
        logger.error("Azure DevOps config section not found");
        process.exit(1);
        return;
      }

      const orgUrl = config.azure_devops.org!;
      const pat = config.azure_devops.access_token!;
      const hldRepo = config.azure_devops.manifest_repository!;
      const project = config.azure_devops.project!;
      const manifestRepo = config.azure_devops.manifest_repository!;
      const hldRepoName = "HLD";

      if (!orgUrl || !pat || !hldRepo || !project || !manifestRepo) {
        logger.error("Azure DevOps config section not complete ");
        process.exit(1);
        return;
      }

      try {
        await installHldToManifestPipeline(
          orgUrl,
          pat,
          hldRepoName,
          hldRepo,
          manifestRepo,
          project,
          process.exit
        );
      } catch (err) {
        logger.error(
          `Error occured installing pipeline for HLD to Manifest pipeline`
        );
        logger.error(err);
        process.exit(1);
      }
    });
};

/**
 * Install a HLD to Manifest pipeline. The Azure Pipelines yaml should
 * be merged into the HLD repository before this function is to be invoked.
 * @param orgUrl URL to the Azure DevOps organization that you are using.
 * @param personalAccessToken Personal Access token with access to the HLD repository and materialized manifest repository.
 * @param hldRepoName Name of the HLD repository
 * @param hldRepoUrl URL to the HLD repository
 * @param manifestRepoUrl URL to the materialized manifest repository
 * @param project Azure DevOps project that the HLD and Materialized manifest repository is in
 */
export const installHldToManifestPipeline = async (
  orgUrl: string,
  personalAccessToken: string,
  hldRepoName: string,
  hldRepoUrl: string,
  manifestRepoUrl: string,
  project: string,
  exitFn: (status: number) => void
) => {
  let devopsClient;
  let builtDefinition;
  const pipelineName = "HLD to Manifest";

  try {
    devopsClient = await getBuildApiClient(orgUrl, personalAccessToken);
    logger.info("Fetched DevOps Client");
  } catch (err) {
    logger.error(err);
    return exitFn(1);
  }

  const definition = definitionForAzureRepoPipeline({
    branchFilters: ["master"],
    maximumConcurrentBuilds: 1,
    /* tslint:disable-next-line object-literal-shorthand */
    pipelineName: pipelineName,
    repositoryName: hldRepoName,
    repositoryUrl: hldRepoUrl,
    variables: requiredPipelineVariables(personalAccessToken, manifestRepoUrl),
    yamlFileBranch: "master",
    yamlFilePath: `azure-pipelines.yaml`
  } as IAzureRepoPipelineConfig);

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

/**
 * Builds and returns variables required for the HLD to Manifest pipeline.
 * @param accessToken Access token with access to the manifest repository.
 * @param manifestRepoUrl URL to the materialized manifest repository.
 * @returns Object containing the necessary run-time variables for the HLD to Manifest repository.
 */
export const requiredPipelineVariables = (
  accessToken: string,
  manifestRepoUrl: string
): { [key: string]: BuildDefinitionVariable } => {
  return {
    ACCESS_TOKEN_SECRET: {
      allowOverride: true,
      isSecret: true,
      value: accessToken
    },
    REPO: {
      allowOverride: true,
      isSecret: false,
      value: manifestRepoUrl
    }
  };
};
