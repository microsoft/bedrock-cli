import yaml from "js-yaml";
import { HELM_VERSION, VM_IMAGE, BEDROCK_FILENAME } from "../lib/constants";
import {
  BUILD_REPO_NAME,
  generateYamlScript,
  sanitizeTriggerPath,
  IMAGE_REPO,
  IMAGE_TAG,
  SAFE_SOURCE_BRANCH,
} from "../lib/fileutils";
import {
  AzurePipelinesYaml,
  BedrockFile,
  ComponentYaml,
  HelmConfig,
  MaintainersFile,
} from "../types";

export const createTestServiceBuildAndUpdatePipelineYaml = (
  asString = true,
  serviceName = "my-service",
  relativeServicePathFormatted = "./my-service",
  ringBranches: string[] = ["master", "qa", "test"],
  variableGroups: string[] = []
): AzurePipelinesYaml | string => {
  const relativeServiceForDockerfile = relativeServicePathFormatted.startsWith(
    "./"
  )
    ? relativeServicePathFormatted
    : "./" + relativeServicePathFormatted;

  const data: AzurePipelinesYaml = {
    trigger: {
      branches: { include: ringBranches },
      paths: {
        include: [sanitizeTriggerPath(relativeServicePathFormatted)],
        exclude: [BEDROCK_FILENAME],
      }, // Only building for a single service's path.
    },
    variables: [...(variableGroups ?? []).map((group) => ({ group }))],
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
                  `export BUILD_REPO_NAME=${BUILD_REPO_NAME(serviceName)}`,
                  `tag_name="$BUILD_REPO_NAME:${IMAGE_TAG}"`,
                  `commitId=$(Build.SourceVersion)`,
                  `commitId=$(echo "\${commitId:0:7}")`,
                  `service=$(Build.Repository.Name)`,
                  `service=\${service##*/}`,
                  `url=$(git remote --verbose | grep origin | grep fetch | cut -f2 | cut -d' ' -f1)`,
                  `repourl=\${url##*@}`,
                  `. ./build.sh --source-only`,
                  `get_spk_version`,
                  `download_spk`,
                  `./spk/spk deployment create -n $(INTROSPECTION_ACCOUNT_NAME) -k $(INTROSPECTION_ACCOUNT_KEY) -t $(INTROSPECTION_TABLE_NAME) -p $(INTROSPECTION_PARTITION_KEY) --p1 $(Build.BuildId) --image-tag $tag_name --commit-id $commitId --service $service --repository $repourl`,
                ]),
                displayName:
                  "If configured, update Spektate storage with build pipeline",
                condition:
                  "and(ne(variables['INTROSPECTION_ACCOUNT_NAME'], ''), ne(variables['INTROSPECTION_ACCOUNT_KEY'], ''),ne(variables['INTROSPECTION_TABLE_NAME'], ''),ne(variables['INTROSPECTION_PARTITION_KEY'], ''))",
              },
              {
                script: generateYamlScript([
                  `export BUILD_REPO_NAME=$(echo $(Build.Repository.Name)-${serviceName} | tr '[:upper:]' '[:lower:]')`,
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

  return asString
    ? yaml.safeDump(data, { lineWidth: Number.MAX_SAFE_INTEGER })
    : data;
};

export const createTestMaintainersYaml = (
  asString = true
): MaintainersFile | string => {
  const data: MaintainersFile = {
    services: {
      "./": {
        maintainers: [
          {
            email: "somegithubemailg@users.noreply.github.com",
            name: "my name",
          },
        ],
      },
      "./packages/service1": {
        maintainers: [
          {
            email: "hello@users.noreply.github.com",
            name: "testUser",
          },
        ],
      },
    },
  };

  return asString ? yaml.dump(data) : data;
};

export const createTestBedrockYaml = (
  asString = true
): BedrockFile | string => {
  const service1HelmConfig: HelmConfig = {
    chart: {
      branch: "master",
      git: "https://github.com/catalystcode/spk-demo-repo.git",
      path: "",
    },
  };

  const service2HelmConfig: HelmConfig = {
    chart: {
      branch: "master",
      git: "https://github.com/catalystcode/spk-demo-repo.git",
      path: "/service1",
    },
  };

  const zookeeperHelmConfig: HelmConfig = {
    chart: {
      chart: "zookeeper",
      repository: "https://kubernetes-charts-incubator.storage.googleapis.com/",
    },
  };

  const data: BedrockFile = {
    rings: {
      develop: {},
      master: {
        isDefault: true,
      },
      qa: {},
      testing: {},
    },
    services: {
      "./": {
        helm: service1HelmConfig,
        k8sBackendPort: 80,
      },
      "./packages/service1": {
        helm: service2HelmConfig,
        k8sBackendPort: 80,
      },
      "./zookeeper": {
        helm: zookeeperHelmConfig,
        k8sBackendPort: 80,
      },
    },
    variableGroups: [],
    version: "1.0",
  };

  return asString ? yaml.dump(data) : data;
};

export const createTestHldLifecyclePipelineYaml = (
  asString = true
): AzurePipelinesYaml | string => {
  const data: AzurePipelinesYaml = {
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

  return asString
    ? yaml.safeDump(data, { lineWidth: Number.MAX_SAFE_INTEGER })
    : data;
};

export const createTestHldAzurePipelinesYaml = (
  asString = true
): AzurePipelinesYaml | string => {
  const data: AzurePipelinesYaml = {
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
          "and(ne(variables['INTROSPECTION_ACCOUNT_NAME'], ''), ne(variables['INTROSPECTION_ACCOUNT_KEY'], ''),ne(variables['INTROSPECTION_TABLE_NAME'], ''),ne(variables['INTROSPECTION_PARTITION_KEY'], ''))",
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
          "and(ne(variables['INTROSPECTION_ACCOUNT_NAME'], ''), ne(variables['INTROSPECTION_ACCOUNT_KEY'], ''),ne(variables['INTROSPECTION_TABLE_NAME'], ''),ne(variables['INTROSPECTION_PARTITION_KEY'], ''))",
      },
    ],
  };

  return asString
    ? yaml.safeDump(data, { lineWidth: Number.MAX_SAFE_INTEGER })
    : data;
};

export const createTestHldAzurePipelinesYamlWithVariableGroup = (
  asString = true
): AzurePipelinesYaml | string => {
  const data: AzurePipelinesYaml = createTestHldAzurePipelinesYaml(
    false
  ) as AzurePipelinesYaml;
  data.variables = [{ group: "my-vg" }];

  return asString
    ? yaml.safeDump(data, { lineWidth: Number.MAX_SAFE_INTEGER })
    : data;
};

export const createTestComponentYaml = (
  asString = true
): ComponentYaml | string => {
  const component: ComponentYaml = {
    name: "default-component",
    subcomponents: [
      {
        name: "traefik2",
        method: "git",
        source: "https://github.com/microsoft/fabrikate-definitions.git",
        path: "definitions/traefik2",
      },
    ],
  };

  return asString ? yaml.dump(component) : component;
};
