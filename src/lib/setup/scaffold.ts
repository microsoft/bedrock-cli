import { IGitApi } from "azure-devops-node-api/GitApi";
import fs from "fs-extra";
import simplegit from "simple-git/promise";
import { initialize as hldInitialize } from "../../commands/hld/init";
import { logger } from "../../logger";
import {
  HLD_DEFAULT_COMPONENT_NAME,
  HLD_DEFAULT_DEF_PATH,
  HLD_DEFAULT_GIT_URL,
  HLD_REPO,
  IRequestContext,
  MANIFEST_REPO
} from "./constants";
import { createDirectory, moveToAbsPath, moveToRelativePath } from "./fsUtil";
import { createRepoInAzureOrg } from "./gitService";
import { commitAndPushToRemote } from "./gitService";

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
export const manifestRepo = async (gitApi: IGitApi, rc: IRequestContext) => {
  logger.info("Scaffolding Manifest Repo");
  const repoName = MANIFEST_REPO;
  const curFolder = process.cwd();

  try {
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
export const hldRepo = async (gitApi: IGitApi, rc: IRequestContext) => {
  logger.info("Scaffolding HLD Repo");
  const repoName = HLD_REPO;
  const curFolder = process.cwd();

  try {
    const git = await createRepo(
      gitApi,
      repoName,
      rc.projectName,
      rc.workspace
    );

    await hldInitialize(
      process.cwd(),
      false,
      HLD_DEFAULT_GIT_URL,
      HLD_DEFAULT_COMPONENT_NAME,
      HLD_DEFAULT_DEF_PATH
    );
    await git.add("./*");

    await commitAndPushToRemote(git, rc, repoName);
    rc.scaffoldHLD = true;
    logger.info("Completed scaffold HLD Repo");
  } finally {
    moveToAbsPath(curFolder);
  }
};
