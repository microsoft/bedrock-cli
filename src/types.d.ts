import { AzureKeyVaultVariableValue } from "azure-devops-node-api/interfaces/TaskAgentInterfaces";

/**
 * Maintainers file
 */
export interface IMaintainersFile {
  services: {
    [relativeDirectory: string]: {
      maintainers: IUser[];
      contributors?: IUser[];
    };
  };
}

interface IUser {
  name: string;
  email: string;
  website?: string;
}

export interface IHelmConfig {
  chart:
    | {
        repository: string; // repo (eg; https://kubernetes-charts-incubator.storage.googleapis.com/)
        chart: string; // chart name (eg; zookeeper)
      }
    | ({
        git: string; // git url to clone (eg; https://github.com/helm/charts.git)
        path: string; // path in the git repo to the directory containing the Chart.yaml (eg; incubator/zookeeper)
      } & (
        | {
            sha: string; // sha to checkout (eg; 4e61eb234b0ac38956efc1b52a0455a43dba026f)
            tag?: string; // indicate the semantics of the sha (eg; v1.0.2)
          }
        | {
            branch: string; // branch to checkout (eg; master)
          }
      ));
}

/**
 * Bedrock config file
 * Used to capture service meta-information regarding how to deploy
 */
export interface IBedrockFile {
  rings: {
    [branchName: string]: {
      isDefault?: boolean; // indicates the branch is a default branch to PR against when creating a service revision
    };
  };
  services: {
    [relativeDirectory: string]: {
      displayName?: string;
      middlewares?: string[];
      helm: IHelmConfig;
    };
  };
  variableGroups?: string[];
}

/**
 * Basic AzurePipelines Interface
 * @see https://github.com/andrebriggs/monorepo-example/blob/master/service-A/azure-pipelines.yml
 */
export interface IAzurePipelinesYaml {
  trigger?: {
    branches?: {
      include?: string[];
      exclude?: string[];
    };
    paths?: {
      include?: string[];
      exclude?: string[];
    };
  };
  variables?: Array<{ group: string } | { name: string; value: string }>;
  pool?: {
    vmImage?: string;
  };
  stages?: Array<{
    // Stages are in public preview and must be enabled to use. https://docs.microsoft.com/en-us/azure/devops/pipelines/process/stages?view=azure-devops&tabs=yaml
    stage: string;
    dependsOn?: string;
    condition?: string;
    jobs: Array<{
      job: string;
      pool: {
        vmImage: string;
      };
      steps?: Array<{
        script?: string;
        displayName?: string;
        env?: {
          AZURE_DEVOPS_EXT_PAT?: string;
          ACCESS_TOKEN_SECRET?: string;
          BEDROCK_BUILD_SCRIPT?: string;
          REPO?: string;
        };
      }>;
    }>;
  }>;
  steps?: Array<{
    bash?: string;
    clean?: boolean;
    checkout?: string;
    condition?: string;
    displayName?: string;
    env?: {
      ACCESS_TOKEN_SECRET?: string;
      AZURE_DEVOPS_EXT_PAT?: string;
      BEDROCK_BUILD_SCRIPT?: string;
      BRANCH_NAME?: string;
      COMMIT_MESSAGE?: string;
      REPO?: string;
      VERIFY_ONLY?: number;
    };
    inputs?: {
      scriptPath: string;
    };
    persistCredentials?: boolean;
    script?: string;
    task?: string;
  }>;
}

export interface IServiceEndpointData {
  name: string;
  subscription_id: string;
  subscription_name: string;
  service_principal_id: string;
  service_principal_secret: string;
  tenant_id: string;
}

export interface IVariableGroupData {
  name: string;
  description: string;
  type: string;
  variables: [
    {
      [key: string]: AzureKeyVaultVariableValue;
    }
  ];
  key_vault_provider?: {
    name: string;
    service_endpoint: IServiceEndpointData;
  };
}

export interface IConfigYaml {
  azure_devops?: {
    org?: string;
    project?: string;
    hld_repository?: string;
    manifest_repository?: string;
    infra_repository?: string;
    access_token?: string;
    variable_group?: string;
  };

  infra?: {
    checks?: {
      [toolName: string]: boolean;
    };
    terraform?: string;
    helm?: string;
    git?: string;
    az?: string;
  };
  introspection?: {
    dashboard?: {
      image?: string;
      name?: string;
    };
    azure?: {
      account_name?: string;
      table_name?: string;
      partition_key?: string;
      key: Promise<string | undefined>;
      source_repo_access_token?: string;
      service_principal_id?: string;
      service_principal_secret?: string;
      subscription_id?: string;
      tenant_id?: string;
      resource_group?: string;
    };
  };
  key_vault_name?: string;
}

export interface IAzureAccessOpts {
  servicePrincipalId?: string;
  servicePrincipalPassword?: string;
  tenantId?: string;
  subscriptionId?: string;
}

export interface IInfraConfigYaml {
  name: string;
  source: string;
  template: string;
  version: string;
  backend?: {
    [key: string]: any;
  };
  variables?: {
    [key: string]: any;
  };
}
