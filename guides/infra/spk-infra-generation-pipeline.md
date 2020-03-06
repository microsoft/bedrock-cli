# Guide: Infrastructure Generation Pipeline

This section describes how to configure Azure Devops to be your CI/CD
orchestrator for your Infrastructure Generation workflow using `spk infra`.

## Prerequisites

1. _Permissions_: The ability to create Projects in your Azure DevOps
   Organization.
2. _High Level Definitions_: Your own infrastructure high level definitions for
   your deployment. You can refer to a sample repo
   [here](https://github.com/yradsmikham/spk-infra-hld). You should be able to
   create your Infra HLD repo using a scaffolding process via `spk` (i.e.
   `spk infra scaffold`). For more information on how to do that, please refer
   to the
   [Cloud Infra Management](https://github.com/CatalystCode/spk/blob/master/docs/cloud-infra-management.md#scaffold)
   doc.

## Setup

### 1. Create Repositories and Personal Access Tokens (PATs)

Create both an infrastructure high level definition (HLD) and infrastructure
generated repos. You will also need to create personal access tokens that you
can use for the Infra CI/CD pipeline. We have instructions for how to do that in
two flavors:

- [Azure DevOps](https://github.com/microsoft/bedrock/blob/master/gitops/azure-devops/ADORepos.md)
- [GitHub](https://github.com/microsoft/bedrock/blob/master/gitops/azure-devops/GitHubRepos.md)

### 2. Add Azure Pipeline Build YAML

The SPK repository has a [template](../../azure-pipelines/templates/infra-generation-pipeline.yml) Azure DevOps pipeline that you may use as reference.
Add the `infra-generation-pipeline.yml` file to the root of the Infra HLD repo.

### 3. Create Pipeline

We use
[Azure Pipelines](https://docs.microsoft.com/en-us/azure/devops/pipelines/get-started/key-pipelines-concepts?toc=/azure/devops/pipelines/toc.json&bc=/azure/devops/boards/pipelines/breadcrumb/toc.json&view=azure-devops)
to generate Terraform files based on your infrastructure high level description
yaml files (e.g. definition.yaml).

In Azure DevOps:

1. Create a Variable Group.

Variable Groups may vary based on the `azure-pipelines.yml` used, but for the
spk `infra-generation-pipeline.yml` template, the following variables will need
to be added as part of the pipeline Variable Group:

```
ACCESS_TOKEN_SECRET: Personal Access Token for your repo type.
ARM_CLIENT_ID: Azure Service Principal App ID
ARM_CLIENT_SECRET: Azure Service Principal password
ARM_SUBSCRIPTION_ID: Azure Subscription ID
ARM_TENANT_ID: Azure Service Principal Tenant ID
CLUSTER: A specific cluster name of a multi-cluster (i.e. west)
GENERATED_REPO: The full URL to your manifest repo (i.e. https://github.com/yradsmikham/spk-infra-generated.git)
PROJECT_DIRECTORY: The name of your project (i.e. discovery-service)
```

If using Azure DevOps repos, be sure to include the additional environment
variables:

```
AZDO_ORG_NAME: Azure DevOps organization url (i.e. https://dev.azure.com/org_name/)
AZDO_PROJECT_NAME: The name of the project in your Azure DevOps organization where the repository is hosted
```

You can use `spk` to create the Azure DevOps Variable Groups by executing
`spk variable-group create` described in this
[doc](../../guides/variable-group.md).
This will require you to create a variable group manifest similar to the
following:

```
name: "spk-infra-hld-vg"
description: "variable groupd for infra hld"
type: "Vsts"
variables:
  ACCESS_TOKEN_SECRET:
    value: "<PAT>"
  ARM_CLIENT_ID:
    value: "<SP-APP-ID>"
  ARM_CLIENT_SECRET:
    value: "<SP-PASSWORD>"
  ARM_SUBSCRIPTION_ID:
    value: "<SUBSCRIPTION-ID>"
  ARM_TENANT_ID:
    value: "<SP-TENANT-ID>
  CLUSTER:
    value: "<CLUSTER-NAME>"
  GENERATED_REPO:
    value: "<GIT-URL-TO-GENERATED-REPO>"
  PROJECT_DIRECTORY:
    value: "<PROJECT-NAME>"
  AZDO_ORG_NAME: (optional)
    value: "<AZURE-DEVOPS-ORG-NAME>"
  AZDO_PROJECT_NAME: (optional)
    value: "<AZURE-DEVOPS-PROJECT-NAME>"
```

By using the `spk variable-group create` you are also able to link variables to
secrets in Azure Keyvault.

![](../images/spk-infra-vg.png)

2. Create a new pipeline.

You can use the Azure CLI to create the Generation pipeline. To do that, you
will need to do the following:

- Create a service endpoint for the git repository (if you do not already have
  one). This is **only required** for Github repos:

`az devops service-endpoint github create --github-url <github-url> --name <name> --org <azure-devops-org-name> --project <azure-devops-project-name>`

- Then, create the Azure DevOps pipeline for Infra Generation:

`az pipelines create --name <pipeline-name> --branch <repo-branch> --org <org-url> --project <project-name> --repository <git-repo-url> --yaml-path ./azure-pipellines.yml --service-connection <service-connection-id>`

**Note**: The `--service-connection` argument is only required for GitHub repos.
It can be omitted when using Azure DevOps repos.

Additionally, you can also use the Azure DevOps portal to manually create the
pipeline as shown in the following steps 3-7:

![](../images/spk-infra-new-pipeline.png)

3. Choose the platform you are using for source control. For now, there are only
   examples for GitHub and Azure DevOps repos. However, other version control
   tools should be fairly similar.

![](../images/spk-infra-azdo.png)

4. Select an Infra HLD repository.

![](../images/spk-infra-azdo-repo.png)

5. Choose "Existing Azure Pipeline YAML file" if there is an
   `azure-pipelines.yml` in the selected Infra HLD repo.

![](../images/spk-infra-existing-yaml.png)

6. On the side panel, select the appropriate repo branch to work from, and also
   the path to the `azure-pipelines.yml` file.

![](../images/spk-infra-path-to-yaml.png)

7. Be sure to verify that the `azure-pipelines.yml` is linked to the correct
   variable group that was created earlier. When the pipeline is ready, hit
   'Save and run'

![](../images/spk-infra-save-run.png)

8. Create Pull Request

Assuming your pipeline runs to success...

![](../images/spk-infra-successful-pipeline.png)

There should now be a PR pending approval for your Infra Generated Repo.

![](../images/spk-infra-pr.png)

9. Approve and merge PR

If the PR looks correct, hit 'Approve' and then 'Complete'.
![](../images/spk-infra-pr-approve.png)

From here, you can complete the merge to master branch of the Infra Generated
Repo.

![](../images/spk-infra-complete-merge.png)
