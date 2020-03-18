import { AzureKeyVaultVariableValue } from "azure-devops-node-api/interfaces/TaskAgentInterfaces";

/**
 * Maintainers file
 */
export interface MaintainersFile {
  services: {
    [relativeDirectory: string]: {
      maintainers: User[];
      contributors?: User[];
    };
  };
}

interface User {
  name: string;
  email: string;
  website?: string;
}

export interface HelmConfig {
  chart:
    | {
        repository: string; // repo (eg; https://kubernetes-charts-incubator.storage.googleapis.com/)
        chart: string; // chart name (eg; zookeeper)
      }
    | ({
        git: string; // git url to clone (eg; https://github.com/helm/charts.git)
        path: string; // path in the git repo to the directory containing the Chart.yaml (eg; incubator/zookeeper)
        accessTokenVariable?: string; // environment variable containing a personal access token to authenticate against the git repository
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

export interface Rings {
  [branchName: string]: RingConfig;
}

export interface RingConfig {
  isDefault?: boolean; // indicates the branch is a default branch to PR against when creating a service revision
}

/**
 * Bedrock config file
 * Used to capture service meta-information regarding how to deploy
 */
export interface BedrockFile {
  rings: Rings;
  services: {
    [relativeDirectory: string]: BedrockServiceConfig;
  };
  variableGroups?: string[];
}

export interface BedrockServiceConfig {
  displayName?: string;
  middlewares?: string[];
  helm: HelmConfig;
  disableRouteScaffold?: boolean;
  k8sBackendPort: number; // the service port for the k8s service Traefik2 IngressRoutes will point to
  pathPrefix?: string; // pathprefix for ingress route, ie. document-service
  pathPrefixMajorVersion?: string; // api version, will prefix path prefix if provided. ie. 'v1' will result in the endpoint: /v1/document-service
  k8sBackend?: string; // k8s service backend name for ingress routing
}

/**@see https://docs.microsoft.com/en-us/azure/devops/pipelines/yaml-schema?view=azure-devops&tabs=schema%2Cparameter-schema#triggers */
type Triggerable = {
  include?: string[];
  exclude?: string[];
};

/**
 * Basic AzurePipelines Interface
 * @see https://github.com/andrebriggs/monorepo-example/blob/master/service-A/azure-pipelines.yml
 */
export interface AzurePipelinesYaml {
  trigger?: {
    batch?: boolean;
    branches?: Triggerable;
    tags?: Triggerable;
    paths?: Triggerable;
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
        condition?: string;
        inputs?: {
          helmVersionToInstall?: string;
        };
        task?: string;
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
      APP_REPO_URL?: string;
      AZURE_DEVOPS_EXT_PAT?: string;
      BEDROCK_BUILD_SCRIPT?: string;
      BRANCH_NAME?: string;
      COMMIT_MESSAGE?: string;
      REPO?: string;
      VERIFY_ONLY?: number;
    };
    inputs?: {
      scriptPath?: string;
      helmVersionToInstall?: string;
    };
    persistCredentials?: boolean;
    script?: string;
    task?: string;
  }>;
}

export interface ServiceEndpointData {
  name: string;
  subscription_id: string;
  subscription_name: string;
  service_principal_id: string;
  service_principal_secret: string;
  tenant_id: string;
}

export interface VariableGroupDataVariable {
  [key: string]: AzureKeyVaultVariableValue;
}

export interface VariableGroupData {
  name: string;
  description: string;
  type: string;
  variables: VariableGroupDataVariable;
  key_vault_provider?: {
    name: string;
    service_endpoint: ServiceEndpointData;
  };
}

export interface ConfigYaml {
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

export interface AzureAccessOpts {
  servicePrincipalId?: string;
  servicePrincipalPassword?: string;
  tenantId?: string;
  subscriptionId?: string;
}

export interface InfraConfigYaml {
  name: string;
  source: string;
  template: string;
  version: string;
  backend?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  variables?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

interface BedrockFileInfo {
  exist: boolean;
  hasVariableGroups: boolean;
}

export interface AccessYaml {
  [gitRepositoryUrl: string]: string;
}

export interface ComponentYaml {
  name: string;
  subcomponents?: [
    {
      name: string;
      method: string;
      source: string;
      path: string;
    }
  ];
}
