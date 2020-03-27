import { IBuildApi } from "azure-devops-node-api/BuildApi";
import {
  BuildDefinition,
  BuildDefinitionVariable,
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import commander from "commander";
import { Config } from "../../config";
import { validateRepository } from "../../lib/azdoClient";
import {
  build as buildCmd,
  exit as exitCmd,
  getOption as getCmdOption,
} from "../../lib/commandBuilder";
import {
  BUILD_SCRIPT_URL,
  RENDER_HLD_PIPELINE_FILENAME,
} from "../../lib/constants";
import { AzureDevOpsOpts } from "../../lib/git";
import { getRepositoryName, isGitHubUrl } from "../../lib/gitutils";
import {
  createPipelineForDefinition,
  definitionForAzureRepoPipeline,
  getBuildApiClient,
  IAzureRepoPipelineConfig,
  queueBuild,
} from "../../lib/pipelines/pipelines";
import { logger } from "../../logger";
import decorator from "./pipeline.decorator.json";
import {
  hasValue,
  validateOrgNameThrowable,
  validateProjectNameThrowable,
} from "../../lib/validator";

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
    throw Error(`GitHub repos are not supported`);
  }
};

export const populateValues = (opts: CommandOptions): CommandOptions => {
  // NOTE: all the values in opts are defaulted to ""

  // exception will be thrown if spk's config.yaml is missing
  const { azure_devops } = Config();

  opts.hldUrl =
    opts.hldUrl || emptyStringIfUndefined(azure_devops?.hld_repository);

  opts.manifestUrl =
    opts.manifestUrl ||
    emptyStringIfUndefined(azure_devops?.manifest_repository);

  opts.hldName = getRepositoryName(opts.hldUrl);

  opts.orgName = opts.orgName || emptyStringIfUndefined(azure_devops?.org);

  if (hasValue(opts.orgName)) {
    validateOrgNameThrowable(opts.orgName);
  } else {
    throw Error(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      `value for ${getCmdOption(decorator, "org-name")!.arg} is missing`
    );
  }

  opts.personalAccessToken =
    opts.personalAccessToken ||
    emptyStringIfUndefined(azure_devops?.access_token);

  opts.devopsProject =
    opts.devopsProject || emptyStringIfUndefined(azure_devops?.project);

  if (hasValue(opts.devopsProject)) {
    validateProjectNameThrowable(opts.devopsProject);
  } else {
    throw Error(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      `value for ${getCmdOption(decorator, "devops-project")!.arg} is missing`
    );
  }

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
  let builtDefinition;

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

  try {
    builtDefinition = await createPipelineForDefinition(
      devopsClient as IBuildApi,
      values.devopsProject,
      definition
    );
  } catch (err) {
    logger.error(
      `Error occurred during pipeline creation for ${values.pipelineName}`
    );
    throw err; // caller will catch and exit
  }

  logger.info(`Created pipeline for ${values.pipelineName}`);
  logger.info(`Pipeline ID: ${(builtDefinition as BuildDefinition).id}`);

  try {
    await queueBuild(
      devopsClient as IBuildApi,
      values.devopsProject,
      builtDefinition.id as number
    );
  } catch (err) {
    logger.error(
      `Error occurred when queueing build for ${values.pipelineName}`
    );
    throw err; // caller will catch and exit
  }
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
    logger.error(
      `Error occurred installing pipeline for HLD to Manifest pipeline`
    );
    logger.error(err);
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
