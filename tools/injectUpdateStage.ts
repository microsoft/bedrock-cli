import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import commander from "commander";

import {
  generateYamlScript,
  SAFE_SOURCE_BRANCH,
  IMAGE_TAG,
  BUILD_REPO_NAME,
  IMAGE_REPO,
} from "../src/lib/fileutils";
import { assertIsStringWithContent } from "../src/lib/assertions";
import { AzurePipelinesYaml } from "../src/types";
import { VM_IMAGE } from "../src/lib/constants";

const updateStageYaml = (serviceName: string): string => {
  return generateYamlScript([
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
  ]);
};

const inject = (serviceName: string, pipelineFilePath: string): void => {
  const absPath = path.resolve(pipelineFilePath);
  const yamlStageContent = updateStageYaml(serviceName);

  const pipelineYaml: AzurePipelinesYaml = yaml.safeLoad(
    fs.readFileSync(absPath, "utf8")
  );

  pipelineYaml.stages?.push({
    stage: "hld_update",
    jobs: [
      {
        job: "update_image_tag",
        pool: {
          vmImage: VM_IMAGE,
        },
        steps: [
          {
            script: yamlStageContent,
            displayName: "HLD Update Stage",
          },
        ],
      },
    ],
  });

  fs.writeFileSync(
    absPath,
    yaml.safeDump(pipelineYaml, { lineWidth: Number.MAX_SAFE_INTEGER }),
    "utf8"
  );
};

commander
  .command("inject <serviceName> <pipelineFilePath>")
  .description(
    "This script injects the HLD update stage an existing azure devops build pipeline."
  )
  .usage("inject myServiceName /path/to/pipeline/file.yaml")
  .action((serviceName, pipelineFilePath, cmdObj) => {
    console.log(
      `Injecting HLD Update stage for service ${serviceName} with build pipeline path at ${pipelineFilePath}`
    );

    assertIsStringWithContent(serviceName);
    assertIsStringWithContent(pipelineFilePath);

    inject(serviceName, pipelineFilePath);
  });

commander.parse(process.argv);
