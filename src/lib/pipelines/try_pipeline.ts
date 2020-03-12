/**
 * An example on how to create a pipeline against an azure devops git repository using the pipelines library.
 *
 * Set the appropriate environment variables to create a pipeline in azure devops. Then, run this file by invoking:
 *
 * `ts-node src/lib/pipelines/try_pipeline.ts`
 */

import {
  createPipelineForDefinition,
  definitionForAzureRepoPipeline,
  getBuildApiClient,
  queueBuild
} from "./pipelines";

const token = process.env.PERSONAL_ACCESS_TOKEN || "some-super-secret-token";
const orgName = process.env.AZURE_DEVOPS_ORG_NAME || "name-of-azure-devops-org";
const project = process.env.AZURE_DEVOPS_PROJECT || "my-devops-project";
const azdoRepoUrl = process.env.AZURE_GIT_REPO || "my-devops-git-url";
const azdoRepoName = process.env.AZURE_REPO_NAME || "azdo-test";
const pipelineName =
  process.env.AZURE_DEVOPS_PIPELINE_NAME || "pipeline-create-and-run";
const pipelineYamlPath =
  process.env.AZURE_DEVOPS_PIPELINE_YAML_PATH || "azure-pipelines.yml";

if (
  !token ||
  !orgName ||
  !project ||
  !azdoRepoUrl ||
  !azdoRepoName ||
  !pipelineName ||
  !pipelineYamlPath
) {
  console.log("An environment variable is not set!");
  process.exit(1);
}

const start = async (): Promise<void> => {
  const buildApi = await getBuildApiClient(orgName, token);

  const definition = definitionForAzureRepoPipeline({
    branchFilters: ["master"],
    maximumConcurrentBuilds: 1,
    pipelineName,
    repositoryName: azdoRepoName,
    repositoryUrl: azdoRepoUrl,
    yamlFileBranch: "master",
    yamlFilePath: pipelineYamlPath
  });

  try {
    const azDefinition = await createPipelineForDefinition(
      buildApi,
      project,
      definition
    );

    console.log(azDefinition);

    const buildDefinitionId = azDefinition.id as number;
    const build = await queueBuild(buildApi, project, buildDefinitionId);

    console.log(build);
  } catch (err) {
    console.log(err);
  }
};

start();
