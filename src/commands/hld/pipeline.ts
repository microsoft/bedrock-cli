import { IBuildApi } from "azure-devops-node-api/BuildApi";
import {
  BuildDefinition,
  BuildDefinitionVariable
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import commander from "commander";
import { Config } from "../../config";
import { BUILD_SCRIPT_URL } from "../../lib/constants";
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
    .alias("p")
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
    .option(
      "-b, --build-script <build-script-url>",
      `Build Script URL. By default it is '${BUILD_SCRIPT_URL}'.`
    )
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
        pipelineName = hldName + "-to-" + manifestRepoName,
        buildScriptUrl = BUILD_SCRIPT_URL
      } = opts;

      if (
        !isValidConfig(
          orgName,
          devopsProject,
          pipelineName,
          manifestUrl,
          hldName,
          hldUrl,
          buildScriptUrl,
          personalAccessToken
        )
      ) {
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
          buildScriptUrl,
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
 * @param pipelineName Name of this build pipeline in AzDo
 * @param buildScriptUrl Build Script URL
 */
export const installHldToManifestPipeline = async (
  orgName: string,
  personalAccessToken: string,
  hldRepoName: string,
  hldRepoUrl: string,
  manifestRepoUrl: string,
  project: string,
  pipelineName: string,
  buildScriptUrl: string,
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
    variables: requiredPipelineVariables(
      personalAccessToken,
      buildScriptUrl,
      manifestRepoUrl
    ),
    yamlFileBranch: "master",
    yamlFilePath: `manifest-generation.yaml`
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
 * Validates the pipeline configuration
 * @param orgName URL to the Azure DevOps organization that you are using.
 * @param devopsProject Name of the devops project
 * @param pipelineName Name of this build pipeline in AzDo
 * @param manifestUrl URL of the manifest
 * @param hldName Name of the HLD
 * @param hldUrl  URL of the HLD
 * @param buildScriptUrl Build Script URL
 * @param personalAccessToken Personal Access token with access to the HLD repository and materialized manifest repository.
 */
export const isValidConfig = (
  orgName: any,
  devopsProject: any,
  pipelineName: any,
  manifestUrl: any,
  hldName: any,
  hldUrl: any,
  buildScriptUrl: any,
  personalAccessToken: any
): boolean => {
  const missingConfig = [];

  logger.debug(`orgName: ${orgName}`);
  logger.debug(`personalAccessToken: XXXXXXXXXXXXXXXXX`);
  logger.debug(`devopsProject: ${devopsProject}`);
  logger.debug(`pipelineName: ${pipelineName}`);
  logger.debug(`manifestUrl: ${manifestUrl}`);
  logger.debug(`hldName: ${hldName}`);
  logger.debug(`hldUrl: ${hldUrl}`);
  logger.debug(`buildScriptUrl: ${buildScriptUrl}`);

  if (typeof pipelineName !== "string") {
    missingConfig.push(
      `--pipeline-name must be of type 'string', ${typeof pipelineName} given.`
    );
  }

  if (typeof personalAccessToken !== "string") {
    missingConfig.push(
      `--personal-access-token must be of type 'string', ${typeof personalAccessToken} given.`
    );
  }

  if (typeof orgName !== "string") {
    missingConfig.push(
      `--org-url must be of type 'string', ${typeof orgName} given.`
    );
  }

  if (typeof hldName !== "string") {
    missingConfig.push(
      `--hld-name must be of type 'string', ${typeof hldName} given.`
    );
  }

  if (typeof hldUrl !== "string") {
    missingConfig.push(
      `--hld-url must be of type 'string', ${typeof hldUrl} given.`
    );
  }

  if (typeof manifestUrl !== "string") {
    missingConfig.push(
      `--manifest-url must be of type 'string', ${typeof manifestUrl} given.`
    );
  }

  if (typeof devopsProject !== "string") {
    missingConfig.push(
      `--devops-project must be of type 'string', ${typeof devopsProject} given.`
    );
  }
  if (typeof buildScriptUrl !== "string") {
    missingConfig.push(
      `--build-script must be of type 'string', ${typeof buildScriptUrl} given.`
    );
  }

  if (missingConfig.length > 0) {
    logger.error("Error in configuration: " + missingConfig.join(" "));
    return false;
  }

  return true;
};

/**
 * Builds and returns variables required for the HLD to Manifest pipeline.
 * @param accessToken Access token with access to the manifest repository.
 * @param buildScriptUrl Build Script URL
 * @param manifestRepoUrl URL to the materialized manifest repository.
 * @returns Object containing the necessary run-time variables for the HLD to Manifest pipeline.
 */
export const requiredPipelineVariables = (
  accessToken: string,
  buildScriptUrl: string,
  manifestRepoUrl: string
): { [key: string]: BuildDefinitionVariable } => {
  return {
    BUILD_SCRIPT_URL: {
      allowOverride: true,
      isSecret: false,
      value: buildScriptUrl
    },
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
