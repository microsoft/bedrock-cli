import { IGitApi } from "azure-devops-node-api/GitApi";
import fs from "fs-extra";
import path from "path";
import simplegit from "simple-git/promise";
import { initialize as hldInitialize } from "../../commands/hld/init";
import {
  setVariableGroupInBedrockFile,
  updateLifeCyclePipeline,
} from "../../commands/project/create-variable-group";
import { initialize as projectInitialize } from "../../commands/project/init";
import { createService } from "../../commands/service/create";
import { RENDER_HLD_PIPELINE_FILENAME } from "../../lib/constants";
import { appendVariableGroupToPipelineYaml } from "../../lib/fileutils";
import { AzureDevOpsOpts } from "../../lib/git";
import { deleteVariableGroup } from "../../lib/pipelines/variableGroup";
import { create as createVariableGroup } from "../../lib/setup/variableGroup";
import { logger } from "../../logger";
import {
  APP_REPO,
  HELM_REPO,
  HLD_DEFAULT_COMPONENT_NAME,
  HLD_DEFAULT_DEF_PATH,
  HLD_REPO,
  MANIFEST_REPO,
  RequestContext,
  VARIABLE_GROUP,
} from "./constants";
import { createDirectory, moveToAbsPath, moveToRelativePath } from "./fsUtil";
import {
  commitAndPushToRemote,
  createRepoInAzureOrg,
  getAzureRepoUrl,
} from "./gitService";
import { chartTemplate, mainTemplate, valuesTemplate } from "./helmTemplates";

export const createRepo = async (
  gitApi: IGitApi,
  repoName: string,
  projectName: string,
  workspaceDir: string
): Promise<simplegit.SimpleGit> => {
  moveToAbsPath(workspaceDir);
  createDirectory(repoName);
  moveToRelativePath(repoName);

  await createRepoInAzureOrg(gitApi, repoName, projectName, true);
  const git = simplegit();
  await git.init();
  return git;
};

/**
 * Scaffold Manifest Repo.
 *
 * @param gitApi Git API client
 * @param rc request Context
 */
export const manifestRepo = async (
  gitApi: IGitApi,
  rc: RequestContext
): Promise<void> => {
  logger.info("Scaffolding Manifest Repo");
  const repoName = MANIFEST_REPO;
  const curFolder = process.cwd();

  try {
    logger.info(`creating git repo ${repoName} in project ${rc.projectName}`);
    const git = await createRepo(
      gitApi,
      repoName,
      rc.projectName,
      rc.workspace
    );

    fs.createFileSync("README.md");
    await git.add("./README.md");

    await commitAndPushToRemote(git, rc, repoName);
    rc.scaffoldManifest = true;

    logger.info("Completed scaffold Manifest Repo");
  } finally {
    moveToAbsPath(curFolder);
  }
};

/**
 * Scaffold HLD Repo.
 *
 * @param gitApi Git API client
 * @param rc request Context
 */
export const hldRepo = async (
  gitApi: IGitApi,
  rc: RequestContext
): Promise<void> => {
  logger.info("Scaffolding HLD Repo");
  const repoName = HLD_REPO;
  const curFolder = process.cwd();

  try {
    logger.info(`creating git repo ${repoName} in project ${rc.projectName}`);
    const git = await createRepo(
      gitApi,
      repoName,
      rc.projectName,
      rc.workspace
    );

    await hldInitialize(
      process.cwd(),
      false,
      "https://github.com/microsoft/fabrikate-definitions.git",
      HLD_DEFAULT_COMPONENT_NAME,
      HLD_DEFAULT_DEF_PATH
    );
    appendVariableGroupToPipelineYaml(
      process.cwd(),
      RENDER_HLD_PIPELINE_FILENAME,
      VARIABLE_GROUP
    );
    await git.add("./*");

    await commitAndPushToRemote(git, rc, repoName);
    rc.scaffoldHLD = true;

    logger.info("Completed scaffold HLD Repo");
  } finally {
    moveToAbsPath(curFolder);
  }
};

/**
 * Create chart directory and add helm chart files
 *
 * @param acrName Azure Container Registry Name.
 */
export const createChartArtifacts = (acrName: string): void => {
  createDirectory(APP_REPO);
  moveToRelativePath(APP_REPO);
  createDirectory("chart");
  moveToRelativePath("chart");

  const chart = chartTemplate.replace("@@CHART_APP_NAME@@", APP_REPO);
  fs.writeFileSync(path.join(process.cwd(), "Chart.yaml"), chart);

  const values = valuesTemplate
    .replace("@@CHART_APP_NAME@@", APP_REPO)
    .replace("@@ACR_NAME@@", acrName);
  fs.writeFileSync(path.join(process.cwd(), "values.yaml"), values);

  createDirectory("templates");
  moveToRelativePath("templates");

  fs.writeFileSync(path.join(process.cwd(), "all-in-one.yaml"), mainTemplate);
};

export const helmRepo = async (
  gitApi: IGitApi,
  rc: RequestContext
): Promise<void> => {
  logger.info("Scaffolding helm Repo");
  const repoName = HELM_REPO;
  const curFolder = process.cwd();

  try {
    logger.info(`creating git repo ${repoName} in project ${rc.projectName}`);
    const git = await createRepo(
      gitApi,
      repoName,
      rc.projectName,
      rc.workspace
    );
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    createChartArtifacts(rc.acrName!);
    moveToAbsPath(curFolder);
    moveToRelativePath(rc.workspace);
    moveToRelativePath(repoName);

    await git.add("./*");
    await commitAndPushToRemote(git, rc, repoName);
    rc.scaffoldHelm = true;

    logger.info("Completed scaffold helm Repo");
  } finally {
    moveToAbsPath(curFolder);
  }
};

export const setupVariableGroup = async (rc: RequestContext): Promise<void> => {
  const accessOpts: AzureDevOpsOpts = {
    orgName: rc.orgName,
    personalAccessToken: rc.accessToken,
    project: rc.projectName,
  };

  await deleteVariableGroup(accessOpts, VARIABLE_GROUP);
  await createVariableGroup(rc, VARIABLE_GROUP);
  logger.info(`Successfully created variable group, ${VARIABLE_GROUP}`);

  setVariableGroupInBedrockFile(".", VARIABLE_GROUP);
  updateLifeCyclePipeline(".");
};

export const initService = async (
  rc: RequestContext,
  repoName: string
): Promise<void> => {
  await createService(".", ".", {
    displayName: repoName,
    gitPush: false,
    helmChartChart: "",
    helmChartRepository: "",
    helmConfigAccessTokenVariable: "ACCESS_TOKEN_SECRET",
    helmConfigBranch: "master",
    helmConfigGit: getAzureRepoUrl(rc.orgName, rc.projectName, HELM_REPO),
    helmConfigPath: `${repoName}/chart`,
    k8sBackend: `${repoName}-svc`,
    k8sBackendPort: "80",
    k8sPort: 80,
    maintainerEmail: "",
    maintainerName: "",
    middlewares: "",
    middlewaresArray: [],
    packagesDir: "",
    pathPrefix: "",
    pathPrefixMajorVersion: "",
    ringNames: ["master"],
    variableGroups: [VARIABLE_GROUP],
  });
};

export const appRepo = async (
  gitApi: IGitApi,
  rc: RequestContext
): Promise<void> => {
  logger.info("Scaffolding app Repo");
  const repoName = APP_REPO;
  const curFolder = process.cwd();

  try {
    logger.info(`creating git repo ${repoName} in project ${rc.projectName}`);
    const git = await createRepo(
      gitApi,
      repoName,
      rc.projectName,
      rc.workspace
    );

    await projectInitialize(".", { defaultRing: "master" }); //How is master set normally?
    await setupVariableGroup(rc);
    await initService(rc, repoName);
    await git.add("./*");

    await commitAndPushToRemote(git, rc, repoName);

    rc.scaffoldAppService = true;
    logger.info("Completed scaffold app Repo");
  } finally {
    moveToAbsPath(curFolder);
  }
};
