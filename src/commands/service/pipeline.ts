import { IBuildApi } from "azure-devops-node-api/BuildApi";
import commander = require("commander");
import path from "path";
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
    .option("-o, --org-name <org-name>", "Organization Name for Azure DevOps")
    .option("-r, --repo-name <repo-name>", "Repository Name in Azure DevOps")
    .option("-u, --repo-url <repo-url>", "Repository URL")
    .option("-d, --devops-project <devops-project>", "Azure DevOps Project")
    .option(
      "-l, --packages-dir <packages-dir>",
      "The monorepository directory containing this service definition. ie. '--packages-dir packages' if my-service is located under ./packages/my-service."
    )
    .action(async (serviceName, opts) => {
      const gitOriginUrl = await getOriginUrl();

      const { azure_devops } = Config();
      const {
        orgName = azure_devops && azure_devops.org,
        personalAccessToken = azure_devops && azure_devops.access_token,
        devopsProject = azure_devops && azure_devops.project,
        pipelineName = serviceName + "-pipeline",
        packagesDir = "./",
        repoName = getRepositoryName(gitOriginUrl),
        repoUrl = getRepositoryUrl(gitOriginUrl)
      } = opts;

      logger.debug(`orgName: ${orgName}`);
      logger.debug(`personalAccessToken: ${personalAccessToken}`);
      logger.debug(`devopsProject: ${devopsProject}`);
      logger.debug(`pipelineName: ${pipelineName}`);
      logger.debug(`packagesDir: ${packagesDir}`);
      logger.debug(`repoName: ${repoName}`);
      logger.debug(`repoUrl: ${repoUrl}`);

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

        if (typeof packagesDir !== "string") {
          throw new Error(
            `--packages-dir must be of type 'string', ${typeof packagesDir} given.`
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
          orgName,
          personalAccessToken,
          pipelineName,
          repoName,
          repoUrl,
          devopsProject,
          packagesDir,
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
 * Install a pipeline for the service in an azure devops org.
 * @param serviceName
 * @param orgName
 * @param personalAccessToken
 * @param pipelineName
 * @param repoName
 * @param repoUrl
 * @param project
 */
export const installPipeline = async (
  serviceName: string,
  orgName: string,
  personalAccessToken: string,
  pipelineName: string,
  repoName: string,
  repoUrl: string,
  project: string,
  packagesDir: string,
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
    repositoryName: repoName,
    repositoryUrl: repoUrl,
    yamlFileBranch: "master",
    yamlFilePath: path.join(packagesDir, serviceName, "azure-pipelines.yaml") // This may not work if we're using a non-mono repository and azure-pipelines.yaml is in the root directory.
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
