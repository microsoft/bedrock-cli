# Cloud Infra Management

Manage and update Bedrock infrastructure. For more information on the
`spk infra` design, refer to the infrastructure design docs
[here](./infra/README.md).

Usage:

```
spk infra [command] [options]
```

## Commands

- [scaffold](#https://microsoft.github.io/bedrock-cli/commands/index.html#infra_generate)
- [generate](#https://microsoft.github.io/bedrock-cli/commands/index.html#infra_scaffold)

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

## Terraform Modules with Local Paths

`spk` now supports Terraform source templates that use a
[local repository path](https://www.terraform.io/docs/modules/sources.html#local-paths)
for references to modules. To obtain the modules for further teraform
deployment, `spk infra generate` will shape a module source value from the
`source`, `tempate`, and `version` arguments passed.

**Example:**

Template Main.tf

```tf
"aks-gitops" {
  source = "../../azure/aks-gitops"
  acr_enabled              = var.acr_enabled
  agent_vm_count           = var.agent_vm_count
  agent_vm_size            = var.agent_vm_size
  cluster_name             = var.cluster_name
  dns_prefix               = var.dns_prefix
  flux_recreate            = var.flux_recreate
  gc_enabled               = var.gc_enabled
  gitops_ssh_url           = var.gitops_ssh_url
  gitops_ssh_key           = var.gitops_ssh_key
  gitops_path              = var.gitops_path
  gitops_poll_interval     = var.gitops_poll_interval
  gitops_label             = var.gitops_label
  gitops_url_branch        = var.gitops_url_branch
  ssh_public_key           = var.ssh_public_key
  resource_group_name      = data.azurerm_resource_group.cluster_rg.name
  service_principal_id     = var.service_principal_id
  service_principal_secret = var.service_principal_secret
  vnet_subnet_id           = tostring(element(module.vnet.vnet_subnet_ids, 0))
  service_cidr             = var.service_cidr
  dns_ip                   = var.dns_ip
  docker_cidr              = var.docker_cidr
  network_plugin           = var.network_plugin
  network_policy           = var.network_policy
  oms_agent_enabled        = var.oms_agent_enabled
  kubernetes_version       = var.kubernetes_version
}`;

```

SPK-generated Main.tf

```tf
"aks-gitops" {
  source = "github.com/microsoft/bedrock?ref=master//cluster/azure/aks-gitops/"
  acr_enabled              = var.acr_enabled
  agent_vm_count           = var.agent_vm_count
  agent_vm_size            = var.agent_vm_size
  cluster_name             = var.cluster_name
  dns_prefix               = var.dns_prefix
  flux_recreate            = var.flux_recreate
  gc_enabled               = var.gc_enabled
  gitops_ssh_url           = var.gitops_ssh_url
  gitops_ssh_key           = var.gitops_ssh_key
  gitops_path              = var.gitops_path
  gitops_poll_interval     = var.gitops_poll_interval
  gitops_label             = var.gitops_label
  gitops_url_branch        = var.gitops_url_branch
  ssh_public_key           = var.ssh_public_key
  resource_group_name      = data.azurerm_resource_group.cluster_rg.name
  service_principal_id     = var.service_principal_id
  service_principal_secret = var.service_principal_secret
  vnet_subnet_id           = tostring(element(module.vnet.vnet_subnet_ids, 0))
  service_cidr             = var.service_cidr
  dns_ip                   = var.dns_ip
  docker_cidr              = var.docker_cidr
  network_plugin           = var.network_plugin
  network_policy           = var.network_policy
  oms_agent_enabled        = var.oms_agent_enabled
  kubernetes_version       = var.kubernetes_version
}`;

```
