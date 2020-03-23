/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/camelcase */
import { IBuildApi } from "azure-devops-node-api/BuildApi";
import {
  BuildDefinition,
  BuildDefinitionVariable,
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import commander from "commander";
import path from "path";
import { Config } from "../../config";
import { repositoryHasFile } from "../../lib/azdoClient";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import {
  BUILD_SCRIPT_URL,
  SERVICE_PIPELINE_FILENAME,
} from "../../lib/constants";
import { AzureDevOpsOpts } from "../../lib/git";
import {
  getOriginUrl,
  getRepositoryName,
  getRepositoryUrl,
  isGitHubUrl,
} from "../../lib/gitutils";
import {
  createPipelineForDefinition,
  definitionForAzureRepoPipeline,
  getBuildApiClient,
  queueBuild,
} from "../../lib/pipelines/pipelines";
import { logger } from "../../logger";
import decorator from "./pipeline.decorator.json";

export interface CommandOptions {
  orgName: string;
  personalAccessToken: string;
  devopsProject: string;
  pipelineName: string;
  packagesDir: string | undefined; // allow to be undefined in the case of a mono-repo
  repoName: string;
  repoUrl: string;
  buildScriptUrl: string;
  yamlFileBranch: string;
}

export const fetchValues = async (
  serviceName: string,
  opts: CommandOptions
): Promise<CommandOptions> => {
  const { azure_devops } = Config();
  const gitOriginUrl = await getOriginUrl();

  opts.orgName = opts.orgName || azure_devops?.org || "";
  opts.personalAccessToken =
    opts.personalAccessToken || azure_devops?.access_token || "";
  opts.devopsProject = opts.devopsProject || azure_devops?.project || "";
  opts.pipelineName = opts.pipelineName || serviceName + "-pipeline";
  opts.repoName = getRepositoryName(opts.repoUrl);
  opts.repoUrl = opts.repoUrl || getRepositoryUrl(gitOriginUrl);
  opts.buildScriptUrl = opts.buildScriptUrl || BUILD_SCRIPT_URL;
  return opts;
};

export const execute = async (
  serviceName: string,
  opts: CommandOptions,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  try {
    if (!opts.repoUrl) {
      throw Error(`Repo url not defined`);
    }
    const gitUrlType = await isGitHubUrl(opts.repoUrl);
    if (gitUrlType) {
      throw Error(
        `GitHub repos are not supported. Repo url: ${opts.repoUrl} is invalid`
      );
    }
    await fetchValues(serviceName, opts);
    const accessOpts: AzureDevOpsOpts = {
      orgName: opts.orgName,
      personalAccessToken: opts.personalAccessToken,
      project: opts.devopsProject,
    };

    // if a packages dir is supplied, its a mono-repo
    const pipelinesYamlPath = opts.packagesDir
      ? // if a packages dir is supplied, concat <packages-dir>/<service-name>
        path.join(opts.packagesDir, serviceName, SERVICE_PIPELINE_FILENAME)
      : // if no packages dir, then just concat with the service directory.
        path.join(serviceName, SERVICE_PIPELINE_FILENAME);

    // By default the version descriptor is for the master branch
    await repositoryHasFile(
      pipelinesYamlPath,
      opts.yamlFileBranch ? opts.yamlFileBranch : "master",
      opts.repoName,
      accessOpts
    );
    await installBuildUpdatePipeline(pipelinesYamlPath, opts);
    await exitFn(0);
  } catch (err) {
    logger.error(err);
    await exitFn(1);
  }
};

export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(
    async (serviceName: string, opts: CommandOptions) => {
      await execute(serviceName, opts, async (status: number) => {
        await exitCmd(logger, process.exit, status);
      });
    }
  );
};

/**
 * Install a pipeline for the service in an azure devops org.
 *
 * @param serviceName Name of the service this pipeline belongs to;
 *        this is only used when `packagesDir` is defined as a means
 *        to locate the azure-pipelines.yaml file
 * @param pipelinesYamlPath Relative path to the build update hld pipelines yaml file in the repository
 * @param values Values from commander
 */
export const installBuildUpdatePipeline = async (
  pipelinesYamlPath: string,
  values: CommandOptions
): Promise<void> => {
  let devopsClient: IBuildApi | undefined;
  let builtDefinition: BuildDefinition | undefined;

  try {
    devopsClient = await getBuildApiClient(
      values.orgName,
      values.personalAccessToken
    );
    logger.info("Fetched DevOps Client");

    const definition = definitionForAzureRepoPipeline({
      branchFilters: ["master"],
      maximumConcurrentBuilds: 1,
      pipelineName: values.pipelineName,
      repositoryName: values.repoName,
      repositoryUrl: values.repoUrl,
      variables: requiredPipelineVariables(values.buildScriptUrl),
      yamlFileBranch: values.yamlFileBranch,
      yamlFilePath: pipelinesYamlPath,
    });

    logger.debug(
      `Creating pipeline for project '${
        values.devopsProject
      }' with definition '${JSON.stringify(definition)}'`
    );

    logger.info(
      `Attempting to create new pipeline: ${values.pipelineName} defined in repository:${values.repoUrl}, branch: ${values.yamlFileBranch}, filePath: ${pipelinesYamlPath}`
    );

    builtDefinition = await createPipelineForDefinition(
      devopsClient,
      values.devopsProject,
      definition
    );
  } catch (err) {
    logger.error(err); // caller will catch it and exit
    throw new Error(
      `Error occurred during pipeline creation for ${values.pipelineName}`
    );
  }
  if (typeof builtDefinition.id === "undefined") {
    const builtDefnString = JSON.stringify(builtDefinition);
    throw Error(
      `Invalid BuildDefinition created, parameter 'id' is missing from ${builtDefnString}`
    );
  }
  logger.info(`Created pipeline for ${values.pipelineName}`);
  logger.info(`Pipeline ID: ${builtDefinition.id}`);
  try {
    await queueBuild(devopsClient, values.devopsProject, builtDefinition.id);
  } catch (err) {
    logger.error(
      `Error occurred when queueing build for ${values.pipelineName}`
    );
    throw err; // caller will catch it and exit
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
      value: buildScriptUrl,
    },
  };
};
