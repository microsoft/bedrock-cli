# Cloud Infra Management

Manage and update Bedrock infrastructure. For more information on the
`spk infra` design, refer to the infrastructure design docs
[here](./infra/README.md).

Usage:

```
spk infra [command] [options]
```

Commands:

- [scaffold](#scaffold)
- [generate](#generate)

## Prerequisites

### Environment variables

Specify values for the following environment variables:

```
ARM_SUBSCRIPTION_ID
ARM_CLIENT_ID
ARM_CLIENT_SECRET
ARM_TENANT_ID
```

Instructions on how to specify environment variables can be found
[here](../README.md).

## Commands

### scaffold

Create initial scaffolding for cluster deployment.

Builds a scaffold of an infrastructure deployment project containing a
`definition.yaml` that enables a user to version, modify and organize terraform
deployments.

It will do the following:

- Create a new folder with the `<name>` you provided.
- Provide an infrastructure deployment scaffold based on a `<source>` git url
  for a terraform deployment, `<version>` respective to the repository of which
  tag to pull, and a `<template>` (LOCAL-ONLY) of the path to the variables.tf
  file for which `spk` will embed into a definition yaml file.

```
Usage:
spk infra scaffold|s [options]

> `spk infra scaffold --name discovery-service --source https://github.com/microsoft/bedrock --version "v0.12.0" --template /cluster/environments/azure-simple`

Options:
  -n, --name <name>                              Cluster name for scaffolding
  -s, --source <tf source github repo url>       Source URL for the repository containing the terraform deployment
  -v, --version <repository (tag) version>       Version or tag for the repository so a fixed version is referenced
  -t, --template <path to tf files in repo>      Location of variables.tf for the terraform deployment
  -h, --help                                     Usage information
```

#### scaffold example

```
spk infra scaffold --name discovery-service --source https://github.com/microsoft/bedrock --version "v0.12.0" --template /cluster/environments/azure-simple
```

definition.yaml output:

```yaml
name: discovery-service
source: https://github.com/Microsoft/bedrock.git
template: cluster/environments/azure-single-keyvault
version: v0.12.0
backend:
  storage_account_name: storage-account-name
  access_key: storage-account-access-key
  container_name: storage-account-container
  key: tfstate-key
variables:
  acr_enabled: "true"
  address_space: <insert value>
  agent_vm_count: <insert value>
  agent_vm_size: <insert value>
  cluster_name: <insert value>
  dns_prefix: <insert value>
  flux_recreate: <insert value>
  kubeconfig_recreate: <insert value>
  gc_enabled: "true"
  gitops_poll_interval: 5m
  gitops_ssh_url: <insert value>
  gitops_url_branch: master
  gitops_ssh_key: <insert value>
  gitops_path: <insert value>
  keyvault_name: <insert value>
  keyvault_resource_group: <insert value>
  resource_group_name: <insert value>
  ssh_public_key: <insert value>
  service_principal_id: <insert value>
  service_principal_secret: <insert value>
  subnet_prefixes: <insert value>
  vnet_name: <insert value>
  subnet_name: <insert value>
  network_plugin: azure
  network_policy: azure
  oms_agent_enabled: "false"
  enable_acr: "false"
  acr_name: <insert value>
```

### generate

Generates a deployment folder of an infrastructure scaffolded project containing
a `definition.yaml` with a `source`, `template` and `version` to obtain and
complete the Terraform template files.

It will do the following:

- Check if a provided project folder contains a `definition.yaml`
- Check if the terraform template `source` provided has a valid remote
  repository
- Cache the master version of the provided `source` repository locally in
  `~/.spk/templates`
  > Cached repositories will be converted through regex for spk to hash. I.e. a
  > `source` template of `https://github.com/microsoft/bedrock` will be cached
  > into a folder called `_microsoft_bedrock_git`
- Create a "generated" directory for Terrform deployments
- Copy the appropriate Terraform templates to the "generated" directory
- Create a `spk.tfvars` in the generated directory based on the variables
  provided in `definition.yaml`

```
Usage:
spk infra generate|g [options]

Generate scaffold for terraform cluster deployment.

Options:
  -p, --project <path to project folder to generate>   Location of the definition.yaml file that will be generated
  -h, --help                                           output usage information
```

### generate example

Assuming you have the following setup:

```
discovery-service
    |- definition.yaml
    |- east/
        |- definition.yaml
    |- central/
        |- definition.yaml
```

When executing the following command **in the `discovery-service` directory**:

```
spk infra generate --project east
```

The following hiearchy of directories will be generated _alongside_ the targeted
directory. In addition, the appropriate versioned Terraform templates will be
copied over to the leaf directory with a `spk.tfvars`, which contains the
variables accumulated from parent **and** leaf definition.yaml files.

```
discovery-service
    |- definition.yaml
    |- east/
        |- definition.yaml
    |- central/
        |- definition.yaml
discovery-service-generated
    |- east
        |- main.tf
        |- variables.tf
        |- spk.tfvars
```

You can also have a "single-tree" generation by executing `spk infra generate`
at the level above the targeted directory. For example, if you had the following
tree structure:

```
discovery-service
    |- east/
        |- definition.yaml
    |- central/
        |- definition.yaml
```

and wanted to create _just_ an `east-generated` directory, you could run
`spk infra generate -p east`, and this will result in the following:

```
discovery-service
    |- east/
        |- definition.yaml
    |- east-generated/
        |- main.tf
        |- variables.tf
        |- spk.tfvars
    |- central/
        |- definition.yaml
```

## Secrets

`definition.yaml` will handle secrets if specified in the following format:
`variable_name: ${env:secret_name}`. When the yaml file is read,
`spk infra generate` will load any references to environment variables either
from local environment variables in the current shell, or from a .env file.

### Authentication

Spk currently supports the use of Personal Access Tokens to authenticate with
private infrastructure repositories hosted in Azure DevOps. To configure spk to
build scaffolded definitions using a private AzDO repo, do one of the following:

- **Using `.spk-config`** - Pass in your PAT through an .env when you initialize
  spk. Be sure that the `access_token` and `infra_repository` is set and for
  every scaffold specify your `--version` and `--template`
- **Using arguments** - Pass in your formatted source url for your private AzDO
  repo with the PAT and arbitrary username specified. Example
  `spk infra scaffold --name discovery-service --source https://spk:{my_PAT_Token}@dev.azure.com/microsoft/spk/_git/infra_repo --version v0.0.1 --template cluster/environments/azure-single-keyvault`
