export interface AzureDevOpsOpts {
  personalAccessToken?: string;
  orgName?: string;
  project?: string;
  serverUrl?: string;
}

export type PullRequest = (
  title: string, // title of the PR
  sourceRef: string, // the source branch to merge
  targetRef: string, // the target branch to merge into
  options?: {
    description?: string; // description for the PR
    originPushUrl?: string; // remote origin url; use this to search for the target repository. If not present, fallback to `git config --get remote.origin.url`
  } & AzureDevOpsOpts
) => Promise<unknown>;
