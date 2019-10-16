# Cloud Infra Management

Manage and update Bedrock infrastructure.

Usage:

```
spk infra [command] [options]
```

Commands:

- [validate](#validate)
- [scaffold](#scaffold)

## Prerequisites

Prerequisites are installed via the [`validate` command](#validate).

## Commands

### validate

Initializes the environment to deploy Bedrock infrastructure.

It will do the following:

- Verifies if prerequisites (e.g. terraform, git, helm, az cli) are installed
- Verifies that user is logged into Azure via CLI
- Check for environment variables (e.g. ARM_SUBSCRIPTION_ID, ARM_CLIENT_ID,
  ARM_CLIENT_SECRET, ARM_TENANT_ID)

```
Usage:
spk infra validate|v [options]

Options:
   -h, --help  Usage information
```

### scaffold

Create initial scaffolding for cluster deployment.

Builds a scaffold of an infrastructure deployment project containing a
`definition.json` that enables a user to version, modify and organize terraform
deployments.

It will do the following:

- Check if `spk infra validate` succeeded
- Create a new folder with the `<name>` you provided.
- Provide an infrastructure deployment scaffold based on a `<source>` git url
  for a terraform deployment, `<version>` respective to the repository of which
  tag to pull, and a `<template>` (LOCAL-ONLY) of the path to the variables.tf
  file for which `spk` will embed into a definition json file.

```
Usage:
spk infra scaffold|s [options]

> `spk infra scaffold --name discovery-service --source https://github.com/microsoft/bedrock --version "0.0.1" --template /microsoft/bedrock/cluster/environments/azure-simple`

Options:
  -n, --name <name>                              Cluster name for scaffolding
  -s, --source <cluster definition github repo>  Source URL for the repository containing the terraform deployment
  -v, --version <repository version>             Version or tag for the repository so a fixed version is referenced
  -t, --template <path to variables.tf>          Location of variables.tf for the terraform deployment
  -h, --help                                     Usage information
```

#### scaffold sample

```
spk infra scaffold --name discovery-service --source https://github.com/microsoft/bedrock --version "0.0.1" --template /microsoft/bedrock/cluster/environments/azure-simple
```

Output:

```
{
  "name": "discovery-service",
  "source": "https://github.com/microsoft/bedrock",
    "template": "bedrock/cluster/environments/azure-simple",
  "version": "0.0.1",
  "variables": {
    "agent_vm_count": "3",
    "agent_vm_size": "Standard_D2s_v3",
    "acr_enabled": "true",
    "gc_enabled": "true",
    "cluster_name": "<insert value>",
    "dns_prefix": "<insert value>",
    "flux_recreate": "<insert value>",
    "kubeconfig_recreate": "<insert value>",
    "gitops_ssh_url": "<insert value>",
    "gitops_ssh_key": "<insert value>",
    "gitops_path": "<insert value>",
    "gitops_url_branch": "master",
    "resource_group_name": "<insert value>",
    "ssh_public_key": "<insert value>",
    "service_principal_id": "<insert value>",
    "service_principal_secret": "<insert value>",
    "gitops_poll_interval": "5m",
    "vnet_name": "<insert value>",
    "service_cidr": "10.0.0.0/16",
    "dns_ip": "10.0.0.10",
    "docker_cidr": "172.17.0.1/16",
    "address_space": "10.10.0.0/16",
    "subnet_prefix": "10.10.1.0/24",
    "network_plugin": "azure",
    "network_policy": "azure",
    "oms_agent_enabled": "false"
  }
}
```
