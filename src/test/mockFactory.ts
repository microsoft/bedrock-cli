import yaml from "js-yaml";
import {
  IAzurePipelinesYaml,
  IBedrockFile,
  IHelmConfig,
  IMaintainersFile
} from "../types";

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
        bash: `echo "hello world. this is where lifecycle management will be implemented."`,
        displayName: "hello world"
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
