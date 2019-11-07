import { IBuildApi } from "azure-devops-node-api/BuildApi";
import { BuildDefinition } from "azure-devops-node-api/interfaces/BuildInterfaces";
import commander from "commander";
import { Config } from "../../config";
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
    .option("-d, --devops-project <devops-project>", "Azure DevOps Project")
    .action(async opts => {
      const { azure_devops } = Config();

      if (!azure_devops) {
        logger.error("Azure DevOps config section not found");
        process.exit(1);
        return;
      }

      const gitOriginUrl = await getOriginUrl();

      const {
        orgName = azure_devops && azure_devops.org,
        personalAccessToken = azure_devops && azure_devops.access_token,
        devopsProject = azure_devops && azure_devops.project,
        pipelineName = getRepositoryName(gitOriginUrl) + "-lifecycle",
        repoName = getRepositoryName(gitOriginUrl),
        repoUrl = getRepositoryUrl(gitOriginUrl)
      } = opts;

      try {
        await installPipeline(
          orgName,
          personalAccessToken,
          pipelineName,
          repoName,
          repoUrl,
          devopsProject,
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
 * Install the project hld lifecycle pipeline in an azure devops org.
 *
 * @param orgName
 * @param personalAccessToken
 * @param pipelineName
 * @param repositoryName
 * @param repositoryUrl
 * @param project
 * @param exitFn
 */
export const installPipeline = async (
  orgName: string,
  personalAccessToken: string,
  pipelineName: string,
  repositoryName: string,
  repositoryUrl: string,
  project: string,
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
