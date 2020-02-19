# SPK + Terragrunt (Deprecated)

Terragrunt is a thin wrapper for Terraform that provides extra tools for keeping
your Terraform configurations DRY (Dont Repeat Yourself), working with multiple
Terraform modules, and managing remote state. This repository is an
investigation on the feasibility of using terragrunt for infrastructure
scaffolding and generation detailed in the
[Bedrock CLI Northstar](https://github.com/CatalystCode/bedrock-end-to-end-dx).

1. [Prerequisites](#prerequisites)
2. [Recursive Child Templates](#recursive-child-templates)
3. [Backend State](#backend-state)
4. [Multiple Template Environments](#multiple-template-environments)
5. [Embedding in SPK](#embedding-in-spk)
6. [Issues with Terragrunt Approach](#issues-with-terragrunt-approach)
7. [`spk infra` Vision](/SPK-Infra.md)

## Prerequisites

1. [Install Terraform](https://www.terraform.io/intro/getting-started/install.html).

1. Install Terragrunt by going to the
   [Releases Page](https://github.com/gruntwork-io/terragrunt/releases),
   downloading the binary for your OS, renaming it to `terragrunt`, and adding
   it to your PATH.
   - See the [Install Terragrunt](#install-terragrunt) docs for other
     installation options.

## Recursive Child Templates

Terragrunt configuration uses the exact language, HCL, as Terraform. We will use
this to propogate common template configuration variables to child templates.

```
└── recursive
    └── azure-simple (base)
        ├── README.md
        ├── terragrunt.hcl
        ├── azure-simple-east (deployment)
        │    ├── main.tf
        │    ├── terragrunt.hcl
        │    └── variables.tf
        └── azure-simple-west (deployment)
             ├── main.tf
             ├── terragrunt.hcl
             └── variables.tf
```

A few things to note:

- Note `.tfvars` have been removed as the terraform runtime will override
  terragrunt configurations upon configuration application
- In this example we are not using a remote backend state, `tfstate` wil be
  stored locally.
- Bedrock requires BYO Resource Group, so the location of the cluster will be
  dependent on the rg you provide.
- Iterating through terraform deployments are to be handled manually by the
  user.

In our **base** template is the bedrock azure-simple terraform environment. Here
we provide our common infrastructure configurations such as `service-principal`
and `resource_group_name`. Sensitive secrets are passed through environment
variables.

```go
inputs = {
    # BYO Resource Group
    resource_group_name      = "nr-spk-infra-tests-rg"
    agent_vm_count           = "3"
    dns_prefix               = "spk-dns-prefix"
    vnet_name                = "spk-vnet"
    service_principal_id          = "${get_env("AZURE_SUBSCRIPTION_ID", "")}"
    service_principal_secret      = "${get_env("AZURE_SUBSCRIPTION_SECRET", "")}"
}
```

Then we create our deployment terraform template directories as subdirectories
for our base. In this example we have `azure-simple-east` and
`azure-simple-west`. Each contain their respective `terragrunt.hcl` with
additional configurations that are specific to their deployment. With our
`include` configuration, terraform variables passed from parent branches ared
applied to the current child deployment.

```go
include {
  path = find_in_parent_folders()
}

inputs = {
    cluster_name             = "spk-cluster-west"
    ssh_public_key           = "public-key"
    gitops_ssh_url           = "git@github.com:timfpark/fabrikate-cloud-native-manifests.git"
    gitops_ssh_key           = "<path to private gitops repo key>"
}
```

Now that we have our 2 clusters, lets run a terraform plan in both deployment
folders.

> User needs to be signed in to az-cli under the correct subscription

First run `terragrunt get` to download the template modules.

Then run a `terragrunt plan` in each deployment fold and confirm the
configuration.

> **You can also run a `terragrunt plan-all` from the root base folder which
> will run `terraform plan` in all folders that contain a terraform
> deployment.**

## Backend State

Similarly, Remote cloud storage for Backend states can be propagated from parent
to child directory for terraform template deployments.

```
└── backend-state
    └── azure-simple (base)
        ├── main.tf
        ├── terragrunt.hcl
        ├── variables.tf
        └── azure-simple-west (deployment)
             ├── main.tf
             ├── terragrunt.hcl
             └── variables.tf
```

At this time Interpolations (e.g. variables) can't be used in the configuration
for a Backend or a Provider - support for this is being tracked in
hashicorp/terraform#4149. So in our **base** template we add the remote
configuration block for our Azure backend to store states. Here we use the
`path_relative_to_incluce()` to create unique `tfstate` files that us the folder
name and the provided storage account from the base root folder.

```go
inputs = {
   # BYO Resource Group
   resource_group_name      = "nr-spk-infra-tests-rg"
   agent_vm_count           = "3"
   dns_prefix               = "spk-dns-prefix"
   vnet_name                = "spk-vnet"
   service_principal_id          = "${get_env("AZURE_CLIENT_ID", "")}"
   service_principal_secret      = "${get_env("AZURE_CLIENT_SECRET", "")}"
}
remote_state {
   backend = "azurerm"
       config = {
           resource_group_name = "${get_env("AZURE_BACKEND_RG_NAME", "")}"
           storage_account_name = "${get_env("AZURE_BACKEND_STORAGE_NAME", "")}"
           container_name       = "${get_env("AZURE_BACKEND_CONTAINER_NAME", "")}"
           access_key           = "${get_env("AZURE_BACKEND_ACCESS_KEY", "")}"
           key                  = "spk1.${path_relative_to_include()}/terraform.tfstate"
   }
}
```

Now in our our `include` configuration for our deployment template, we pass an
include block which will obtain the root remote storage configuration. If a
unique remote state resource is needed for a deployment then a `remote_state`
block added here will override the parent.

```go
include {
  path = find_in_parent_folders()
}

inputs = {
    cluster_name             = "backend-spk-store"
    ssh_public_key           = "public-key"
    gitops_ssh_url           = "git@github.com:timfpark/fabrikate-cloud-native-manifests.git"
    gitops_ssh_key           = "<path to private gitops repo key>"
}
```

## Multiple Template Environments

For Multiple terraform deployments that require dependency, terragrunt provides
utilities to add complementary logic for assuring template are configured
correctly.

In this example we have 2 deployments, `azure-common-infra` and
`azure-single-keyvault` where the latter template is dependent on the former.
This template requires not only the input but also the output of
`azure-common-infra`.

```
└── multi-cluster
    └── azure-common-infra (base)
         ├── README.md
         ├── terragrunt.hcl
         ├── azure-common-infra-west (deployment)
         │    ├── main.tf
         │    ├── terragrunt.hcl
         │    ├── variables.tf
         │    ├── vnet.tf
         │    ├── keyvault.tf
         ├── azure-single-keyvault-west (deployment)
         |    ├── main.tf
         |    ├── terragrunt.hcl
         |    ├── variables.tf
         |    ├── acr.tf
         └── azure-single-keyvault-west-v2 (deployment)
              ├── main.tf
              ├── terragrunt.hcl
              ├── variables.tf
              ├── acr.tf
```

In our `azure-common-infra` we configure our base configuration similarly as
other previous examples:

```
inputs = {
    # BYO Resource Group
    global_resource_group_name = "nr-spk-infra-tests-rg"
    vnet_name = "spkvnet"
    subnet_name = "spksubnet"
    subnet_prefix = "10.39.0.0/24"
    address_space = "10.39.0.0/16"
    keyvault_name = "spkkeyvault"
    service_principal_id = "${get_env("AZURE_CLIENT_ID", "")}"
    tenant_id = "${get_env("AZURE_TENANT_ID", "")}"
}

remote_state {
    #disable_init = true
    backend = "azurerm"
    config = {
        resource_group_name  = "${get_env("AZURE_BACKEND_RG_NAME", "")}"
        storage_account_name = "${get_env("AZURE_BACKEND_STORAGE_NAME", "")}"
        container_name       = "${get_env("AZURE_BACKEND_CONTAINER_NAME", "")}"
        access_key           = "${get_env("AZURE_BACKEND_ACCESS_KEY", "")}"
        key                  = "spk1.${path_relative_to_include()}/terraform.tfstate"
    }
}
```

For the `azure-single-keyvault` we require the output and the input names that
were used to deploy the other template.

Here we can use a `dependency` block to identify the path to the
`azure-common-infra` template to pass the outputs. Additionally we can leverage
`mock_outputs` for validation purposes for so we dont have to actually deploy
`azure-common-infra` to see if `azure-single-keyvault` template has been
configured correctly.

```tf
inputs = {
    agent_vm_count = "3"
    agent_vm_size = "Standard_D4s_v3"

    cluster_name = "azure-single-keyvault"
    dns_prefix = "azure-single-keyvault"

    gitops_ssh_url = "git@github.com:Microsoft/fabrikate-production-cluster-demo-materialized"
    gitops_ssh_key = "/full/path/to/gitops_repo_private_key"

    resource_group_name = "azure-single-keyvault-rg"

    ssh_public_key = "<ssh public key>"

    service_principal_id = "${get_env("AZURE_CLIENT_ID", "")}"
    service_principal_secret = "${get_env("AZURE_CLIENT_SECRET", "")}"
}

include {
    path = "${path_relative_to_include()}/../azure-common-infra/terragrunt.hcl"
}

remote_state {
    #disable_init = true
    backend = "azurerm"
    config = {
        resource_group_name  = "${get_env("AZURE_BACKEND_RG_NAME", "")}"
        storage_account_name = "${get_env("AZURE_BACKEND_STORAGE_NAME", "")}"
        container_name       = "${get_env("AZURE_BACKEND_CONTAINER_NAME", "")}"
        access_key           = "${get_env("AZURE_BACKEND_ACCESS_KEY", "")}"
        key                  = "spk1.${path_relative_to_include()}/terraform.tfstate"
    }
}

dependency "azure-common-infra" {
  config_path = "../azure-common-infra"

  mock_outputs = {
    vnet_subnet_id = "/subscriptions/<subscriptionId>/resourceGroups/myResourceGroup/providers/Microsoft.Network/virtualNetworks/myVnet/subnets/mock-Subnet"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  #Dependency on vnet_subnet_id
  skip_outputs = true
}
```

Once you've specified the dependencies in each terragrunt.hcl file, when you run
the terragrunt apply-all or terragrunt destroy-all, Terragrunt will ensure that
the dependencies are applied or destroyed, respectively, in the correct order.
For the example at the start of this section, the order for the apply-all
command would be:

1. Deploy `azure-common-infra-west`
2. Deploy `azure-single-keyvault-west` and `azure-single-keyvault-west-v2`in
   parallel

## Using Private Repositories

The easiest way to use Terragrunt with private Git repos is to use SSH
authentication. Configure your Git account so you can use it with SSH and use
the SSH URL for your repo, prepended with git::ssh://: or have your ssh agent
handle the key authentication.

```
terraform {
  source = "git@github.com:NathanielRose/spk-terragrunt-private.git//azure-simple-west"
}
```

There is one file inside the private repo example folder and its a
`terraform.hcl` with a source terraform block configured with your private repo.
Run a `terragrunt get` once your ssh-keys have been configured and you have
added your private repo.

```
└── private
    ├── terragrunt.hcl
    └── terragrunt-cache
        ├── repository (azure-simple-west)
        └── .terragrunt-source-version
```

Terragrunt will download terraform configurations from your private repo to a
`terragrunt-cache` copy the files locally, set the working directory to the new
cache folder an begin a `terraform init` to download the respective modules.

Note: In automated pipelines, you may need to run the following command for your
Git repository prior to calling terragrunt to ensure that the ssh host is
registered locally, e.g.:

```
$ ssh -T -oStrictHostKeyChecking=accept-new git@github.com || true
```

> **For an Azure Devops Private Repo:** Use `http` for the source url you wish
> to use for the terraform source template url. Be sure to generate alternative
> credentials and use the user login generated when prompted. For more
> information on how to configure alternative credentials for Azure DevOps Repos
> check out this
> [article](https://docs.microsoft.com/en-us/azure/devops/repos/git/auth-overview?view=azure-devops).
> We will work to understand how a more secure method for repo access can be
> used for terraform.

## Embedding in SPK

### Building Cluster Definition

Olina then moves on to create her infrastructure deployment definition. She
suspects that the project may grow beyond just a single cluster to multiple
clusters and wants to be able to scalably add clusters without having to hand
manage N sets of nearly identical Terraform scripts -- each deployment will be
similar in structure but differ in a few configuration values (region,
connection strings, etc). Infrastructure definitions with `spk` are
hierarchical, with each layer inheriting from the layer above it, so she starts
by creating the globally common definition between all of her infrastructure:

```bash
$ spk infra scaffold --name discovery-service --source https://github.com/fabrikam/bedrock --template cluster/environments/fabrikam-common-infra
```

This creates a directory called `discovery-service` and places a
`terragrunt.hcl` file with a locked source at the latest version (such that it
does not change underneath the infrastructure team without them opting into a
change) and a block for setting variables that are globally the same for the
discovery-service and a Terraform template called `fabrikam-common-infra` that
contains all of their common infrastructure items.

```go
terraform {
    source = "https://github.com/fabrikam/bedrock --template cluster/environments/fabrikam-common-infra//cluster/environments/fabrikam-common-infra"
}

remote_state {

    }

inputs {​

    }​
```

Since they want all of their clusters to be of the same size globally, she edits
the inputs block to include the number of agent VMs and common location for the
GitOps repo for each of those clusters that she gets from Dag:

```go

terraform {
    source = "https://github.com/fabrikam/bedrock --template cluster/environments/fabrikam-common-infra//cluster/environments/fabrikam-common-infra"
    }
remote_state {
    backend = "azurerm"
    config = {
        resource_group_name  = "${get_env("AZURE_BACKEND_RG_NAME", "")}"
        storage_account_name = "${get_env("AZURE_BACKEND_STORAGE_NAME", "")}"
        container_name       = "${get_env("AZURE_BACKEND_CONTAINER_NAME", "")}"
        access_key           = "${get_env("AZURE_BACKEND_ACCESS_KEY", "")}"
        key                  = "fabrikam.${path_relative_to_include()}/terraform.tfstate"
    }
}
inputs {​
    agent_vm_count: 3,
    gitops_ssh_url: "git@github.com:fabrikam/discovery-cluster-manifests.git"
    }​
```

Now that Olina has scaffolded out the globally common configuration for the
`discovery-service`, she wants to define the first cluster that Fabrikam is
deploying in the east region. To do that, she enters the `discovery-service`
directory above and issues the command:

```bash
$ spk infra scaffold --name east --source https://github.com/fabrikam/bedrock --template cluster/environments/fabrikam-single-keyvault
```

Like the previous command, this creates a directory called `east` and creates a
`terragrunt.hcl` file in it with the following:

```go
terraform {
    source = "https://github.com/fabrikam/bedrock --template cluster/environments/fabrikam-common-infra//cluster/environments/fabrikam-single-keyvault"
}

remote_state {

    }

inputs {​

    }​
```

She then fills in the east specific variables for this cluster ignoring the
remote state block since that will be inherited and labeled with the respective
folder name:

```go
terraform {
    source = "https://github.com/fabrikam/bedrock --template cluster/environments/fabrikam-common-infra//cluster/environments/fabrikam-single-keyvault"
}

inputs {​
    cluster_name: "discovery-cluster-east",​
    gitops_path: "east"
    resource_group_name: "discovery-cluster-east-rg",​
    vnet_name: "discovery-cluster-east-vnet"​
    }​
```

Likewise, she wants to create a `west` cluster, which she does in the same
manner from the `discovery-service` directory:

```bash
$ spk infra scaffold --name west --source https://github.com/fabrikam/bedrock --template cluster/environments/fabrikam-single-keyvault
```

And fills in the `terragrunt.hcl` file with the following `west` specific
variables:

```go
terraform {
    source = "https://github.com/fabrikam/bedrock --template cluster/environments/fabrikam-common-infra//cluster/environments/fabrikam-single-keyvault"
}

inputs {​
    cluster_name: "discovery-cluster-west",​
    gitops_path: "west"
    resource_group_name: "discovery-cluster-west-rg",​
    vnet_name: "discovery-cluster-west-vnet"​
    }​
```

With this, she now has a directory structure resembling:

```
└── discovery-service
    ├── terragrunt.hcl
    ├── east
    |   └── terragrunt.hcl
    └── west
        └── terragrunt.hcl
```

### Generating Cluster Terraform Templates

With her cluster infrastructure now defined, she can now generate the Terraform
scripts for all the infrastructure for this deployment by navigating to the
`discovery-cluster` top level directory and running:

```bash
$ terragrunt validate-all
```

This command recursively reads in the definition at the current directory level,
applies any variables there to the currently running dictionary for the
directory scope, and then, if there is a `source` and `template` defined in the
current definition, creates a `terragrunt-cache` directory and fills the
Terraform hcl using that source and template at the specified version and with
the accumulated variables.

In Olina's scenario above, this means that `terragrunt` generates three
`terragrunt-cache` directories like this with Terraform scripts ready for
deployment.

```
└── discovery-service
    ├── terragrunt.hcl
    ├── terragrunt-cache
    |   └── fabrikam-common-infra
    ├── east
    |   ├── terragrunt-cache
    |   |    └── fabrikam-single-keyvault
    |   └── terragrunt.hcl
    └── west
        ├── terragrunt-cache
        |    └── fabrikam-single-keyvault
        └── terragrunt.hcl
```

### Deploying Cluster

With the above defined and the Terraform scripts generated, Olina can leverage
Terraform tools she has installed to deploy (or update) the defined clusters. To
deploy the infrastructure, she first navigates to `discovery-service/generated`
and applies the `common-infra` scripts.

```bash
$ terragrunt init
$ terragrunt apply-all
```

This deploys the terraform templates in the deployment tree

### Cluster Scaffolding Management

In the case where Olina might want to take some time off, she needs a process so
that her colleague(s) can interact with the scaffolding during her absense.
There are multiple ways to handle this, but one that fits well would be to use
some form of a source repository (private VSTS repository, private github repo,
etc) which will allow for the maintaining of the directory structure and the
sharing of the scaffold information. One needs to make sure, however, that
secrets are not commited to the repository.

**TODO**: Flesh out this description of how Olina could hand off to another
person in an operations role named Odin.

**TODO**: Determine requirements to embed terragrunt as an executable under
`spk` cli.

## Issues with Terragrunt Approach

### Terragrunt caching

A known issue that terragrunt does have inconsitent caching between terraform
modules. ([Issue 896](https://github.com/gruntwork-io/terragrunt/issues/896)) In
addition to this, terragrunt-cache is known to bloat the disk usage really fast.

Issue I experienced building examples, inconsistency to obtain an object_id from
a service_principal_id.

```
 Error: "object_id" is an invalid UUUID: uuid: UUID string too short:
on .terraform/modules/keyvault_access_policy_default/cluster/azure/keyvault_policy/main.tf line 1, in resource "azurerm_key_vault_access_policy" "keyvault":
1: resource "azurerm_key_vault_access_policy" "keyvault" {
```

### Only one level of includes is allowed

A big limitation for terragrunt is only 1 level of propogation for partial
configuration
([Issue 303](https://github.com/gruntwork-io/terragrunt/issues/303)).

### No determined way on how to handle multiple terraform templates

### TODOs

1. **TODO**: Flesh out this description of how Olina could hand off to another
   person in an operations role named Odin.

2. **TODO**: Determine requirements to embed terragrunt as an executable under
   `spk` cli.
