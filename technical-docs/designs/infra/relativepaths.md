# Relative Paths for Bedrock Terraform Infrastructure

| Revision | Date         | Author         | Remarks                     |
| -------: | ------------ | -------------- | --------------------------- |
|      0.1 | Mar-23, 2020 | Nathaniel Rose | Initial Draft               |
|      0.2 | Mar-26, 2020 | Nathaniel Rose | Changes Reflected from Team |

## 1. Overview

Terraform modules use a source parameter to locate the resource module target to
download in order to initialize a terraform environment for deployment. A module
can call other modules, which lets you include the child module's resources into
the configuration in a concise way. Modules can also be called multiple times,
either within the same configuration or in separate configurations, allowing
resource configurations to be packaged and re-used.

This document outlines multiple solution that seeks to validate alternative ways
in which relative paths for child module may be supported in Bedrock
implementation and the Bedrock CLI tooling.

```
module "servers" {
  source = "./app-cluster"

  servers = 5
}
```

This design shall only target supporting relative paths in Bedrock CLI
scaffolding and generation.

### Issues Addressed:

1. As an SRE, I want to use module sources that are versioned and localized to
   the terraform templates repo.
2. As an Operator, I want automated CI pipelines that can handle internal
   references for incoming PR that modify my custom Bedrock modules.

## 2. Solution

In the current implementation on Bedrock CLI infra practices, the tool is
embedded into a generation pipeline that provisions terraform files respective
to the modified infra HLD. `bedrock infra generate` provisions a terraform
deployment template files based on the key values provided in the target
directory's `definition.yaml`. If the `source` template in the `definition.yaml`
uses relative paths in respects to the source, `infra generate` command will
produce a terraform file with the module source out of scope from the
provisioned terraform files.

When executing a `terraform init` on the generated deployment files it produces
an error similar to the following:

```
Initializing modules...
- aks-gitops in
- provider in
- vnet in

Error: Unreadable module directory

Unable to evaluate directory symlink: lstat ../../azure: no such file or
directory
```

### 2.1 Munge together URL with relative Path in Bedrock `infra generate` - **ACCEPTED DESIGN**

One option to address this issue is to directly modify the generated `.tf` files
to reflect the respective module source. Inside the `infra generate` command we
can use the `source`, `version`, and `template` values to modify the terraform
child module source to a remote module source for terraform to download upon
initialization.

Example:

**`Definition.yaml`**

```
name: fabrikam
source: "https://github.com/Microsoft/bedrock.git"
template: cluster/environments/azure-single-keyvault
version: nate.infra.relative.paths
.
.
.
```

Use a function to get the module path from root of remote repo in cached
directory. (`pathFunction`)

> source= ~~https://~~`source`?ref=`version`//`pathFunction()`"

**Output `Main.tf`**

```
terraform {
  backend "azurerm" {}
}

data "azurerm_client_config" "current" {}

data "azurerm_resource_group" "cluster_rg" {
  name = var.resource_group_name
}

data "azurerm_resource_group" "keyvault" {
  name = var.keyvault_resource_group
}

data "azurerm_subnet" "vnet" {
  name                 = var.subnet_name
  virtual_network_name = var.vnet_name
  resource_group_name  = data.azurerm_resource_group.keyvault.name
}

module "aks-gitops" {
  source = "github.com/microsoft/bedrock?ref=master//cluster/azure/aks-gitops"
}

# Create Azure Key Vault role for SP
module "keyvault_flexvolume_role" {
  source = "github.com/microsoft/bedrock?ref=master//cluster/azure/keyvault_flexvol_role"
}

# Deploy central keyvault flexvolume
module "flex_volume" {
  source = "github.com/microsoft/bedrock?ref=master//cluster/azure/keyvault_flexvol"
}
```

## 3. Dependencies

An existing pull request for Bedrock currently exists that verifies relative
path implementation with the use of Bedrock Provided Templates in
[#1189](https://github.com/microsoft/bedrock/pull/1189). This design document
seeks to propose interoperability of the relative paths with Bedrock CLI tooling
and adjustment of infrastructure pipeline.

## 4. Risks & Mitigations

Limitations to the solution include:

- Manipulating user input data and output terraform files
- Potential Regex parsing for URL validation to detect relative paths

## 5. Documentation

Yes. A brief update to the
[`bedrock-infra-generation-pipeline.md`](/guides/infra/bedrock-infra-generation-pipeline.md)
detailing relative path support for module sources.

## 6. Alternatives

### 6.1 Copy Modules to Alternative Configured Generated Directory

Another option is to copy modules from cached remote directory to the generated
folder. This allows Bedrock CLI to directly reference the parent module source
with the generated terraform templates. In addition, this would also require the
templates to be placed accordingly in respects to relative paths to parent
modules. In Bedrock, the template folders are 3 levels down
(../../../cluster/azure/keyvault_flex_vol")

```
fabrikam/
    definition.yaml
    fabrikam-central/
        definition.yaml
    fabrikam-east/
        definition.yaml
    fabrikam-west/
        definition.yaml
fabrikam-generated/
    cluster
        azure
        common
        minikube
        environments
            deployments
                fabrikam-central/
                    main.tf
                    variables.tf
                    keyvault.tf
                    terraform.tfvars
                    backend.tfvars
                fabrikam-east/
                    main.tf
                    variables.tf
                    keyvault.tf
                    terraform.tfvars
                    backend.tfvars
                fabrikam-west/
                    main.tf
                    variables.tf
                    keyvault.tf
                    terraform.tfvars
                    backend.tfvars
```

Limitations:

- Very coupled to current organization of Bedrock and will have breaking changes
  when introducing new folders at template /module levels
- Copying modules twice local to agent, once for cache and again during generate

### 6.2 Use a symlink to reference the modules

A symbolic link, also termed a soft link, is a special kind of file that points
to another file, much like a shortcut in Windows or a Macintosh alias. This will
allow generate the alias the cached repo for all `bedrock infra generate`
commands.

`ln -s modules /path/to/modules`

Inside of bedrock, the terraform files will now reference the symlink which is
cached.

**Output `Main.tf`**

```
terraform {
  backend "azurerm" {}
}

data "azurerm_client_config" "current" {}

data "azurerm_resource_group" "cluster_rg" {
  name = var.resource_group_name
}

data "azurerm_resource_group" "keyvault" {
  name = var.keyvault_resource_group
}

data "azurerm_subnet" "vnet" {
  name                 = var.subnet_name
  virtual_network_name = var.vnet_name
  resource_group_name  = data.azurerm_resource_group.keyvault.name
}

module "aks-gitops" {
  source = "modules/azure/aks-gitops"
}

# Create Azure Key Vault role for SP
module "keyvault_flexvolume_role" {
  source = "modules/azure/keyvault_flexvol_role"
}

# Deploy central keyvault flexvolume
module "flex_volume" {
  source = "modules/azure/keyvault_flexvol"
}
```

Limitations:

- Modifying the terraform output files.
- Added complexity with symlink alias which prevents ease of simply running
  terraform commands on native machine
