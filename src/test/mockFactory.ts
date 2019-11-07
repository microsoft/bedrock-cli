import yaml from "js-yaml";
import {
  IAzurePipelinesYaml,
  IBedrockFile,
  IHelmConfig,
  IMaintainersFile
} from "../types";

// Helper to concat list of script commands to a multi line string
const generateYamlScript = (lines: string[]): string => lines.join("\n");

export const createTestMaintainersYaml = (
  asString = true
): IMaintainersFile | string => {
  const data: IMaintainersFile = {
    services: {
      "./": {
        maintainers: [
          {
            email: "somegithubemailg@users.noreply.github.com",
            name: "my name"
          }
        ]
      },
      "./packages/service1": {
        maintainers: [
          {
            email: "hello@users.noreply.github.com",
            name: "testUser"
          }
        ]
      }
    }
  };

  return asString ? yaml.dump(data) : data;
};

export const createTestBedrockYaml = (
  asString = true
): IBedrockFile | string => {
  const service1HelmConfig: IHelmConfig = {
    chart: {
      branch: "master",
      git: "https://github.com/catalystcode/spk-demo-repo.git",
      method: "git",
      path: ""
    }
  };

  const service2HelmConfig: IHelmConfig = {
    chart: {
      branch: "master",
      git: "https://github.com/catalystcode/spk-demo-repo.git",
      method: "git",
      path: "/service1"
    }
  };

  const zookeeperHelmConfig: IHelmConfig = {
    chart: {
      chart: "zookeeper",
      method: "helm",
      repository: "https://kubernetes-charts-incubator.storage.googleapis.com/"
    }
  };

  const data: IBedrockFile = {
    rings: {},
    services: {
      "./": {
        helm: service1HelmConfig
      },
      "./packages/service1": {
        helm: service2HelmConfig
      },
      "./zookeeper": {
        helm: zookeeperHelmConfig
      }
    }
  };

  return asString ? yaml.dump(data) : data;
};

export const createTestHldLifecyclePipelineYaml = (
  asString = true
): IAzurePipelinesYaml | string => {
  // tslint:disable: object-literal-sort-keys
  const data: IAzurePipelinesYaml = {
    trigger: {
      branches: {
        include: ["master"]
      }
    },
    variables: [],
    pool: {
      vmImage: "ubuntu-latest"
    },
    steps: [
      {
        script: generateYamlScript([
          `# Download build.sh`,
          `curl https://raw.githubusercontent.com/Microsoft/bedrock/master/gitops/azure-devops/build.sh > build.sh`,
          `chmod +x ./build.sh`
        ]),
        displayName: "Download bedrock bash scripts"
      },
      {
        script: generateYamlScript([
          `# From https://raw.githubusercontent.com/Microsoft/bedrock/master/gitops/azure-devops/release.sh`,
          `. build.sh --source-only`,
          ``,
          `# Initialization`,
          `verify_access_token`,
          `init`,
          `helm init`,
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
          `echo "spk hld reconcile $(Build.Repository.Name) $PWD"`,
          `spk hld reconcile $(Build.Repository.Name) $PWD`,
          `echo "GIT STATUS"`,
          `git status`,
          `echo "GIT ADD (git add -A)"`,
          `git add -A`,
          ``,
          `# Set git identity`,
          `git config user.email "admin@azuredevops.com"`,
          `git config user.name "Automated Account"`,
          ``,
          `# Commit changes`,
          `echo "GIT COMMIT"`,
          `git commit -m "Reconciling HLD with $(Build.Repository.Name)-$(Build.BuildNumber)."`,
          ``,
          `# Git Push`,
          `git_push`,
          ``,
          `# Open PR via az repo cli`,
          `echo 'az extension add --name azure-devops'`,
          `az extension add --name azure-devops`,
          ``,
          `echo 'az devops login'`,
          `echo "$(PAT)" | az devops login`,
          ``,
          `echo 'az repos pr create --description "Reconciling HLD with $(Build.Repository.Name)-$(Build.BuildNumber)."'`,
          `az repos pr create --description "Reconciling HLD with $(Build.Repository.Name)-$(Build.BuildNumber)."`
        ]),
        displayName:
          "Download Fabrikate and SPK, Update HLD, Push changes, Open PR",
        env: {
          ACCESS_TOKEN_SECRET: "$(PAT)",
          REPO: "$(HLD_REPO)"
        }
      }
    ]
  };
  // tslint:enable: object-literal-sort-keys

  return asString
    ? yaml.safeDump(data, { lineWidth: Number.MAX_SAFE_INTEGER })
    : data;
};

export const createTestHldAzurePipelinesYaml = (
  asString = true
): IAzurePipelinesYaml | string => {
  // tslint:disable: object-literal-sort-keys
  const data: IAzurePipelinesYaml = {
    trigger: {
      branches: {
        include: ["master"]
      }
    },
    pool: {
      vmImage: "Ubuntu-16.04"
    },
    steps: [
      {
        checkout: "self",
        persistCredentials: true,
        clean: true
      },
      {
        bash: "curl $BEDROCK_BUILD_SCRIPT > build.sh\nchmod +x ./build.sh",
        displayName: "Download Bedrock orchestration script",
        env: {
          BEDROCK_BUILD_SCRIPT:
            "https://raw.githubusercontent.com/Microsoft/bedrock/master/gitops/azure-devops/build.sh"
        }
      },
      {
        task: "ShellScript@2",
        displayName: "Validate fabrikate definitions",
        inputs: {
          scriptPath: "build.sh"
        },
        condition: `eq(variables['Build.Reason'], 'PullRequest')`,
        env: {
          VERIFY_ONLY: 1
        }
      },
      {
        task: "ShellScript@2",
        displayName:
          "Transform fabrikate definitions and publish to YAML manifests to repo",
        inputs: {
          scriptPath: "build.sh"
        },
        condition: `ne(variables['Build.Reason'], 'PullRequest')`,
        env: {
          ACCESS_TOKEN_SECRET: "$(ACCESS_TOKEN)",
          COMMIT_MESSAGE: "$(Build.SourceVersionMessage)",
          REPO: "$(MANIFEST_REPO)",
          BRANCH_NAME: "$(Build.SourceBranchName)"
        }
      }
    ]
  };
  // tslint:enable: object-literal-sort-keys

  return asString
    ? yaml.safeDump(data, { lineWidth: Number.MAX_SAFE_INTEGER })
    : data;
};
