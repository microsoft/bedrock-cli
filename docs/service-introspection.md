# Service Introspection

Service Introspection shows information about Bedrock deployments:

- Name of the person that changed the service
- Time the service was changed or errored
- Deployment state of the service

**Important:**

To use service introspection, begin with the steps on
[Service Introspection: Getting Started](./service-introspection-onboarding.md).
This will walk you through setting up a Bedrock GitOps pipeline workflow.

Usage:

```
spk deployment [command] [options]
```

Commands:

- [validate](#validate)
- [get](#get)
- [onboard](#onboard)
- [dashboard](#dashboard)

Global options:

```
  -v, --verbose        Enable verbose logging
  -h, --help           Usage information
```

## Requirements

Fill out the service introspection settings in your spk config file, for example
`spk-config.yaml`. [Sample config file](./../../spk-config.yaml).

```
introspection:
  azure: # This is the storage account for the service introspection tool
    account_name: "storage-account-name"
    table_name: "table-name"
    partition_key: "partition-key"
    key: "storage-access-key"
    service_principal_id: "service-principal-id"
    service_principal_secret: "service-principal-secret"
    subscription_id: "subscription-id"
    tenant_id: "tenant-id"
    resource-group: "resource-group-name"
```

## Commands

### validate

Validate the [requirements](#requirements) and the onboard
[prerequisites](#prerequisites)

```
Usage:
spk deployment validate|v [options]

Options:
   -s, --self-test  Run a test for the configured storage account. This will write test data and delete the test data. For more information on the behavior, please check the online documentation.
  -h, --help  Usage information

```

Note: The purpose of `spk deployment validate --self-test` is to make sure that
spk is able to write data to the provided storage account. Once the test ends,
it will remove the test data that was added.

### get

Get the list of deployments by service name, release environment, build ID,
commit ID, or container image tag.

```
Usage:
spk deployment get|g [options]

Options:
  -b, --build-id <build-id>            Filter by the build ID of the source repository
  -c, --commit-id <commit-id>          Filter by a commit ID from the source repository
  -d, --deployment-id <deployment-id>  Filter by the deployment ID of the source repository
  -i, --image-tag <image-tag>          Filter by a container image tag
  -e, --env <environment>              Filter by environment name
  -s, --service <service-name>         Filter by service name
  -o, --output <output-format>         Output the information in one of the following formats: normal, wide, JSON
  -w, --watch                          Watch the deployments for a live view
  -h, --help                           Usage information
```

### dashboard

This command launches the Service Introspection Dashboard for your current
configuration. It requires `docker` to be installed on your machine in order to
work.

```
Usage: deployment dashboard|d [options]

Launch the service introspection dashboard

Options:
  -p, --port <port>  Port to launch the dashboard on (default: 4040)
  -r, --remove-all   Removes previously launched instances of the dashboard (default: false)
  -h, --help         output usage information
```

### onboard

Prepare storage for the service introspection tool. This will create a storage
account if it does not already exist in your subscription in the given
`resource-group`. The storage table will also be created in a newly created or
in an existing storage account if it does not exist already. When the Azure Key
Vault argument is specified, a secret with Azure storage access key will be
created. Otherwise, the storage access key will need to be specified in
environment variables manually.

#### Prerequisites

1. Service principal with owner access.
   [Create a service principal with owner access.](#service-principal)
2. Optionally, Azure Key Vault can be used to securely store and tightly control
   access to tokens, passwords, API keys, and other secrets
   [How to create key vault](https://docs.microsoft.com/en-us/azure/key-vault/quick-create-cli).
3. Give the service principal get and list access. Follow step 2 from
   [these instructions](https://docs.microsoft.com/en-us/azure/devops/pipelines/library/variable-groups?view=azure-devops&tabs=yaml#link-secrets-from-an-azure-key-vault).

```
Usage:
spk deployment onboard|o [options]`

Options:
  -s, --storage-account-name <storage-account-name>                 Azure storage account name
  -t, --storage-table-name <storage-table-name>"                    Azure storage table name
  -l, --storage-location <storage-location>                         Azure location to create new storage account when it does not exist
  -r, --storage-resource-group-name <storage-resource-group-name>   Name of the resource group to create new storage account when it does not exist
  -k, --key-vault-name <key-vault-name>                             Name of the Azure key vault; falls back to key_vault_name in spk config. It will create a new secret with storage access key when the value is specified
  --service-principal-id <service-principal-id>                     Azure service principal id with `contributor` role in Azure Resource Group; falls back to introspection.azure.service_principal_id in spk config
  --service-principal-password <service-principal-password>         The Azure service principal password; falls back to introspection.azure.service_principal_secret in spk config
  --tenant-id <tenant-id>                                           The Azure AD tenant id of service principal; falls back to introspection.azure.tenant_id in spk config
  --subscription-id <subscription-id>                               The Azure subscription id; falls back to introspection.azure.subscription_id in spk config
  -h, --help                                                        Usage information

```

## Service Principal

Create a service principal with owner access:

```
az ad sp create-for-rbac --role Owner --scopes /subscriptions/<your-subscription-id>
```
