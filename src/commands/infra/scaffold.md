## Description

Builds a scaffold of an infrastructure deployment project containing a
`definition.yaml` that enables a user to version, modify and organize terraform
deployments.

In detail, it will do the following:

- Create a new folder with the `<name>` you provided.
- Clone and cache the source repo to `~.bedrock/templates`.
- Provide an infrastructure deployment scaffold based on a `<source>` git url
  for a repo that holds terraform template, a `<version>` respective to the
  repository tag or branch to pull from, and a `<template>` path to a terraform
  environment template from the root of the git repo.

## Example

```
bedrock infra scaffold --name fabrikam --source https://github.com/microsoft/bedrock --version master --template /cluster/environments/azure-single-keyvault
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
