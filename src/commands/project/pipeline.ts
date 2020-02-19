import { IBuildApi } from "azure-devops-node-api/BuildApi";
import {
  BuildDefinition,
  BuildDefinitionVariable
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import commander from "commander";
import { Config } from "../../config";
import { fileInfo as bedrockFileInfo } from "../../lib/bedrockYaml";
import {
  build as buildCmd,
  exit as exitCmd,
  validateForRequiredValues
} from "../../lib/commandBuilder";
import {
  BUILD_SCRIPT_URL,
  PROJECT_CVG_DEPENDENCY_ERROR_MESSAGE,
  PROJECT_INIT_CVG_DEPENDENCY_ERROR_MESSAGE,
  PROJECT_PIPELINE_FILENAME
} from "../../lib/constants";
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
import { IBedrockFileInfo, IConfigYaml } from "../../types";
import decorator from "./pipeline.decorator.json";

export interface ICommandOptions {
  orgName: string | undefined;
  personalAccessToken: string | undefined;
  devopsProject: string | undefined;
  pipelineName: string | undefined;
  repoName: string | undefined;
  repoUrl: string | undefined;
  buildScriptUrl: string | undefined;
  yamlFileBranch: string;
}

export const checkDependencies = (projectPath: string) => {
  const file: IBedrockFileInfo = bedrockFileInfo(projectPath);
  if (file.exist === false) {
    throw new Error(PROJECT_INIT_CVG_DEPENDENCY_ERROR_MESSAGE);
  } else if (file.hasVariableGroups === false) {
    throw new Error(PROJECT_CVG_DEPENDENCY_ERROR_MESSAGE);
  }
};

/**
 * Returns values that are needed for this command.
 *
 * @param opts Options object from commander.
 * @param gitOriginUrl Git origin URL which is used to set values
 *        for pipeline, repoName and repoUrl
 * @param spkConfig SPK Configuration for getting default values.
 * @returns values that are needed for this command.
 */
export const fetchValidateValues = (
  opts: ICommandOptions,
  gitOriginUrl: string,
  spkConfig: IConfigYaml | undefined
): ICommandOptions | null => {
  if (!spkConfig) {
    throw new Error("SPK Config is missing");
  }
  const azure_devops = spkConfig?.azure_devops;

  const values: ICommandOptions = {
    buildScriptUrl: opts.buildScriptUrl || BUILD_SCRIPT_URL,
    devopsProject: opts.devopsProject || azure_devops?.project,
    orgName: opts.orgName || azure_devops?.org,
    personalAccessToken: opts.personalAccessToken || azure_devops?.access_token,
    pipelineName:
      opts.pipelineName || getRepositoryName(gitOriginUrl) + "-lifecycle",
    repoName: opts.repoName || getRepositoryName(gitOriginUrl),
    repoUrl: opts.repoUrl || getRepositoryUrl(gitOriginUrl),
    yamlFileBranch: opts.yamlFileBranch
  };

  const map: { [key: string]: string | undefined } = {};
  (Object.keys(values) as Array<keyof ICommandOptions>).forEach(key => {
    const val = values[key];
    if (key === "personalAccessToken") {
      logger.debug(`${key}: XXXXXXXXXXXXXXXXX`);
    } else {
      logger.debug(`${key}: ${val}`);
    }
    map[key] = val;
  });

  const error = validateForRequiredValues(decorator, map);
  return error.length > 0 ? null : values;
};

/**
 * Executes the command.
 *
 * @param opts Options object from commander.
 * @param projectPath Project path which is the current directory.
 * @param exitFn Exit function.
 */
export const execute = async (
  opts: ICommandOptions,
  projectPath: string,
  exitFn: (status: number) => Promise<void>
) => {
  if (!projectPath) {
    logger.error("Project Path is missing");
    await exitFn(1);
    return;
  }

  logger.verbose(`project path: ${projectPath}`);

  try {
    checkDependencies(projectPath);
    const gitOriginUrl = await getOriginUrl();
    const values = fetchValidateValues(opts, gitOriginUrl, Config());

    if (values === null) {
      await exitFn(1);
    } else {
      await installLifecyclePipeline(values);
      await exitFn(0);
    }
  } catch (err) {
    logger.error(
      `Error occurred installing pipeline for project hld lifecycle.`
    );
    logger.error(err);
    await exitFn(1);
  }
};

export const commandDecorator = (command: commander.Command) => {
  buildCmd(command, decorator).action(async (opts: ICommandOptions) => {
    await execute(opts, process.cwd(), async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};

const createPipeline = async (
  values: ICommandOptions,
  devopsClient: IBuildApi,
  definitionBranch: string
): Promise<BuildDefinition> => {
  const definition = definitionForAzureRepoPipeline({
    branchFilters: ["master"], // hld reconcile pipeline is triggered only by merges into the master branch.
    maximumConcurrentBuilds: 1,
    pipelineName: values.pipelineName!,
    repositoryName: values.repoName!,
    repositoryUrl: values.repoUrl!,
    variables: requiredPipelineVariables(values.buildScriptUrl!),
    yamlFileBranch: definitionBranch, // Pipeline is defined in master
    yamlFilePath: PROJECT_PIPELINE_FILENAME // Pipeline definition lives in root directory.
  });

  logger.info(
    `Attempting to create new pipeline: ${values.pipelineName} defined in repository:${values.repoUrl}, branch: ${values.yamlFileBranch}, filePath: ${PROJECT_PIPELINE_FILENAME}`
  );

  try {
    return await createPipelineForDefinition(
      devopsClient,
      values.devopsProject!,
      definition
    );
  } catch (err) {
    logger.error(
      `Error occurred during pipeline creation for ${values.pipelineName}`
    );
    throw err; // catch by other catch block
  }
};

/**
 * Install the project hld lifecycle pipeline in an azure devops org.
 *
 * @param values Values from command line. These values are pre-checked
 * @param exitFn Exit function
 */
export const installLifecyclePipeline = async (values: ICommandOptions) => {
  const devopsClient = await getBuildApiClient(
    values.orgName!,
    values.personalAccessToken!
  );
  logger.info("Fetched DevOps Client");

  const pipeline = await createPipeline(
    values,
    devopsClient,
    values.yamlFileBranch
  );
  if (typeof pipeline.id === "undefined") {
    const builtDefnString = JSON.stringify(pipeline);
    throw Error(
      `Invalid BuildDefinition created, parameter 'id' is missing from ${builtDefnString}`
    );
  }
  logger.info(`Created pipeline for ${values.pipelineName}`);
  logger.info(`Pipeline ID: ${pipeline.id}`);

  await queueBuild(devopsClient, values.devopsProject!, pipeline.id);
};

/**
 * Builds and returns variables required for the lifecycle pipeline.
 * @param buildScriptUrl Build Script URL
 * @returns Object containing the necessary run-time variables for the lifecycle pipeline.
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
