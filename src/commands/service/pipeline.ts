import { IBuildApi } from "azure-devops-node-api/BuildApi";
import {
  BuildDefinition,
  BuildDefinitionVariable,
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import commander from "commander";
import { read as loadBedrockFile } from "../../lib/bedrockYaml";
import path from "path";
import { Config } from "../../config";
import { validateRepository } from "../../lib/git/azure";
import {
  build as buildCmd,
  exit as exitCmd,
  populateInheritValueFromConfig,
  validateForRequiredValues,
} from "../../lib/commandBuilder";
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
  validateRepoUrl,
} from "../../lib/gitutils";
import {
  createPipelineForDefinition,
  definitionForAzureRepoPipeline,
  getBuildApiClient,
  queueBuild,
} from "../../lib/pipelines/pipelines";
import { logger } from "../../logger";
import decorator from "./pipeline.decorator.json";
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";
import {
  validateOrgNameThrowable,
  validateProjectNameThrowable,
} from "../../lib/validator";
import { BedrockFile } from "../../types";

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
  const gitOriginUrl = await getOriginUrl();
  const repoUrl = validateRepoUrl(opts, gitOriginUrl);

  populateInheritValueFromConfig(decorator, Config(), opts);
  validateForRequiredValues(decorator, opts, true);

  opts.pipelineName = opts.pipelineName || serviceName + "-pipeline";
  opts.repoName = getRepositoryName(repoUrl);
  opts.repoUrl = opts.repoUrl || getRepositoryUrl(gitOriginUrl);
  opts.buildScriptUrl = opts.buildScriptUrl || BUILD_SCRIPT_URL;

  validateOrgNameThrowable(opts.orgName);
  validateProjectNameThrowable(opts.devopsProject);
  return opts;
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
    throw buildError(
      errorStatusCode.CMD_EXE_ERR,
      {
        errorKey: "service-install-build-pipeline-cmd-pipeline-creation-err",
        values: [values.pipelineName],
      },
      err
    );
  }
  if (typeof builtDefinition.id === "undefined") {
    const builtDefnString = JSON.stringify(builtDefinition);
    throw buildError(errorStatusCode.VALIDATION_ERR, {
      errorKey: "service-create-revision-cmd-err-source-branch-missing",
      values: [builtDefnString],
    });
  }
  logger.info(`Created pipeline for ${values.pipelineName}`);
  logger.info(`Pipeline ID: ${builtDefinition.id}`);
  try {
    await queueBuild(devopsClient, values.devopsProject, builtDefinition.id);
  } catch (err) {
    throw buildError(
      errorStatusCode.CMD_EXE_ERR,
      {
        errorKey: "service-install-build-pipeline-cmd-queue-build-err",
        values: [values.pipelineName],
      },
      err
    );
  }
};

export const execute = async (
  serviceName: string,
  projectPath: string,
  opts: CommandOptions,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  try {
    const gitOriginUrl = await getOriginUrl();
    const repoUrl = validateRepoUrl(opts, gitOriginUrl);
    const gitUrlType = isGitHubUrl(repoUrl);

    if (gitUrlType) {
      throw buildError(errorStatusCode.VALIDATION_ERR, {
        errorKey: "project-pipeline-err-github-repo",
        values: [repoUrl],
      });
    }

    await fetchValues(serviceName, opts);
    const bedrockFile: BedrockFile = loadBedrockFile(projectPath);
    let servicePath = "";
    bedrockFile.services.forEach((service) => {
      if (service.displayName === serviceName) {
        servicePath = service.path;
        return;
      }
    });

    if (servicePath === "") {
      throw buildError(errorStatusCode.VALIDATION_ERR, {
        errorKey: "project-pipeline-err-service-missing",
        values: [serviceName],
      });
    }

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
        path.join(servicePath, SERVICE_PIPELINE_FILENAME);

    // By default the version descriptor is for the master branch
    await validateRepository(
      opts.devopsProject,
      pipelinesYamlPath,
      opts.yamlFileBranch ? opts.yamlFileBranch : "master",
      opts.repoName,
      accessOpts
    );
    await installBuildUpdatePipeline(pipelinesYamlPath, opts);
    await exitFn(0);
  } catch (err) {
    logError(
      buildError(
        errorStatusCode.CMD_EXE_ERR,
        "service-install-build-pipeline-cmd-failed",
        err
      )
    );

    await exitFn(1);
  }
};

export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(
    async (serviceName: string, opts: CommandOptions) => {
      await execute(
        serviceName,
        process.cwd(),
        opts,
        async (status: number) => {
          await exitCmd(logger, process.exit, status);
        }
      );
    }
  );
};
