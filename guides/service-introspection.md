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

- [validate](https://catalystcode.github.io/spk/commands/index.html#deployment_validate)
- [get](https://catalystcode.github.io/spk/commands/index.html#deployment_get)
- [onboard](https://catalystcode.github.io/spk/commands/index.html#deployment_onboard)
- [dashboard](https://catalystcode.github.io/spk/commands/index.html#deployment_dashboard)

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

## Prerequisites

1. Service principal with owner access.
   [Create a service principal with owner access.](#service-principal)
2. Optionally, Azure Key Vault can be used to securely store and tightly control
   access to tokens, passwords, API keys, and other secrets
   [How to create key vault](https://docs.microsoft.com/en-us/azure/key-vault/quick-create-cli).
3. Give the service principal get and list access. Follow step 2 from
   [these instructions](https://docs.microsoft.com/en-us/azure/devops/pipelines/library/variable-groups?view=azure-devops&tabs=yaml#link-secrets-from-an-azure-key-vault).

### Service Principal

Create a service principal with owner access:

```
az ad sp create-for-rbac --role Owner --scopes /subscriptions/<your-subscription-id>
```
