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

## Commands

### scaffold

Builds a scaffold of an infrastructure deployment project containing a
`definition.yaml` that enables a user to version, modify and organize terraform
deployments.

In detail, it will do the following:

- Create a new folder with the `<name>` you provided.
- Clone and cache the source repo to `~.spk/templates`.
- Provide an infrastructure deployment scaffold based on a `<source>` git url
  for a repo that holds terraform template, a `<version>` respective to the
  repository tag or branch to pull from, and a `<template>` path to a terraform
  environment template from the root of the git repo.

```
Usage:
spk infra scaffold|s [options]

> `spk infra scaffold --name fabrikam --source https://github.com/microsoft/bedrock --version master --template /cluster/environments/azure-simple`

Options:
  -n, --name <name>                              Cluster name for scaffolding
  -s, --source <tf source github repo url>       Source URL for the repository containing the terraform deployment
  -v, --version <repository tag or branch>       Version or tag for the repository so a fixed version is referenced
  -t, --template <path to tf files in repo>      Location of variables.tf for the terraform deployment
  -h, --help                                     Usage information
```

#### scaffold example

```
spk infra scaffold --name fabrikam --source https://github.com/microsoft/bedrock --version master --template /cluster/environments/azure-single-keyvault
```

definition.yaml output:

```yaml
name: fabrikam
source: "https://github.com/microsoft/bedrock.git"
template: cluster/environments/azure-single-keyvault
version: master
backend:
  storage_account_name: storage-account-name
  access_key: storage-account-access-key
  container_name: storage-account-container
  key: tfstate-key
variables:
  address_space: <insert value>
  agent_vm_count: <insert value>
  agent_vm_size: <insert value>
  cluster_name: <insert value>
  dns_prefix: <insert value>
  flux_recreate: <insert value>
  kubeconfig_recreate: <insert value>
  gitops_ssh_url: <insert value>
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
  acr_name: <insert value>
```

**Note:** Definitions will only include variables that do not have a default
value. To override default values, add the variable name to the variables
definition and provide a new value.

### generate

Creates a "generated" deployment folder with the completed Terraform files based
on definitions provided from a scaffolded project.

It will do the following:

- Check if a provided project folder contains a `definition.yaml`
- Verify the configuration of parent and leaf definitions.
- Check if the terraform template `source` provided has a valid remote
  repository.
- Clone and cache the master version of the provided `source` repository locally
  in `~/.spk/templates`
  > Cached repositories will be converted through regex for spk to hash. (i.e. a
  > `source` template of `https://github.com/microsoft/bedrock` will be cached
  > into a folder called `_microsoft_bedrock_git`)
- Create a "generated" directory for Terrform deployments (alongside the
  scaffolded project directory)
- Copy the appropriate Terraform templates to the "generated" directory
- Create a `spk.tfvars` in the generated directory based on the variables
  provided in `definition.yaml` files of the parent and leaf directories.

```
Usage:
spk infra generate|g [options]

Generate scaffold for terraform cluster deployment.

Options:
  -p, --project <path to project folder to generate>   Location of the definition.yaml file that will be generated
  -o, --output <path to generated directory>           Location of generated directory
  -h, --help                                           output usage information
```

### generate example

Assuming you have the following setup:

```
fabrikam
    |- definition.yaml
    |- east/
        |- definition.yaml
    |- central/
        |- definition.yaml
```

When executing the following command **in the `fabrikam` directory**:

```
spk infra generate --project east
```

The following hiearchy of directories will be generated _alongside_ the targeted
directory. In addition, the appropriate versioned Terraform templates will be
copied over to the leaf directory with a `spk.tfvars`, which contains the
variables accumulated from parent **and** leaf definition.yaml files, where if a
variable exists in both parent and leaf definition, the **leaf definitions will
take precedence**.

```
fabrikam
    |- definition.yaml
    |- east/
        |- definition.yaml
    |- central/
        |- definition.yaml
fabrikam-generated
    |- east
        |- main.tf
        |- variables.tf
        |- spk.tfvars (concatenation of variables from fabrikam/definition.yaml (parent) and fabrikam/east/definition.yaml (leaf))
```

You can also have a "single-tree" generation by executing `spk infra generate`
inside a directory without specifying a project folder. For example, if you had
the following tree structure:

```
fabrikam
    |- definition.yaml
```

and executed `spk infra generate` inside the `fabrikam` directory, this will
generate the following:

```
fabrikam-generated
    |- main.tf
    |- variables.tf
    |- spk.tfvars
```

## Handling Secrets

`definition.yaml` will handle secrets if specified in the following format:
`variable_name: ${env:secret_name}`. When the yaml file is read,
`spk infra generate` will load any references to environment variables either
from local environment variables in the current shell, or from a .env file.

Example:

```yaml
name: fabrikam
source: "https://github.com/microsoft/bedrock.git"
template: cluster/environments/azure-single-keyvault
version: master
backend:
  storage_account_name: storage-account-name
  access_key: storage-account-access-key
  container_name: storage-account-container
  key: tfstate-key
variables:
  service_principal_id: ${env:ARM_CLIENT_ID}
  service_principal_secret: ${env:ARM_CLIENT_SECRET}
```

## Authentication (Private Repos)

`spk` currently supports the use of Personal Access Tokens to authenticate with
private infrastructure repositories hosted in Azure DevOps. To configure `spk`
to build scaffolded definitions using a private AzDO repo, do one of the
following:

- **Using `.spk-config`** - Pass in your PAT through an .env when you initialize
  spk. Be sure that the `access_token` and `infra_repository` is set and for
  every scaffold, specify your `--version` and `--template`.
- **Using arguments** - Pass in your formatted source url for your private AzDO
  repo with the PAT and arbitrary username specified. Example
  `spk infra scaffold --name fabrikam --source https://spk:{$PAT}@dev.azure.com/microsoft/spk/_git/infra_repo --version master --template cluster/environments/azure-single-keyvault`
