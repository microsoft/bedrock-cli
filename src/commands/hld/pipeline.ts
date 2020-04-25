import { IBuildApi } from "azure-devops-node-api/BuildApi";
import {
  BuildDefinition,
  BuildDefinitionVariable,
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import commander from "commander";
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
  RENDER_HLD_PIPELINE_FILENAME,
} from "../../lib/constants";
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";
import { AzureDevOpsOpts } from "../../lib/git";
import { getRepositoryName, isGitHubUrl } from "../../lib/gitutils";
import {
  createPipelineForDefinition,
  definitionForAzureRepoPipeline,
  getBuildApiClient,
  IAzureRepoPipelineConfig,
  queueBuild,
} from "../../lib/pipelines/pipelines";
import {
  validateOrgNameThrowable,
  validateProjectNameThrowable,
} from "../../lib/validator";
import { logger } from "../../logger";
import decorator from "./pipeline.decorator.json";

export interface CommandOptions {
  pipelineName: string;
  personalAccessToken: string;
  orgName: string;
  hldName: string;
  hldUrl: string;
  manifestUrl: string;
  devopsProject: string;
  buildScriptUrl: string;
  yamlFileBranch: string;
}

export const emptyStringIfUndefined = (val: string | undefined): string => {
  return val ? val : "";
};

const validateRepos = (hldRepoUrl: string, manifestRepoUrl: string): void => {
  const hldGitUrlType = isGitHubUrl(hldRepoUrl);
  const manifestGitUrlType = isGitHubUrl(manifestRepoUrl);
  if (hldGitUrlType || manifestGitUrlType) {
    throw buildError(errorStatusCode.GIT_OPS_ERR, {
      errorKey: "hld-install-manifest-pipeline-cmd-validate-repo-err",
      values: [hldRepoUrl, manifestRepoUrl],
    });
  }
};

export const populateValues = (opts: CommandOptions): CommandOptions => {
  // exception will be thrown if bedrock's config.yaml is missing
  populateInheritValueFromConfig(decorator, Config(), opts);
  validateForRequiredValues(decorator, opts, true);
  validateOrgNameThrowable(opts.orgName);
  validateProjectNameThrowable(opts.devopsProject);

  opts.hldName = getRepositoryName(opts.hldUrl);
  opts.pipelineName =
    opts.hldName + "-to-" + getRepositoryName(opts.manifestUrl);

  opts.buildScriptUrl = opts.buildScriptUrl || BUILD_SCRIPT_URL;

  validateRepos(opts.hldUrl, opts.manifestUrl);

  logger.debug(`orgName: ${opts.orgName}`);
  logger.debug(`personalAccessToken: XXXXXXXXXXXXXXXXX`);
  logger.debug(`devopsProject: ${opts.devopsProject}`);
  logger.debug(`pipelineName: ${opts.pipelineName}`);
  logger.debug(`manifestUrl: ${opts.manifestUrl}`);
  logger.debug(`hldName: ${opts.hldName}`);
  logger.debug(`hldUrl: ${opts.hldUrl}`);
  logger.debug(`buildScriptUrl: ${opts.buildScriptUrl}`);
  return opts;
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
      value: buildScriptUrl,
    },
    MANIFEST_REPO: {
      allowOverride: true,
      isSecret: false,
      value: manifestRepoUrl,
    },
    PAT: {
      allowOverride: true,
      isSecret: true,
      value: accessToken,
    },
  };
};

/**
 * Install a HLD to Manifest pipeline. The Azure Pipelines yaml should
 * be merged into the HLD repository before this function is to be invoked.
 *
 * @param values Values for command Options
 */
export const installHldToManifestPipeline = async (
  values: CommandOptions
): Promise<void> => {
  const devopsClient = await getBuildApiClient(
    values.orgName,
    values.personalAccessToken
  );
  logger.info("Fetched DevOps Client");

  const definition = definitionForAzureRepoPipeline({
    branchFilters: ["master"],
    maximumConcurrentBuilds: 1,
    pipelineName: values.pipelineName,
    repositoryName: values.hldName,
    repositoryUrl: values.hldUrl,
    variables: requiredPipelineVariables(
      values.personalAccessToken,
      values.buildScriptUrl,
      values.manifestUrl
    ),
    yamlFileBranch: values.yamlFileBranch,
    yamlFilePath: RENDER_HLD_PIPELINE_FILENAME,
  } as IAzureRepoPipelineConfig);

  logger.info(
    `Attempting to create new pipeline: ${values.pipelineName} defined in repository:${values.hldUrl}, branch: ${values.yamlFileBranch}, filePath: ${RENDER_HLD_PIPELINE_FILENAME}`
  );

  // createPipelineForDefinition is already throwing error code.
  const builtDefinition = await createPipelineForDefinition(
    devopsClient as IBuildApi,
    values.devopsProject,
    definition
  );

  logger.info(`Created pipeline for ${values.pipelineName}`);
  logger.info(`Pipeline ID: ${(builtDefinition as BuildDefinition).id}`);

  // queueBuild is already throwing error code.
  await queueBuild(
    devopsClient as IBuildApi,
    values.devopsProject,
    builtDefinition.id as number
  );
};

export const execute = async (
  opts: CommandOptions,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  try {
    populateValues(opts);
    const accessOpts: AzureDevOpsOpts = {
      orgName: opts.orgName,
      personalAccessToken: opts.personalAccessToken,
      project: opts.devopsProject,
    };

    // By default the version descriptor is for the master branch
    await validateRepository(
      opts.devopsProject,
      RENDER_HLD_PIPELINE_FILENAME,
      opts.yamlFileBranch ? opts.yamlFileBranch : "master",
      opts.hldName,
      accessOpts
    );
    await installHldToManifestPipeline(opts);
    await exitFn(0);
  } catch (err) {
    logError(
      buildError(
        errorStatusCode.CMD_EXE_ERR,
        "hld-install-manifest-pipeline-cmd-failed",
        err
      )
    );
    await exitFn(1);
  }
};

export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: CommandOptions) => {
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
