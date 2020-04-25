# Integration Testing Bedrock CLI

This directory contains shell scripts that execute on a build agent and run
`bedrock` commands. An [Azure DevOps pipeline yaml](../smoke-test-pipeline.yml)
file scheduled the run of these tests. The yaml file orchestrates the download
the lastest master branch build artifact of `bedrock` on a daily basis and
running smoke tests.

`validations.sh`

- This file orchestrates the scenarios and is designed to fail on first error.

`functions.sh`

- This file has simple functions that are reused by `validations.sh`.

`infra-validations.sh`

- This file orchestrates infrastructure scenarios and is designed to fail on
  first error.

`introspection-validations.sh`

- This file orchestrates the service introspection scenarios and is designed to
  fail on first error.

## Introspection validations data

The `introspection-validations.sh` test will create a new Azure Storage Table in
the given storage account each time it is run. To automatically clean up the
data, set up a Logic App to delete it. You can use the template
[`introspection-clean-data-logic-app.json`](./introspection-clean-data-logic-app.json)
for this. Edit the values in `parameters` and fill in your `<subscription id>`
and `resource group` where the storage account is.

To check existing Logic Apps in your subscription, go to the
[Azure Portal](http://portal.azure.com) and search for Logic Apps.

# Scenarios Exercised So Far

- As a developer create a mono-repo and add services.
- As a developer, create a new ring for a mono-repo.
- As a developer create variable group with variables.
- As a developer create a pipeline from an existing service.
- As a developer create a service revision from an existing service.
- As a developer create an HLD of a terraform template for infra deployment.

# Operational Coverage

## Initialization

| Command      | Coverage |
| ------------ | -------- |
| bedrock init | 🚫       |

## Project Creation

| Command                                    | Coverage |
| ------------------------------------------ | -------- |
| bedrock project create-variable-group      | ✅       |
| bedrock project init                       | ✅       |
| bedrock project install-lifecycle-pipeline | ✅       |

## Service Management

| Command                                | Coverage |
| -------------------------------------- | -------- |
| bedrock service create                 | ✅       |
| bedrock service create-revision        | ✅       |
| bedrock service install-build-pipeline | ✅       |

## Ring Management

| Command                  | Coverage |
| ------------------------ | -------- |
| bedrock ring create      | ✅       |
| bedrock ring delete      | ✅       |
| bedrock ring set-default | 🚫       |

## HLD Management

| Command                               | Coverage |
| ------------------------------------- | -------- |
| bedrock hld append-variable-group     | ✅       |
| bedrock hld init                      | ✅       |
| bedrock hld install-manifest-pipeline | ✅       |
| bedrock hld reconcile                 | ✅       |

## Service Introspection

| Command                      | Coverage |
| ---------------------------- | -------- |
| bedrock deployment get       | ✅       |
| bedrock deployment onboard   | ✅       |
| bedrock deployment validate  | 🚫       |
| bedrock deployment dashboard | 🚫       |
| bedrock deployment create    | ✅       |

## Infrastructure Management

| Command                | Coverage |
| ---------------------- | -------- |
| bedrock infra scaffold | ✅       |
| bedrock infra generate | ✅       |

# Setup Instructions

If you wish to run these tests locally, skip ahead to
[Testing locally](#Testing-locally)

## Requirements

1. Azure DevOps Organization and Project
2. Create variable group named `bedrock-cli-vg`. Inside the variable group have
   the following key/values:

   - AZDO_PROJECT (e.g. `bedrock`)
   - AZDO_ORG (e.g. `epicstuff`)
   - AZDO_PAT (e.g. Personal Access Token with **read/write/manage** access to
     AZDO_PROJECT) <-- 🔒
   - AZ_RESOURCE_GROUP - The name of an Azure resource group
   - AZ_STORAGE_ACCOUNT - The name of an Azure storage account
   - SP_APP_ID (e.g Service Principal App Id)
   - SP_PASS (e.g Service Principal Password) <-- 🔒
   - SP_TENANT (e.g Service Principal Tenant Id)
   - ACR_NAME (e.g Name of ACR resource that is accessible from above service
     principal)
   - BEDROCK_CLI_LOCATION - The full path to the bedrock executable file
     respectively to the OS.
   - BEDROCK_CLI_DEFINITION_ID ( DefinitionId of the Bedrock CLI artifact build)
   - BEDROCK_CLI_PROJECT_ID ( Project Id of the AzDO project the Bedrock CLI
     build occurs in)
   - FUNC_SCRIPT (e.g.
     https://raw.githubusercontent.com/MY_ORG/bedrock-cli/master/tests/functions.sh)
   - TEST_SCRIPT (e.g.
     https://raw.githubusercontent.com/MY_ORG/bedrock-cli/master/tests/validations.sh)
   - TEST_SCRIPT2 (e.g.
     https://raw.githubusercontent.com/MY_ORG/bedrock-cli/master/tests/infra-validations.sh)

3. [Azure CLI with Azure DevOps Extension](https://docs.microsoft.com/en-us/azure/devops/cli/?view=azure-devops)
   - Provided in pipeline yaml
4. Bedrock CLI Binary
   - Provided in pipeline yaml

## How to find Definition and Project Ids

Navigate to your Bedrock CLI build pipeline in Azure DevOps. Pay attention to
the URL in the browser. The example below is for the microsoft.bedrock-cli
pipeline. The definition id is 128. ![definitionid](./images/definitionid.png)

You can find the project id but navigating tot
`https://dev.azure.com/{organization}/_apis/projects?api-version=5.0-preview.3`
in your web browser. Replace {organization} with the name of your org. You will
get a JSON payload with a array of Azure DevOps projects. Find yours and use the
top level `Id` field as the Project Id.

## Testing locally

When testing locally you don't need to do the above set up since there is no
pipeline. Instead run these steps:

> For macOS users, be sure to pre-install `gsed` on your machine to run the
> infrastructure validations script: `brew install gnu-sed`

1. Login into AZ CLI
2. Install Azure DevOps Extension (make sure you have version >= 0.17.0
   installed)
   ```
   az extension add --name azure-devops
   ```
3. Set the following environment variables
   <pre>
   export BEDROCK_CLI_LOCATION=<b>REPLACE_ME</b>
   export AZDO_PROJECT=<b>REPLACE_ME</b>
   export AZDO_ORG=<b>REPLACE_ME</b>
   export ACCESS_TOKEN_SECRET=<b>REPLACE_ME</b>
   export ACR_NAME=<b>REPLACE_ME</b>
   export AZURE_DEVOPS_EXT_PAT=<b>REPLACE_ME</b>
   export SP_PASS=<b>REPLACE_ME</b>
   export SP_APP_ID=<b>REPLACE_ME</b>
   export SP_TENANT=<b>REPLACE_ME</b>
   export AZ_RESOURCE_GROUP=<b>REPLACE_ME</b>
   export AZ_STORAGE_ACCOUNT=<b>REPLACE_ME</b>
   </pre>
4. Navigate to this directory in shell
5. RUN --> `$ sh validations.sh`
6. RUN --> `$ sh infra-validations.sh`
7. RUN --> `$ sh introspection-validations.sh`
