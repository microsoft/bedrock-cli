import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import { readYaml, write } from "../config";
import {
  ACCESS_FILENAME,
  BEDROCK_FILENAME,
  HELM_VERSION,
  HLD_COMPONENT_FILENAME,
  PROJECT_PIPELINE_FILENAME,
  RENDER_HLD_PIPELINE_FILENAME,
  SERVICE_PIPELINE_FILENAME,
  VERSION_MESSAGE,
  VM_IMAGE,
} from "../lib/constants";
import { build as buildError } from "../lib/errorBuilder";
import { errorStatusCode } from "../lib/errorStatusCode";
import { logger } from "../logger";
import {
  AccessYaml,
  AzurePipelinesYaml,
  ComponentYaml,
  MaintainersFile,
  User,
} from "../types";

/**
 * Read given pipeline file as json object.
 *
 * @param dir path
 * @param pipelineFileName pipeline definition filename. Should be a value from "../lib/constants"
 */
const readPipelineFile = (
  dir: string,
  pipelineFileName: string
): AzurePipelinesYaml => {
  const absPath = path.resolve(dir);
  const file = path.join(absPath, pipelineFileName);
  return yaml.safeLoad(fs.readFileSync(file, "utf8"));
};

/**
 * Create an access.yaml file for fabrikate authorization.
 * Should only be used by spk hld reconcile, which is an idempotent operation, but will not overwrite existing access.yaml keys
 * @param accessYamlPath
 * @param gitRepoUrl
 * @param accessTokenEnvVar the environment variable to which will contain the PAT
 */
export const generateAccessYaml = (
  accessYamlPath: string,
  gitRepoUrl: string,
  accessTokenEnvVar = "ACCESS_TOKEN_SECRET"
): void => {
  const filePath = path.resolve(path.join(accessYamlPath, ACCESS_FILENAME));
  let accessYaml: AccessYaml | undefined;

  if (fs.existsSync(filePath)) {
    logger.info(
      `Existing ${ACCESS_FILENAME} found at ${filePath}, loading and updating, if needed.`
    );
    accessYaml = yaml.load(fs.readFileSync(filePath, "utf8")) as AccessYaml;
    accessYaml = {
      [gitRepoUrl]: accessTokenEnvVar,
      ...accessYaml, // Keep any existing configurations. Do not overwrite what's in `gitRepoUrl`.
    };
  } else {
    accessYaml = {
      [gitRepoUrl]: accessTokenEnvVar,
    };
  }

  // Always overwrite what exists.
  fs.writeFileSync(
    filePath,
    yaml.safeDump(accessYaml, { lineWidth: Number.MAX_SAFE_INTEGER }),
    "utf8"
  );
};

/**
 * Outputs a bash string for a _safe_ source branch string -- a string where all
 * '/', '.', and '_' in the string have been replaced with a '-'`
 */

export const SAFE_SOURCE_BRANCH = `$(echo $(Build.SourceBranchName) | tr / - | tr . - | tr _ - )`;

/**
 * Outputs a bash script to generate a _safe_ azure container registry url where it's all lowercase.
 * This will require ACR_NAME as an environment variable.
 */
export const IMAGE_REPO = `$(echo $(ACR_NAME).azurecr.io | tr '[:upper:]' '[:lower:]')`;

/**
 * Outputs a bash string for a _safe_ image tag -- a string where all
 * '/' and '.' in the string have been replaced with a '-'`
 */
export const IMAGE_TAG = `${SAFE_SOURCE_BRANCH}-$(Build.BuildNumber)`;

/**
 * Outputs a bash string of `<repository>-<service-name>` in lowercase
 *
 * @param serviceName name of the service being built
 */
export const BUILD_REPO_NAME = (serviceName: string): string =>
  `$(echo $(Build.Repository.Name)-${serviceName} | tr '[:upper:]' '[:lower:]')`;

/**
 * Concatenates all lines into a single string and injects `set -e` to the top
 * of it
 *
 * @param lines lines of script to execute
 */
export const generateYamlScript = (lines: string[]): string =>
  ["set -e", ...lines].join("\n");

/**
 * Sanitize the given path to format Azure DevOps can properly utilize
 *
 * Transforms:
 * - If present, removes leading dot-slash (`./`) prefix from the path
 *
 * @param pathLike a path-like string to sanitize
 */
export const sanitizeTriggerPath = (pathLike: string): string => {
  return pathLike.replace(/^\.\//, "");
};

/**
 * Returns a build-update-hld-pipeline.yaml string
 * based on: https://github.com/andrebriggs/monorepo-example/blob/master/service-A/azure-pipelines.yml
 *
 * @param serviceName
 * @param relServicePath
 * @param ringBranches
 * @param variableGroups
 */
export const serviceBuildAndUpdatePipeline = (
  serviceName: string,
  relServicePath: string,
  ringBranches: string[],
  variableGroups?: string[],
  serviceBuildVg?: string[],
  serviceBuildVariables?: string[]
): AzurePipelinesYaml => {
  const relativeServicePathFormatted = sanitizeTriggerPath(relServicePath);
  const relativeServiceForDockerfile = relServicePath.startsWith("./")
    ? relServicePath
    : "./" + relServicePath;
  const test = (serviceBuildVariables ?? []).map((group) => ({ group }));
  logger.info(`${test}`);

  const pipelineYaml: AzurePipelinesYaml = {
    trigger: {
      branches: { include: [...new Set(ringBranches)] },
      ...(relativeServicePathFormatted === ""
        ? {}
        : {
            paths: {
              include: [relativeServicePathFormatted],
              exclude: [BEDROCK_FILENAME],
            },
          }),
    },
    variables: [
      ...(variableGroups ?? []).map((group) => ({ group })),
      ...(serviceBuildVg ?? []).map((group) => ({ group })),
    ],
    stages: [
      {
        // Build stage
        stage: "build",
        jobs: [
          {
            job: "run_build_push_acr",
            pool: {
              vmImage: VM_IMAGE,
            },
            steps: [
              {
                task: "HelmInstaller@1",
                inputs: {
                  helmVersionToInstall: HELM_VERSION,
                },
              },
              {
                script: generateYamlScript([
                  `echo "az login --service-principal --username $(SP_APP_ID) --password $(SP_PASS) --tenant $(SP_TENANT)"`,
                  `az login --service-principal --username "$(SP_APP_ID)" --password "$(SP_PASS)" --tenant "$(SP_TENANT)"`,
                ]),
                displayName: "Azure Login",
              },
              {
                script: generateYamlScript([
                  `# Download build.sh`,
                  `curl $BEDROCK_BUILD_SCRIPT > build.sh`,
                  `chmod +x ./build.sh`,
                ]),
                displayName: "Download bedrock bash scripts",
                env: {
                  BEDROCK_BUILD_SCRIPT: "$(BUILD_SCRIPT_URL)",
                },
              },
              {
                script: generateYamlScript([
                  `. ./build.sh --source-only`,
                  `get_spk_version`,
                  `download_spk`,
                  `export BUILD_REPO_NAME=${BUILD_REPO_NAME(serviceName)}`,
                  `tag_name="$BUILD_REPO_NAME:${IMAGE_TAG}"`,
                  `commitId=$(Build.SourceVersion)`,
                  `commitId=$(echo "\${commitId:0:7}")`,
                  `service=$(./spk/spk service get-display-name -p ${relativeServiceForDockerfile})`,
                  `url=$(git remote --verbose | grep origin | grep fetch | cut -f2 | cut -d' ' -f1)`,
                  `repourl=\${url##*@}`,
                  `./spk/spk deployment create -n $(INTROSPECTION_ACCOUNT_NAME) -k $(INTROSPECTION_ACCOUNT_KEY) -t $(INTROSPECTION_TABLE_NAME) -p $(INTROSPECTION_PARTITION_KEY) --p1 $(Build.BuildId) --image-tag $tag_name --commit-id $commitId --service $service --repository $repourl`,
                ]),
                displayName:
                  "If configured, update Spektate storage with build pipeline",
                condition:
                  "and(ne(variables['INTROSPECTION_ACCOUNT_NAME'], ''), ne(variables['INTROSPECTION_ACCOUNT_KEY'], ''),ne(variables['INTROSPECTION_TABLE_NAME'], ''),ne(variables['INTROSPECTION_PARTITION_KEY'], ''))",
              },
              {
                script: generateYamlScript([
                  // Iterate through serviceBuildVariables, export each variable, then append as build argument
                  `ACR_BUILD_BASE_COMMAND='az acr build -r $(ACR_NAME) --image $IMAGE_NAME .'`,
                  `SERVICE_BUILD_VARIABLES=$(echo ${serviceBuildVariables} | tr "," " " )`,
                  `echo "Service Variables: $SERVICE_BUILD_VARIABLES`,
                  `VARIABLES_ARRAY=(echo $SERVICE_BUILD_VARIABLES)`,
                  `for i in \${VARIABLES_ARRAY[@]}; do export $i=\${i} ; ACR_BUILD_BASE_COMMAND+=" --build-arg $i=\${i}" ; done`,
                  `export BUILD_REPO_NAME=${BUILD_REPO_NAME(serviceName)}`,
                  `export IMAGE_TAG=${IMAGE_TAG}`,
                  `export IMAGE_NAME=$BUILD_REPO_NAME:$IMAGE_TAG`,
                  `echo "Image Name: $IMAGE_NAME"`,
                  `cd ${relativeServiceForDockerfile}`,
                  `echo "az acr build -r $(ACR_NAME) --image $IMAGE_NAME ."`,
                  `az acr build -r $(ACR_NAME) --image $IMAGE_NAME .`,
                ]),
                displayName: "ACR Build and Publish",
              },
            ],
          },
        ],
      },
      {
        // Update HLD Stage
        stage: "hld_update",
        dependsOn: "build",
        condition: "succeeded('build')",
        jobs: [
          {
            job: "update_image_tag",
            pool: {
              vmImage: VM_IMAGE,
            },
            steps: [
              {
                task: "HelmInstaller@1",
                inputs: {
                  helmVersionToInstall: HELM_VERSION,
                },
              },
              {
                script: generateYamlScript([
                  `# Download build.sh`,
                  `curl $BEDROCK_BUILD_SCRIPT > build.sh`,
                  `chmod +x ./build.sh`,
                ]),
                displayName: "Download bedrock bash scripts",
                env: {
                  BEDROCK_BUILD_SCRIPT: "$(BUILD_SCRIPT_URL)",
                },
              },
              {
                script: generateYamlScript([
                  `export SERVICE_NAME_LOWER=$(echo ${serviceName} | tr '[:upper:]' '[:lower:]')`,
                  `export BUILD_REPO_NAME=${BUILD_REPO_NAME(serviceName)}`,
                  `export BRANCH_NAME=DEPLOY/$BUILD_REPO_NAME-${IMAGE_TAG}`,
                  `export FAB_SAFE_SERVICE_NAME=$(echo $SERVICE_NAME_LOWER | tr . - | tr / -)`,
                  `# --- From https://raw.githubusercontent.com/Microsoft/bedrock/master/gitops/azure-devops/release.sh`,
                  `. build.sh --source-only`,
                  ``,
                  `# Initialization`,
                  `verify_access_token`,
                  `init`,
                  `helm_init`,
                  ``,
                  `# Fabrikate`,
                  `get_fab_version`,
                  `download_fab`,
                  ``,
                  `# Clone HLD repo`,
                  `git_connect`,
                  `# --- End Script`,
                  ``,
                  `# Update HLD`,
                  `git checkout -b "$BRANCH_NAME"`,
                  `export BUILD_REPO_NAME=${BUILD_REPO_NAME(serviceName)}`,
                  `export IMAGE_TAG=${IMAGE_TAG}`,
                  `export IMAGE_NAME=$BUILD_REPO_NAME:$IMAGE_TAG`,
                  `echo "Image Name: $IMAGE_NAME"`,
                  `export IMAGE_REPO=${IMAGE_REPO}`,
                  `echo "Image Repository: $IMAGE_REPO"`,
                  `cd $(Build.Repository.Name)/$FAB_SAFE_SERVICE_NAME/${SAFE_SOURCE_BRANCH}`,
                  `echo "FAB SET"`,
                  `fab set --subcomponent chart image.tag=$IMAGE_TAG image.repository=$IMAGE_REPO/$BUILD_REPO_NAME`,
                  ``,
                  `# Set git identity`,
                  `git config user.email "admin@azuredevops.com"`,
                  `git config user.name "Automated Account"`,
                  ``,
                  `# Commit changes`,
                  `echo "GIT ADD and COMMIT -- Will throw error if there is nothing to commit."`,
                  `git_commit_if_changes "Updating $SERVICE_NAME_LOWER image tag to ${IMAGE_TAG}." 1 unusedVar`,
                  ``,
                  `# Git Push`,
                  `git_push`,
                  ``,
                  `# Open PR via az repo cli`,
                  `echo 'az extension add --name azure-devops'`,
                  `az extension add --name azure-devops`,
                  ``,
                  `echo 'az repos pr create --description "Updating $SERVICE_NAME_LOWER to ${IMAGE_TAG}." "PR created by: $(Build.DefinitionName) with buildId: $(Build.BuildId) and buildNumber: $(Build.BuildNumber)"'`,
                  `response=$(az repos pr create --description "Updating $SERVICE_NAME_LOWER to ${IMAGE_TAG}." "PR created by: $(Build.DefinitionName) with buildId: $(Build.BuildId) and buildNumber: $(Build.BuildNumber)")`,
                  `pr_id=$(echo $response | jq -r '.pullRequestId')`,
                  ``,
                  `# Update introspection storage with this information, if applicable`,
                  `if [ -z "$(INTROSPECTION_ACCOUNT_NAME)" -o -z "$(INTROSPECTION_ACCOUNT_KEY)" -o -z "$(INTROSPECTION_TABLE_NAME)" -o -z "$(INTROSPECTION_PARTITION_KEY)" ]; then`,
                  `echo "Introspection variables are not defined. Skipping..."`,
                  `else`,
                  `latest_commit=$(git rev-parse --short HEAD)`,
                  `tag_name="$BUILD_REPO_NAME:$(Build.SourceBranchName)-$(Build.BuildNumber)"`,
                  `url=$(git remote --verbose | grep origin | grep fetch | cut -f2 | cut -d' ' -f1)`,
                  `repourl=\${url##*@}`,
                  `get_spk_version`,
                  `download_spk`,
                  `./spk/spk deployment create  -n $(INTROSPECTION_ACCOUNT_NAME) -k $(INTROSPECTION_ACCOUNT_KEY) -t $(INTROSPECTION_TABLE_NAME) -p $(INTROSPECTION_PARTITION_KEY) --p2 $(Build.BuildId) --hld-commit-id $latest_commit --env $(Build.SourceBranchName) --image-tag $tag_name --pr $pr_id --repository $repourl`,
                  `fi`,
                ]),
                displayName:
                  "Download Fabrikate, Update HLD, Push changes, Open PR, and if configured, push to Spektate storage",
                env: {
                  ACCESS_TOKEN_SECRET: "$(PAT)",
                  AZURE_DEVOPS_EXT_PAT: "$(PAT)",
                  REPO: "$(HLD_REPO)",
                },
              },
            ],
          },
        ],
      },
    ],
  };

  const requiredPipelineVariables = [
    `'ACR_NAME' (name of your ACR)`,
    `'HLD_REPO' (Repository for your HLD in AzDo. eg. 'dev.azure.com/bhnook/fabrikam/_git/hld')`,
    `'PAT' (AzDo Personal Access Token with permissions to the HLD repository.)`,
    `'SP_APP_ID' (service principal ID with access to your ACR)`,
    `'SP_PASS' (service principal secret)`,
    `'SP_TENANT' (service principal tenant)`,
  ].join(", ");

  const spkServiceBuildPipelineCmd =
    "spk service install-build-pipeline " + serviceName;
  logger.info(
    `Generated ${SERVICE_PIPELINE_FILENAME} for service in path '${relativeServicePathFormatted}'. Commit and push this file to master before attempting to deploy via the command '${spkServiceBuildPipelineCmd}'; before running the pipeline ensure the following environment variables are available to your project variable groups: ${requiredPipelineVariables}`
  );

  return pipelineYaml;
};

/**
 * Gets the spk version
 */
export const getVersion = (): string => {
  return require("../../package.json").version;
};

/**
 * Gets the spk version message
 */
export const getVersionMessage = (): string => {
  return VERSION_MESSAGE + getVersion();
};

/**
 * Writes the spk version to the given file
 * @param filePath The path to the file
 */
export const writeVersion = (filePath: string): void => {
  fs.writeFileSync(filePath, `${getVersionMessage()}\n`, "utf8");
};

/**
 * Creates the service multistage build and update image tag pipeline.
 * One pipeline should exist for each service.
 *
 * @param projectRoot Full path to the root of the project (where the bedrock.yaml file exists)
 * @param ringBranches Branches to trigger builds off of. Should be all the defined rings for this service.
 * @param serviceName
 * @param servicePath Full path to service directory
 * @param variableGroups Azure DevOps variable group names
 */
export const generateServiceBuildAndUpdatePipelineYaml = (
  projectRoot: string,
  ringBranches: string[],
  serviceName: string,
  servicePath: string,
  variableGroups: string[],
  serviceVgArray: string[],
  serviceVariablesArray: string[]
): void => {
  const absProjectRoot = path.resolve(projectRoot);
  const absServicePath = path.resolve(servicePath);

  logger.info(`Generating ${SERVICE_PIPELINE_FILENAME} in ${absServicePath}`);

  logger.debug(`variableGroups length: ${variableGroups?.length}`);

  // Check if build-update-hld-pipeline.yaml already exists; if it does, skip generation
  const pipelineYamlFullPath = path.join(
    absServicePath,
    SERVICE_PIPELINE_FILENAME
  );
  logger.debug(
    `Writing ${SERVICE_PIPELINE_FILENAME} file to ${pipelineYamlFullPath}`
  );

  if (fs.existsSync(pipelineYamlFullPath)) {
    logger.warn(
      `Existing ${SERVICE_PIPELINE_FILENAME} found at ${pipelineYamlFullPath}, skipping generation.`
    );
    return;
  }

  const buildYaml = serviceBuildAndUpdatePipeline(
    serviceName,
    path.relative(absProjectRoot, absServicePath),
    ringBranches,
    variableGroups,
    serviceVgArray,
    serviceVariablesArray
  );

  writeVersion(pipelineYamlFullPath);
  fs.appendFileSync(
    pipelineYamlFullPath,
    yaml.safeDump(buildYaml, { lineWidth: Number.MAX_SAFE_INTEGER }),
    "utf8"
  );
};

/**
 * Updates the service build and update pipeline with the given rings list
 *
 * @param ringBranches Branches to trigger builds off of. Should be all the defined rings for this project.
 * @param servicePath Full path to service directory
 */
export const updateTriggerBranchesForServiceBuildAndUpdatePipeline = (
  ringBranches: string[],
  servicePath: string
): void => {
  const absServicePath = path.resolve(servicePath);

  const pipelineYamlFullPath = path.join(
    absServicePath,
    SERVICE_PIPELINE_FILENAME
  );

  // Check if build-update-hld-pipeline.yaml already exists; if it doesn't, throw error.
  if (!fs.existsSync(pipelineYamlFullPath)) {
    throw buildError(errorStatusCode.FILE_IO_ERR, {
      errorKey: "fileutils-update-ring-trigger-svc-file-not-found",
      values: [SERVICE_PIPELINE_FILENAME, pipelineYamlFullPath],
    });
  }

  logger.info(
    `Updating ${pipelineYamlFullPath} file with trigger rings: ${ringBranches}.`
  );

  const buildPipelineYaml: AzurePipelinesYaml = readPipelineFile(
    servicePath,
    SERVICE_PIPELINE_FILENAME
  );

  if (buildPipelineYaml.trigger && buildPipelineYaml.trigger.branches) {
    buildPipelineYaml.trigger.branches.include = ringBranches;
  }

  writeVersion(pipelineYamlFullPath);
  fs.appendFileSync(
    pipelineYamlFullPath,
    yaml.safeDump(buildPipelineYaml, { lineWidth: Number.MAX_SAFE_INTEGER }),
    "utf8"
  );
};

/**
 * Appends a variable group an Azure pipeline yaml
 * @param dir The directory where the pipeline yaml file is
 * @param pipelineFile The name of the pipeline yaml file
 * @param variableGroupName The name of the variable group to be added
 */
export const appendVariableGroupToPipelineYaml = (
  dir: string,
  fileName: string,
  variableGroupName: string
): void => {
  try {
    const pipelineFile = readYaml(
      path.join(dir, fileName)
    ) as AzurePipelinesYaml;
    pipelineFile.variables = pipelineFile.variables || [];
    let variableGroupExists = false;

    pipelineFile.variables.forEach((variable) => {
      if ("group" in variable && variable.group === variableGroupName) {
        variableGroupExists = true;
        logger.info(
          `Variable group '${variableGroupName}' already exits in '${dir}/${fileName}'.`
        );
      }
    });

    if (!variableGroupExists) {
      pipelineFile.variables.push({ group: variableGroupName });

      logger.info(`Updating '${dir}/${fileName}'.`);
      write(pipelineFile, dir, fileName);
    }
  } catch (err) {
    throw buildError(
      errorStatusCode.FILE_IO_ERR,
      "fileutils-append-variable-group-to-pipeline-yaml",
      err
    );
  }
};

/**
 * Returns a the Manifest Generation Pipeline as defined here: https://github.com/microsoft/bedrock/blob/master/gitops/azure-devops/ManifestGeneration.md#add-azure-pipelines-build-yaml
 */
const manifestGenerationPipelineYaml = (): string => {
  // based on https://github.com/microsoft/bedrock/blob/master/gitops/azure-devops/ManifestGeneration.md#add-azure-pipelines-build-yaml
  const pipelineYaml: AzurePipelinesYaml = {
    trigger: {
      branches: {
        include: ["master"],
      },
    },
    variables: [],
    pool: {
      vmImage: VM_IMAGE,
    },
    steps: [
      {
        checkout: "self",
        persistCredentials: true,
        clean: true,
      },
      {
        task: "HelmInstaller@1",
        inputs: {
          helmVersionToInstall: HELM_VERSION,
        },
      },
      {
        script: generateYamlScript([
          `# Download build.sh`,
          `curl $BEDROCK_BUILD_SCRIPT > build.sh`,
          `chmod +x ./build.sh`,
        ]),
        displayName: "Download bedrock bash scripts",
        env: {
          BEDROCK_BUILD_SCRIPT: "$(BUILD_SCRIPT_URL)",
        },
      },
      {
        script: generateYamlScript([
          `commitId=$(Build.SourceVersion)`,
          `commitId=$(echo "\${commitId:0:7}")`,
          `. ./build.sh --source-only`,
          `get_spk_version`,
          `download_spk`,
          `message="$(Build.SourceVersionMessage)"`,
          `if [[ $message == *"Merge"* ]]; then`,
          `pr_id=$(echo $message | grep -oE '[0-9]+' | head -1 | sed -e 's/^0\\+//')`,
          `./spk/spk deployment create -n $(INTROSPECTION_ACCOUNT_NAME) -k $(INTROSPECTION_ACCOUNT_KEY) -t $(INTROSPECTION_TABLE_NAME) -p $(INTROSPECTION_PARTITION_KEY) --p3 $(Build.BuildId) --hld-commit-id $commitId --pr $pr_id`,
          `else`,
          `./spk/spk deployment create -n $(INTROSPECTION_ACCOUNT_NAME) -k $(INTROSPECTION_ACCOUNT_KEY) -t $(INTROSPECTION_TABLE_NAME) -p $(INTROSPECTION_PARTITION_KEY) --p3 $(Build.BuildId) --hld-commit-id $commitId`,
          `fi`,
        ]),
        displayName:
          "If configured, update manifest pipeline details in Spektate db before manifest generation",
        condition:
          "and(ne(variables['INTROSPECTION_ACCOUNT_NAME'], ''), ne(variables['INTROSPECTION_ACCOUNT_KEY'], ''),ne(variables['INTROSPECTION_TABLE_NAME'], ''),ne(variables['INTROSPECTION_PARTITION_KEY'], ''), ne(variables['Build.Reason'], 'PullRequest'))",
      },
      {
        task: "ShellScript@2",
        displayName: "Validate fabrikate definitions",
        inputs: {
          scriptPath: "build.sh",
        },
        condition: `eq(variables['Build.Reason'], 'PullRequest')`,
        env: {
          VERIFY_ONLY: 1,
        },
      },
      {
        task: "ShellScript@2",
        displayName:
          "Transform fabrikate definitions and publish to YAML manifests to repo",
        inputs: {
          scriptPath: "build.sh",
        },
        condition: `ne(variables['Build.Reason'], 'PullRequest')`,
        env: {
          ACCESS_TOKEN_SECRET: "$(PAT)",
          COMMIT_MESSAGE: "$(Build.SourceVersionMessage)",
          REPO: "$(MANIFEST_REPO)",
          BRANCH_NAME: "$(Build.SourceBranchName)",
        },
      },
      {
        script: generateYamlScript([
          `. ./build.sh --source-only`,
          `cd "$HOME"/\${MANIFEST_REPO##*/}`,
          `latest_commit=$(git rev-parse --short HEAD)`,
          `url=$(git remote --verbose | grep origin | grep fetch | cut -f2 | cut -d' ' -f1)`,
          `repourl=\${url##*@}`,
          `get_spk_version`,
          `download_spk`,
          `./spk/spk deployment create -n $(INTROSPECTION_ACCOUNT_NAME) -k $(INTROSPECTION_ACCOUNT_KEY) -t $(INTROSPECTION_TABLE_NAME) -p $(INTROSPECTION_PARTITION_KEY) --p3 $(Build.BuildId) --manifest-commit-id $latest_commit --repository $repourl`,
        ]),
        displayName:
          "If configured, update manifest pipeline details in Spektate db after manifest generation",
        condition:
          "and(ne(variables['INTROSPECTION_ACCOUNT_NAME'], ''), ne(variables['INTROSPECTION_ACCOUNT_KEY'], ''),ne(variables['INTROSPECTION_TABLE_NAME'], ''),ne(variables['INTROSPECTION_PARTITION_KEY'], ''), ne(variables['Build.Reason'], 'PullRequest'))",
      },
    ],
  };

  return yaml.safeDump(pipelineYaml, { lineWidth: Number.MAX_SAFE_INTEGER });
};

/**
 * Writes out the hld manifest-generation.yaml file to `targetPath`
 *
 * @param hldRepoDirectory Path to write the manifest-generation.yaml file to
 */
export const generateHldAzurePipelinesYaml = (
  targetDirectory: string
): void => {
  try {
    const absTargetPath = path.resolve(targetDirectory);
    logger.info(`Generating hld manifest-generation in ${absTargetPath}`);

    const azurePipelinesYamlPath = path.join(
      absTargetPath,
      RENDER_HLD_PIPELINE_FILENAME
    );

    if (fs.existsSync(azurePipelinesYamlPath)) {
      logger.warn(
        `Existing ${RENDER_HLD_PIPELINE_FILENAME} found at ${azurePipelinesYamlPath}, skipping generation.`
      );
      return;
    }
    const hldYaml = manifestGenerationPipelineYaml();
    logger.info(
      `Writing ${RENDER_HLD_PIPELINE_FILENAME} file to ${azurePipelinesYamlPath}`
    );

    const requiredPipelineVariables = [
      `'MANIFEST_REPO' (Repository for your kubernetes manifests in AzDo. eg. 'dev.azure.com/bhnook/fabrikam/_git/materialized')`,
      `'PAT' (AzDo Personal Access Token with permissions to the HLD repository.)`,
    ].join(", ");

    logger.info(
      `Generated ${RENDER_HLD_PIPELINE_FILENAME}. Commit and push this file to master before attempting to deploy via the command 'spk hld install-manifest-pipeline'; before running the pipeline ensure the following environment variables are available to your pipeline: ${requiredPipelineVariables}`
    );

    writeVersion(azurePipelinesYamlPath);
    fs.appendFileSync(azurePipelinesYamlPath, hldYaml, "utf8");
  } catch (err) {
    throw buildError(
      errorStatusCode.FILE_IO_ERR,
      "fileutils-generate-hld-pipeline-yaml",
      err
    );
  }
};

/**
 * Populate the hld's default component.yaml
 */
const defaultComponentYaml = (
  componentGit: string,
  componentName: string,
  componentPath: string
): ComponentYaml => {
  const componentYaml: ComponentYaml = {
    name: "default-component",
    subcomponents: [
      {
        name: componentName,
        method: "git",
        source: componentGit,
        path: componentPath,
      },
    ],
  };

  return componentYaml;
};

/**
 * Add a default component.yaml when running `hld init`.
 */
export const generateDefaultHldComponentYaml = (
  targetDirectory: string,
  componentGit: string,
  componentName: string,
  componentPath: string
): void => {
  try {
    const absTargetPath = path.resolve(targetDirectory);
    logger.info(`Generating component.yaml in ${absTargetPath}`);

    const fabrikateComponentPath = path.join(absTargetPath, "component.yaml");

    if (fs.existsSync(fabrikateComponentPath)) {
      logger.warn(
        `Existing component.yaml found at ${fabrikateComponentPath}, skipping generation.`
      );
      return;
    }

    const componentYaml = defaultComponentYaml(
      componentGit,
      componentName,
      componentPath
    );

    logger.info(
      `Writing ${HLD_COMPONENT_FILENAME} file to ${fabrikateComponentPath}`
    );

    fs.writeFileSync(
      fabrikateComponentPath,
      yaml.safeDump(componentYaml, { lineWidth: Number.MAX_SAFE_INTEGER }),
      "utf8"
    );
  } catch (err) {
    throw buildError(
      errorStatusCode.FILE_IO_ERR,
      "fileutils-generate-default-hld-component-yaml",
      err
    );
  }
};

const hldLifecyclePipelineYaml = (): string => {
  const pipelineyaml: AzurePipelinesYaml = {
    trigger: {
      branches: {
        include: ["master"],
      },
      paths: {
        include: ["bedrock.yaml"],
      },
    },
    variables: [],
    pool: {
      vmImage: VM_IMAGE,
    },
    steps: [
      {
        task: "HelmInstaller@1",
        inputs: {
          helmVersionToInstall: HELM_VERSION,
        },
      },
      {
        script: generateYamlScript([
          `# Download build.sh`,
          `curl $BEDROCK_BUILD_SCRIPT > build.sh`,
          `chmod +x ./build.sh`,
        ]),
        displayName: "Download bedrock bash scripts",
        env: {
          BEDROCK_BUILD_SCRIPT: "$(BUILD_SCRIPT_URL)",
        },
      },
      {
        script: generateYamlScript([
          `# From https://raw.githubusercontent.com/Microsoft/bedrock/master/gitops/azure-devops/release.sh`,
          `. build.sh --source-only`,
          ``,
          `# Initialization`,
          `verify_access_token`,
          `init`,
          `helm_init`,
          ``,
          `# Fabrikate`,
          `get_fab_version`,
          `download_fab`,
          ``,
          `# SPK`,
          `get_spk_version`,
          `download_spk`,
          ``,
          `# Clone HLD repo`,
          `git_connect`,
          ``,
          `# Update HLD via spk`,
          `git checkout -b "RECONCILE/$(Build.Repository.Name)-$(Build.BuildNumber)"`,
          `echo "spk hld reconcile $(Build.Repository.Name) $PWD ./.."`,
          `spk hld reconcile $(Build.Repository.Name) $PWD ./..`,
          ``,
          `# Set git identity`,
          `git config user.email "admin@azuredevops.com"`,
          `git config user.name "Automated Account"`,
          ``,
          `# Commit changes`,
          `echo "GIT ADD and COMMIT -- Will NOT throw error if there is nothing to commit."`,
          `didCommit=0`,
          `git_commit_if_changes "Reconciling HLD with $(Build.Repository.Name)-$(Build.BuildNumber)." 0 didCommit`,
          ``,
          `# Skip push and opening PR steps if there were no changes changes to commit.`,
          `if [ $didCommit == 0 ]; then`,
          `echo "DID NOT FIND CHANGES TO COMMIT. EXITING."`,
          `exit 0`,
          `fi`,
          ``,
          `# Git Push`,
          `git_push`,
          ``,
          `# Open PR via az repo cli`,
          `echo 'az extension add --name azure-devops'`,
          `az extension add --name azure-devops`,
          ``,
          `echo 'az repos pr create --description "Reconciling HLD with $(Build.Repository.Name)-$(Build.BuildNumber)." "PR created by: $(Build.DefinitionName) with buildId: $(Build.BuildId) and buildNumber: $(Build.BuildNumber)"'`,
          `az repos pr create --description "Reconciling HLD with $(Build.Repository.Name)-$(Build.BuildNumber)." "PR created by: $(Build.DefinitionName) with buildId: $(Build.BuildId) and buildNumber: $(Build.BuildNumber)"`,
        ]),
        displayName:
          "Download Fabrikate and SPK, Update HLD, Push changes, Open PR",
        env: {
          ACCESS_TOKEN_SECRET: "$(PAT)",
          APP_REPO_URL: "$(Build.Repository.Uri)",
          AZURE_DEVOPS_EXT_PAT: "$(PAT)",
          REPO: "$(HLD_REPO)",
        },
      },
    ],
  };

  return yaml.safeDump(pipelineyaml, { lineWidth: Number.MAX_SAFE_INTEGER });
};

/**
 * Writes out the service to hld lifecycle pipeline.
 * This pipeline utilizes spk hld reconcile to add/remove services from the hld repository.
 *
 * @param projectRoot
 */
export const generateHldLifecyclePipelineYaml = async (
  projectRoot: string
): Promise<void> => {
  logger.info(
    `Generating hld lifecycle pipeline ${PROJECT_PIPELINE_FILENAME} in ${projectRoot}`
  );

  const azurePipelinesYamlPath = path.join(
    projectRoot,
    PROJECT_PIPELINE_FILENAME
  );

  if (fs.existsSync(azurePipelinesYamlPath)) {
    logger.warn(
      `Existing ${PROJECT_PIPELINE_FILENAME} found at ${azurePipelinesYamlPath}, skipping generation.`
    );

    return;
  }

  const lifecycleYaml = hldLifecyclePipelineYaml();
  logger.info(
    `Writing ${PROJECT_PIPELINE_FILENAME} file to ${azurePipelinesYamlPath}`
  );

  writeVersion(azurePipelinesYamlPath);
  fs.appendFileSync(azurePipelinesYamlPath, lifecycleYaml, "utf8");

  const requiredPipelineVariables = [
    `'HLD_REPO' (Repository for your HLD in AzDo. eg. 'dev.azure.com/bhnook/fabrikam/_git/hld')`,
    `'PAT' (AzDo Personal Access Token with permissions to the HLD repository.)`,
  ].join(", ");

  logger.info(
    `Generated ${PROJECT_PIPELINE_FILENAME}. Commit and push this file to master before attempting to deploy via the command 'spk project install-lifecycle-pipeline'; before running the pipeline ensure the following environment variables are available to your pipeline: ${requiredPipelineVariables}`
  );
};

/**
 * Update maintainers.yml with new service
 *
 * TODO: support for contributors(?)
 *
 * @param maintainersFilePath
 * @param newServicePath
 * @param serviceMaintainers
 */
export const addNewServiceToMaintainersFile = (
  maintainersFilePath: string,
  newServicePath: string,
  serviceMaintainers: User[]
): void => {
  const maintainersFile = yaml.safeLoad(
    fs.readFileSync(maintainersFilePath, "utf8")
  ) as MaintainersFile;

  maintainersFile.services["./" + newServicePath] = {
    maintainers: serviceMaintainers,
  };

  logger.info("Updating maintainers.yaml");
  fs.writeFileSync(maintainersFilePath, yaml.safeDump(maintainersFile), "utf8");
};

/**
 * Writes out a default .gitignore file if one doesn't exist
 *
 * @param targetDirectory directory to generate the .gitignore file
 * @param content content of file
 */
export const generateGitIgnoreFile = (
  targetDirectory: string,
  content: string
): void => {
  const absTargetPath = path.resolve(targetDirectory);
  logger.info(`Generating starter .gitignore in ${absTargetPath}`);

  try {
    const gitIgnoreFilePath = path.join(absTargetPath, ".gitignore");

    if (fs.existsSync(gitIgnoreFilePath)) {
      logger.warn(
        `Existing .gitignore found at ${gitIgnoreFilePath}, skipping generation.`
      );
      return;
    }

    logger.info(`Writing .gitignore file to ${gitIgnoreFilePath}`);
    fs.writeFileSync(gitIgnoreFilePath, content, "utf8");
  } catch (err) {
    throw buildError(
      errorStatusCode.FILE_IO_ERR,
      {
        errorKey: "fileutils-generate-git-ignore-file",
        values: [absTargetPath],
      },
      err
    );
  }
};

/**
 * Writes out a default Dockerfile if one doesn't exist
 *
 * @param targetDirectory directory to generate the Dockerfile
 * @param content content of file
 */
export const generateDockerfile = (targetDirectory: string): void => {
  const absTargetPath = path.resolve(targetDirectory);
  logger.info(`Generating starter Dockerfile in ${absTargetPath}`);

  const dockerfilePath = path.join(absTargetPath, "Dockerfile");

  if (fs.existsSync(dockerfilePath)) {
    logger.warn(
      `Existing Dockerfile found at ${dockerfilePath}, skipping generation.`
    );

    return;
  }

  logger.info(`Writing Dockerfile to ${dockerfilePath}`);
  fs.writeFileSync(
    dockerfilePath,
    "FROM alpine\nRUN echo 'hello world'",
    "utf8"
  );
};
