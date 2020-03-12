export interface IRequestContext {
  orgName: string;
  projectName: string;
  accessToken: string;
  workspace: string;
  toCreateAppRepo?: boolean;
  toCreateSP?: boolean;
  createdProject?: boolean;
  scaffoldHLD?: boolean;
  scaffoldManifest?: boolean;
  createdHLDtoManifestPipeline?: boolean;
  createServicePrincipal?: boolean;
  servicePrincipalId?: string;
  servicePrincipalPassword?: string;
  servicePrincipalTenantId?: string;
  subscriptionId?: string;
  createdResourceGroup?: boolean;
  createdACR?: boolean;
  error?: string;
}

export const MANIFEST_REPO = "quick-start-manifest";
export const HLD_REPO = "quick-start-hld";
export const APP_REPO = "quick-start-app";
export const DEFAULT_PROJECT_NAME = "BedrockRocks";
export const APP_REPO_LIFECYCLE = "quick-start-lifecycle";
export const WORKSPACE = "quick-start-env";
export const SP_USER_NAME = "service_account";
export const RESOURCE_GROUP = "quick-start-rg";
export const RESOURCE_GROUP_LOCATION = "westus2";
export const ACR = "quickStartACR";
export const SETUP_LOG = "setup.log";

export const HLD_DEFAULT_GIT_URL =
  "https://github.com/microsoft/fabrikate-definitions.git";
export const HLD_DEFAULT_COMPONENT_NAME = "traefik2";
export const HLD_DEFAULT_DEF_PATH = "definitions/traefik2";
