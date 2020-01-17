import { IBuildApi } from "azure-devops-node-api/BuildApi";
import {
  BuildDefinition,
  BuildDefinitionVariable
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import commander from "commander";
import path from "path";
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

export const installBuildPipelineCommandDecorator = (
  command: commander.Command
): void => {
  command
    .command("install-build-pipeline <service-name>")
    .alias("p")
    .description(
      "Install the build and push to acr pipeline for a service to your Azure DevOps instance"
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
    .option(
      "-b, --build-script <build-script-url>",
      `Build Script URL. By default it is '${BUILD_SCRIPT_URL}'.`
    )
    .option(
      "-l, --packages-dir <packages-dir>",
      "The mono-repository directory containing this service definition. ie. '--packages-dir packages' if my-service is located under ./packages/my-service. Omitting this option implies this is a not a mono-repository."
    )
    .action(async (serviceName, opts) => {
      const gitOriginUrl = await getOriginUrl();

      const { azure_devops } = Config();
      const {
        orgName = azure_devops && azure_devops.org,
        personalAccessToken = azure_devops && azure_devops.access_token,
        devopsProject = azure_devops && azure_devops.project,
        pipelineName = serviceName + "-pipeline",
        packagesDir, // allow to be undefined in the case of a mono-repo
        repoName = getRepositoryName(gitOriginUrl),
        repoUrl = getRepositoryUrl(gitOriginUrl),
        buildScriptUrl = BUILD_SCRIPT_URL
      } = opts;

      logger.debug(`orgName: ${orgName}`);
      logger.debug(`personalAccessToken: XXXXXXXXXXXXXXXXX`);
      logger.debug(`devopsProject: ${devopsProject}`);
      logger.debug(`pipelineName: ${pipelineName}`);
      logger.debug(`packagesDir: ${packagesDir}`);
      logger.debug(`repoName: ${repoName}`);
      logger.debug(`repoUrl: ${repoUrl}`);
      logger.debug(`buildScriptUrl: ${buildScriptUrl}`);

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
        if (typeof buildScriptUrl !== "string") {
          throw new Error(
            `--build-script must be of type 'string', ${typeof buildScriptUrl} given.`
          );
        }
      } catch (err) {
        logger.error(`Error occurred validating inputs for ${serviceName}`);
        logger.error(err);
        process.exit(1);
      }

      try {
        await installBuildUpdatePipeline(
          serviceName,
          orgName,
          personalAccessToken,
          pipelineName,
          repoName,
          repoUrl,
          devopsProject,
          packagesDir,
          buildScriptUrl,
          process.exit
        );
      } catch (err) {
        logger.error(`Error occurred installing pipeline for ${serviceName}`);
        logger.error(err);
        process.exit(1);
      }
    });
};

/**
 * Validates the pipeline configuration
 * @param pipelineName Name of pipeline
 * @param personalAccessToken Personal access token
 * @param orgName Name of organization
 * @param repoName Name of repository
 * @param repoUrl URL of repository
 * @param devopsProject DevOps project
 * @param buildScriptUrl URL of build script
 */
export const isValidConfig = (
  pipelineName: any,
  personalAccessToken: any,
  orgName: any,
  repoName: any,
  repoUrl: any,
  devopsProject: any,
  buildScriptUrl: any
): boolean => {
  const missingConfig = [];

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
 * Install a pipeline for the service in an azure devops org.
 *
 * @param serviceName Name of the service this pipeline belongs to; this is only used when `packagesDir` is defined as a means to locate the azure-pipelines.yaml file
 * @param orgName
 * @param personalAccessToken
 * @param pipelineName
 * @param repositoryName
 * @param repositoryUrl
 * @param project
 * @param packagesDir The directory containing the services for a mono-repo. If undefined; implies that we are operating on a standard service repository
 * @param buildScriptUrl Build Script URL
 * @param exitFn
 */
export const installBuildUpdatePipeline = async (
  serviceName: string,
  orgName: string,
  personalAccessToken: string,
  pipelineName: string,
  repositoryName: string,
  repositoryUrl: string,
  project: string,
  packagesDir: string | undefined,
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
    variables: requiredPipelineVariables(buildScriptUrl),
    yamlFileBranch: "master",
    yamlFilePath: packagesDir // if a packages dir is supplied, its a mono-repo
      ? path.join(packagesDir, serviceName, "azure-pipelines.yaml") // if a packages dir is supplied, concat <packages-dir>/<service-name>
      : path.join(serviceName, "azure-pipelines.yaml") // if no packages dir, then just concat with the service directory.
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

/**
 * Builds and returns variables required for the Build & Update service pipeline.
 * @param buildScriptUrl Build Script URL
 * @returns Object containing the necessary run-time variables for the Build & Update service  pipeline.
 */
export const requiredPipelineVariables = (
  buildScriptUrl: string
): { [key: string]: BuildDefinitionVariable } => {
  return {
    BUILD_SCRIPT_URL: {
      allowOverride: true,
      isSecret: false,
      value: buildScriptUrl
    }
  };
};
