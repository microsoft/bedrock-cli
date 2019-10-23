export interface IServiceEndpoint {
  data: IData;
  id: string;
  name: string;
  type: string;
  url: string;
  createdBy: ICreatedBy;
  authorization: IServicePrincipalAuthorization;
  isShared: boolean;
  isReady: boolean;
  owner: string;
  serviceEndpointProjectReferences?:
    | IServiceEndpointProjectReferencesEntity[]
    | null;
}
export interface IData {
  subscriptionId: string;
  subscriptionName: string;
  environment: string;
  scopeLevel: string;
  creationMode: string;
}

export interface ICreatedBy {
  displayName: string;
  url: string;
  _links: ILinks;
  id: string;
  uniqueName: string;
  imageUrl: string;
  descriptor: string;
}

export interface ILinks {
  avatar: IAvatar;
}

export interface IAvatar {
  href: string;
}

export interface IServicePrincipalAuthorization {
  parameters: IServicePrincipalAuthorizationParameters;
  scheme: string;
}

export interface IServicePrincipalAuthorizationParameters {
  tenantid: string;
  serviceprincipalid: string;
  authenticationType: string;
  serviceprincipalkey: string;
}

export interface IServiceEndpointProjectReferencesEntity {
  projectReference: IProjectReference;
  name: string;
}

export interface IProjectReference {
  id: string;
  name?: null;
}

export interface IServiceEndpointParams {
  data: IDataParams;
  id: string;
  name: string;
  type: string;
  authorization: IServicePrincipalAuthorization;
  isReady: boolean;
}

export interface IDataParams {
  subscriptionId: string;
  subscriptionName: string;
}
