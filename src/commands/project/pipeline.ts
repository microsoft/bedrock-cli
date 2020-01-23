import { IBuildApi } from "azure-devops-node-api/BuildApi";
import { BuildDefinition } from "azure-devops-node-api/interfaces/BuildInterfaces";
import commander from "commander";
import { Config } from "../../config";
import { BUILD_SCRIPT_URL } from "../../lib/constants";
import {
  getOriginUrl,
  getRepositoryName,
  getRepositoryUrl
} from "../../lib/gitutils";
import {
  createPipelineForDefinition,
  definitionForAzureRepoPipeline,
  getBuildApiClient,
  queueBuild
} from "../../lib/pipelines/pipelines";
import { logger } from "../../logger";
import { isBedrockFileExists } from "././create-variable-group";

export const deployLifecyclePipelineCommandDecorator = (
  command: commander.Command
): void => {
  command
    .command("install-lifecycle-pipeline")
    .alias("p")
    .description(
      "Install the hld lifecycle pipeline to your Azure DevOps instance"
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
    .option("-r, --repo-name <repo-name>", "Repository Name in Azure DevOps")
    .option("-u, --repo-url <repo-url>", "Repository URL")
    .option("-e, --hld-url <hld-url>", "HLD Repository URL")
    .option("-d, --devops-project <devops-project>", "Azure DevOps Project")
    .option(
      "-b, --build-script <build-script-url>",
      `Build Script URL. By default it is '${BUILD_SCRIPT_URL}'.`
    )
    .action(async opts => {
      const projectPath = process.cwd();
      logger.verbose(`project path: ${projectPath}`);

      if ((await isBedrockFileExists(projectPath)) === false) {
        logger.error(
          "Please run `spk project init` command before running this command to initialize the project."
        );
        return;
      }

      const gitOriginUrl = await getOriginUrl();
      const { azure_devops } = Config();

      const {
        orgName = azure_devops && azure_devops.org,
        personalAccessToken = azure_devops && azure_devops.access_token,
        devopsProject = azure_devops && azure_devops.project,
        pipelineName = getRepositoryName(gitOriginUrl) + "-lifecycle",
        repoName = getRepositoryName(gitOriginUrl),
        repoUrl = getRepositoryUrl(gitOriginUrl),
        hldUrl = azure_devops && azure_devops.hld_repository,
        buildScriptUrl = BUILD_SCRIPT_URL
      } = opts;

      if (
        !isValidConfig(
          orgName,
          devopsProject,
          pipelineName,
          repoUrl,
          hldUrl,
          hldUrl,
          buildScriptUrl,
          personalAccessToken
        )
      ) {
        process.exit(1);
      }

      try {
        await installLifecyclePipeline(
          orgName,
          personalAccessToken,
          pipelineName,
          repoName,
          repoUrl,
          hldUrl,
          devopsProject,
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
 *
 * Validates the pipeline configuration
 * @param orgName URL to the Azure DevOps organization that you are using.
 * @param devopsProject Name of the devops project
 * @param pipelineName Name of this build pipeline in AzDo
 * @param repoName Name of repo
 * @param repoUrl Repo URL
 * @param hldUrl  URL of the HLD
 * @param buildScriptUrl Build Script URL
 * @param personalAccessToken Personal Access token with access to the HLD repository and materialized manifest repository.
 */
export const isValidConfig = (
  orgName: any,
  devopsProject: any,
  pipelineName: any,
  repoName: any,
  repoUrl: any,
  hldUrl: any,
  buildScriptUrl: any,
  personalAccessToken: any
): boolean => {
  const missingConfig = [];

  logger.debug(`orgName: ${orgName}`);
  logger.debug(`personalAccessToken: XXXXXXXXXXXXXXXXX`);
  logger.debug(`pipelineName: ${pipelineName}`);
  logger.debug(`repoName: ${repoName}`);
  logger.debug(`repoUrl: ${repoUrl}`);
  logger.debug(`hldUrl: ${hldUrl}`);
  logger.debug(`devopsProject: ${devopsProject}`);
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
  if (typeof repoName !== "string") {
    missingConfig.push(
      `--repo-name must be of type 'string', ${typeof repoName} given.`
    );
  }
  if (typeof repoUrl !== "string") {
    missingConfig.push(
      `--repo-url must be of type 'string', ${typeof repoUrl} given.`
    );
  }
  if (typeof hldUrl !== "string") {
    missingConfig.push(
      `--hld-url must be of type 'string', ${typeof hldUrl} given.`
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
 * Install the project hld lifecycle pipeline in an azure devops org.
 *
 * @param orgName
 * @param personalAccessToken
 * @param pipelineName
 * @param repositoryName
 * @param repositoryUrl
 * @param hldRepoUrl
 * @param project
 * @param buildScriptUrl Build Script URL
 * @param exitFn
 */
export const installLifecyclePipeline = async (
  orgName: string,
  personalAccessToken: string,
  pipelineName: string,
  repositoryName: string,
  repositoryUrl: string,
  hldRepoUrl: string,
  project: string,
  buildScriptUrl: string,
  exitFn: (status: number) => void
) => {
  let devopsClient: IBuildApi | undefined;
  let builtDefinition: BuildDefinition | undefined;

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
    pipelineName,
    repositoryName,
    repositoryUrl,
    yamlFileBranch: "master",
    yamlFilePath: "hld-lifecycle.yaml"
  });

  try {
    logger.debug(
      `Creating pipeline for project '${project}' with definition '${JSON.stringify(
        definition
      )}'`
    );
    builtDefinition = await createPipelineForDefinition(
      devopsClient,
      project,
      definition
    );
  } catch (err) {
    logger.error(`Error occurred during pipeline creation for ${pipelineName}`);
    logger.error(err);
    return exitFn(1);
  }
  if (typeof builtDefinition.id === "undefined") {
    const builtDefnString = JSON.stringify(builtDefinition);
    throw Error(
      `Invalid BuildDefinition created, parameter 'id' is missing from ${builtDefnString}`
    );
  }

  logger.info(`Created pipeline for ${pipelineName}`);
  logger.info(`Pipeline ID: ${builtDefinition.id}`);

  try {
    await queueBuild(devopsClient, project, builtDefinition.id);
  } catch (err) {
    logger.error(`Error occurred when queueing build for ${pipelineName}`);
    logger.error(err);
    return exitFn(1);
  }
};
