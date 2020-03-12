export interface ServiceEndpoint {
  data: Data;
  id: string;
  name: string;
  type: string;
  url: string;
  createdBy: CreatedBy;
  authorization: ServicePrincipalAuthorization;
  isShared: boolean;
  isReady: boolean;
  owner: string;
  serviceEndpointProjectReferences?:
    | ServiceEndpointProjectReferencesEntity[]
    | null;
}
export interface Data {
  subscriptionId: string;
  subscriptionName: string;
  environment: string;
  scopeLevel: string;
  creationMode: string;
}

export interface CreatedBy {
  displayName: string;
  url: string;
  _links: Links;
  id: string;
  uniqueName: string;
  imageUrl: string;
  descriptor: string;
}

export interface Links {
  avatar: Avatar;
}

export interface Avatar {
  href: string;
}

export interface ServicePrincipalAuthorization {
  parameters: ServicePrincipalAuthorizationParameters;
  scheme: string;
}

export interface ServicePrincipalAuthorizationParameters {
  tenantid: string;
  serviceprincipalid: string;
  authenticationType: string;
  serviceprincipalkey: string;
}

export interface ServiceEndpointProjectReferencesEntity {
  projectReference: ProjectReference;
  name: string;
}

export interface ProjectReference {
  id: string;
  name?: null;
}

export interface ServiceEndpointParams {
  data: DataParams;
  id: string;
  name: string;
  type: string;
  authorization: ServicePrincipalAuthorization;
  isReady: boolean;
}

export interface DataParams {
  subscriptionId: string;
  subscriptionName: string;
}
