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

- [validate](https://microsoft.github.io/bedrock-cli/commands/index.html#deployment_validate)
- [get](https://microsoft.github.io/bedrock-cli/commands/index.html#deployment_get)
- [onboard](https://microsoft.github.io/bedrock-cli/commands/index.html#deployment_onboard)
- [dashboard](https://microsoft.github.io/bedrock-cli/commands/index.html#deployment_dashboard)

Global options:

```
  -v, --verbose        Enable verbose logging
  -h, --help           Usage information
```

## Requirements

Fill out the service introspection settings in your spk config file, for example
`spk-config.yaml`. [Sample config file](../spk-config.yaml).

```
introspection:
  azure: # This is the storage account for the service introspection tool
    account_name: "storage-account-name"
    table_name: "table-name"
    partition_key: "partition-key"
    key: "storage-access-key"
```

To create storage-account and table, use the `spk deployment onboard` command to
create them where subscription Id, resource group name, service principal Id,
password and tenant Id are required.

### Service Principal

Create a service principal with owner access:

```
az ad sp create-for-rbac --role Owner --scopes /subscriptions/<your-subscription-id>
```
