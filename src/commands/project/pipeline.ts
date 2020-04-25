import { IBuildApi } from "azure-devops-node-api/BuildApi";
import {
  BuildDefinition,
  BuildDefinitionVariable,
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import commander from "commander";
import { Config } from "../../config";
import { validateRepository } from "../../lib/git/azure";
import { fileInfo as bedrockFileInfo } from "../../lib/bedrockYaml";
import {
  build as buildCmd,
  exit as exitCmd,
  populateInheritValueFromConfig,
  validateForRequiredValues,
} from "../../lib/commandBuilder";
import {
  BUILD_SCRIPT_URL,
  PROJECT_PIPELINE_FILENAME,
} from "../../lib/constants";
import { AzureDevOpsOpts } from "../../lib/git";
import {
  getOriginUrl,
  getRepositoryName,
  getRepositoryUrl,
  isGitHubUrl,
  validateRepoUrl,
} from "../../lib/gitutils";
import {
  createPipelineForDefinition,
  definitionForAzureRepoPipeline,
  getBuildApiClient,
  queueBuild,
} from "../../lib/pipelines/pipelines";
import {
  validateOrgNameThrowable,
  validateProjectNameThrowable,
} from "../../lib/validator";
import { logger } from "../../logger";
import { BedrockFileInfo, ConfigYaml } from "../../types";
import decorator from "./pipeline.decorator.json";
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";

export interface CommandOptions {
  orgName: string | undefined;
  personalAccessToken: string | undefined;
  devopsProject: string | undefined;
  pipelineName: string;
  repoName: string;
  repoUrl: string | undefined;
  buildScriptUrl: string | undefined;
  yamlFileBranch: string;
}

export interface ConfigValues {
  devopsProject: string;
  repoName: string;
  orgName: string;
  personalAccessToken: string;
  pipelineName: string;
  repoUrl: string;
  buildScriptUrl: string;
  yamlFileBranch: string;
}

export const checkDependencies = (projectPath: string): void => {
  const file: BedrockFileInfo = bedrockFileInfo(projectPath);
  if (file.exist === false) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "project-pipeline-err-init-dependency"
    );
  } else if (file.hasVariableGroups === false) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "project-pipeline-err-cvg"
    );
  }
};

/**
 * Returns values that are needed for this command.
 *
 * @param opts Options object from commander.
 * @param gitOriginUrl Git origin URL which is used to set values
 *        for pipeline, repoName and repoUrl
 * @param bedrockConfig Bedrock configuration for getting default values.
 * @returns values that are needed for this command.
 */
export const fetchValidateValues = (
  opts: CommandOptions,
  gitOriginUrl: string,
  bedrockConfig: ConfigYaml | undefined
): ConfigValues => {
  if (!bedrockConfig) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "project-pipeline-err-bedrock-config-missing"
    );
  }

  const repoUrl = validateRepoUrl(opts, gitOriginUrl);

  (opts.pipelineName =
    opts.pipelineName || getRepositoryName(gitOriginUrl) + "-lifecycle"),
    (opts.repoName =
      getRepositoryName(repoUrl) || getRepositoryName(gitOriginUrl)),
    (opts.repoUrl = opts.repoUrl || getRepositoryUrl(gitOriginUrl));
  opts.yamlFileBranch = opts.yamlFileBranch || "master";
  opts.buildScriptUrl = opts.buildScriptUrl || BUILD_SCRIPT_URL;

  populateInheritValueFromConfig(decorator, Config(), opts);

  // error will be thrown if validation fails
  validateForRequiredValues(decorator, opts, true);

  // validateForRequiredValues has validated the following
  // values are validate, adding || "" is just to
  // satisfy the no-non-null-assertion eslint rule
  const configVals: ConfigValues = {
    orgName: opts.orgName || "",
    buildScriptUrl: opts.buildScriptUrl || BUILD_SCRIPT_URL,
    devopsProject: opts.devopsProject || "",
    repoName: opts.repoName,
    personalAccessToken: opts.personalAccessToken || "",
    pipelineName: opts.pipelineName || "",
    repoUrl: opts.repoUrl || "",
    yamlFileBranch: opts.yamlFileBranch,
  };

  validateProjectNameThrowable(configVals.devopsProject);
  validateOrgNameThrowable(configVals.orgName);

  return configVals;
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
      value: buildScriptUrl,
    },
  };
};

const createPipeline = async (
  values: ConfigValues,
  devopsClient: IBuildApi,
  definitionBranch: string
): Promise<BuildDefinition> => {
  const definition = definitionForAzureRepoPipeline({
    branchFilters: ["master"], // hld reconcile pipeline is triggered only by merges into the master branch.
    maximumConcurrentBuilds: 1,
    pipelineName: values.pipelineName,
    repositoryName: values.repoName,
    repositoryUrl: values.repoUrl,
    variables: requiredPipelineVariables(values.buildScriptUrl),
    yamlFileBranch: definitionBranch, // Pipeline is defined in master
    yamlFilePath: PROJECT_PIPELINE_FILENAME, // Pipeline definition lives in root directory.
  });

  logger.info(
    `Attempting to create new pipeline: ${values.pipelineName} defined in repository:${values.repoUrl}, branch: ${values.yamlFileBranch}, filePath: ${PROJECT_PIPELINE_FILENAME}`
  );

  try {
    return await createPipelineForDefinition(
      devopsClient,
      values.devopsProject,
      definition
    );
  } catch (err) {
    const errorInfo = buildError(
      errorStatusCode.EXE_FLOW_ERR,
      {
        errorKey: "project-pipeline-err-pipeline-create",
        values: [values.pipelineName],
      },
      err
    );
    logError(errorInfo);
    throw errorInfo;
  }
};

/**
 * Install the project hld lifecycle pipeline in an azure devops org.
 *
 * @param values Values from command line. These values are pre-checked
 * @param exitFn Exit function
 */
export const installLifecyclePipeline = async (
  values: ConfigValues
): Promise<void> => {
  const devopsClient = await getBuildApiClient(
    values.orgName,
    values.personalAccessToken
  );
  logger.info("Fetched DevOps Client");

  const pipeline = await createPipeline(
    values,
    devopsClient,
    values.yamlFileBranch
  );
  if (typeof pipeline.id === "undefined") {
    const builtDefnString = JSON.stringify(pipeline);
    throw buildError(errorStatusCode.VALIDATION_ERR, {
      errorKey: "project-pipeline-err-invalid-build-definition",
      values: [builtDefnString],
    });
  }
  logger.info(`Created pipeline for ${values.pipelineName}`);
  logger.info(`Pipeline ID: ${pipeline.id}`);

  await queueBuild(devopsClient, values.devopsProject, pipeline.id);
};

/**
 * Executes the command.
 *
 * @param opts Options object from commander.
 * @param projectPath Project path which is the current directory.
 * @param exitFn Exit function.
 */
export const execute = async (
  opts: CommandOptions,
  projectPath: string,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  try {
    const gitOriginUrl = await getOriginUrl();
    const repoUrl = validateRepoUrl(opts, gitOriginUrl);
    const gitUrlType = await isGitHubUrl(repoUrl);
    if (gitUrlType) {
      throw buildError(errorStatusCode.VALIDATION_ERR, {
        errorKey: "project-pipeline-err-github-repo",
        values: [repoUrl],
      });
    }
    if (!projectPath) {
      throw buildError(errorStatusCode.VALIDATION_ERR, {
        errorKey: "project-pipeline-err-missing-values",
        values: ["project path"],
      });
    }

    logger.verbose(`project path: ${projectPath}`);

    checkDependencies(projectPath);
    const values = fetchValidateValues(opts, gitOriginUrl, Config());

    const accessOpts: AzureDevOpsOpts = {
      orgName: values.orgName,
      personalAccessToken: values.personalAccessToken,
      project: values.devopsProject,
    };
    await validateRepository(
      values.devopsProject,
      PROJECT_PIPELINE_FILENAME,
      values.yamlFileBranch || "master",
      values.repoName,
      accessOpts
    );
    await installLifecyclePipeline(values);
    await exitFn(0);
  } catch (err) {
    logError(
      buildError(
        errorStatusCode.CMD_EXE_ERR,
        "project-pipeline-cmd-failed",
        err
      )
    );
    await exitFn(1);
  }
};

export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: CommandOptions) => {
    await execute(opts, process.cwd(), async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
