import { IBuildApi } from "azure-devops-node-api/BuildApi";
import {
  BuildDefinition,
  BuildDefinitionVariable
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import commander from "commander";
import { Config } from "../../config";
import { getRepositoryName } from "../../lib/gitutils";
import {
  createPipelineForDefinition,
  definitionForAzureRepoPipeline,
  getBuildApiClient,
  IAzureRepoPipelineConfig,
  queueBuild
} from "../../lib/pipelines/pipelines";
import { logger } from "../../logger";

export const installHldToManifestPipelineDecorator = (
  command: commander.Command
): void => {
  command
    .command("install-manifest-pipeline")
    .alias("m")
    .description(
      "Install the manifest generation pipeline to your Azure DevOps instance. Default values are set in spk-config.yaml and can be loaded via spk init or overriden via option flags."
    )
    .option(
      "-n, --pipeline-name <pipeline-name>",
      "Name of the pipeline to be created"
    )
    .option(
      "-p, --personal-access-token <personal-access-token>",
      "Personal Access Token"
    )
    .option("-o, --org-name <org-name>", "Organization Name for Azure DevOps")
    .option("-r, --hld-name <hld-name>", "HLD Repository Name in Azure DevOps")
    .option("-u, --hld-url <hld-url>", "HLD Repository URL")
    .option("-m, --manifest-url <manifest-url>", "Manifest Repository URL")
    .option("-d, --devops-project <devops-project>", "Azure DevOps Project")
    .action(async opts => {
      const { azure_devops } = Config();

      const {
        hldUrl = azure_devops && azure_devops.hld_repository,
        manifestUrl = azure_devops && azure_devops.manifest_repository
      } = opts;

      const manifestRepoName = getRepositoryName(manifestUrl);

      const {
        orgName = azure_devops && azure_devops.org,
        personalAccessToken = azure_devops && azure_devops.access_token,
        devopsProject = azure_devops && azure_devops.project,
        hldName = getRepositoryName(hldUrl),
        pipelineName = hldName + "-to-" + manifestRepoName
      } = opts;

      logger.debug(`orgName: ${orgName}`);
      logger.debug(`personalAccessToken: XXXXXXXXXXXXXXXXX`);
      logger.debug(`devopsProject: ${devopsProject}`);
      logger.debug(`pipelineName: ${pipelineName}`);
      logger.debug(`manifestUrl: ${manifestUrl}`);
      logger.debug(`hldName: ${hldName}`);
      logger.debug(`hldUrl: ${hldUrl}`);

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

        if (typeof orgName !== "string") {
          throw new Error(
            `--org-url must be of type 'string', ${typeof orgName} given.`
          );
        }

        if (typeof hldName !== "string") {
          throw new Error(
            `--hld-name must be of type 'string', ${typeof hldName} given.`
          );
        }

        if (typeof hldUrl !== "string") {
          throw new Error(
            `--hld-url must be of type 'string', ${typeof hldUrl} given.`
          );
        }

        if (typeof manifestUrl !== "string") {
          throw new Error(
            `--manifest-url must be of type 'string', ${typeof manifestUrl} given.`
          );
        }

        if (typeof devopsProject !== "string") {
          throw new Error(
            `--devops-project must be of type 'string', ${typeof devopsProject} given.`
          );
        }
      } catch (err) {
        logger.error(
          `Error occurred validating inputs for hld install-manifest-pipeline`
        );
        logger.error(err);
        process.exit(1);
      }

      try {
        await installHldToManifestPipeline(
          orgName,
          personalAccessToken,
          hldName,
          hldUrl,
          manifestUrl,
          devopsProject,
          pipelineName,
          process.exit
        );
      } catch (err) {
        logger.error(
          `Error occurred installing pipeline for HLD to Manifest pipeline`
        );
        logger.error(err);
        process.exit(1);
      }
    });
};

/**
 * Install a HLD to Manifest pipeline. The Azure Pipelines yaml should
 * be merged into the HLD repository before this function is to be invoked.
 * @param orgName URL to the Azure DevOps organization that you are using.
 * @param personalAccessToken Personal Access token with access to the HLD repository and materialized manifest repository.
 * @param hldRepoName Name of the HLD repository
 * @param hldRepoUrl URL to the HLD repository
 * @param manifestRepoUrl URL to the materialized manifest repository
 * @param project Azure DevOps project that the HLD and Materialized manifest repository is in
 */
export const installHldToManifestPipeline = async (
  orgName: string,
  personalAccessToken: string,
  hldRepoName: string,
  hldRepoUrl: string,
  manifestRepoUrl: string,
  project: string,
  pipelineName: string,
  exitFn: (status: number) => void
) => {
  let devopsClient;
  let builtDefinition;

  try {
    devopsClient = await getBuildApiClient(orgName, personalAccessToken);
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
    yamlFilePath: `manifest-generation.yaml`
  } as IAzureRepoPipelineConfig);

  logger.info(`pipelineDefinition: ${JSON.stringify(definition)}`); // TODO REMOVE THIS -----------------------------------------------------

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
    MANIFEST_REPO: {
      allowOverride: true,
      isSecret: false,
      value: manifestRepoUrl
    },
    PAT: {
      allowOverride: true,
      isSecret: true,
      value: accessToken
    }
  };
};
