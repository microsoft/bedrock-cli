# (Another) SPK Infra Narrative

An extension to
[Bedrock E2E](https://github.com/CatalystCode/bedrock-end-to-end-dx).

Olina's coworker, Hugo, a developer, overheard the exciting project of Bedrock,
and is interested in experiementing with it. Olina, who is now an expert at
Bedrock, decided to write up a "guide" to help Hugo get started with building,
maintaining, and deploying his infrastructure.

# Infrastructure Configuration and Deployment (Day 0-1)

## Building Cluster Definition

Like Olina, Hugo suspects that his project will grow over time, so he wants to
be able to scalably add and manage N clusters without having to manage N sets of
Terraform code and configuration. Huga would like each deployement to resemble
the same Terraform environment template, but use different configuration values.
Luckily, `spk` supports a hierarchical structure, where each layer will inherit
configuratiom from its parent layer (if its not specified at the child level).
To begin, Hugo runs:

`spk infra scaffold --name discovery-service --source https://github.com/frugal_hugo/bedrock --version 0.1.2 --template cluster/environments/fabrikam-single-keyvault`

When he runs this command, he finds that it does the following:

- Creates a directory called `discovery-service`
- Creates a `definition.json`.

Hugo proceeds with updating the values of his `definition.json` file. He made
sure to update variables that he wants to be shared across all his clusters. His
`definition.json` now resembles the following:

```
{​
    name: "discovery-service",
    source: "https://github.com/frugal_hugo/bedrock",
    template: "cluster/environments/fabrikam-single-keyvault",
    version: "0.1.2",

    variables: {​
        backend_storage_account_name: "tfstate"
        backend_container_name: "discoveryservice",
        service_principal_id: "${ARM_CLIENT_ID}"
        service_principal_secret: "${ARM_CLIENT_SECRET}"
        keyvault_resource_group: "hugo_kv_rg"
        keyvault_name: "hugo_kv"
        agent_vm_count: 3,
        gitops_ssh_url: "git@github.com:fabrikam/discovery-cluster-manifests.git"
        gitops_url_branch: master
        gitops_poll_interval: "30s"
    }​
}
```

Now that Hugo has scaffolded out the globally common configuration, he goes on
to define the first cluster. To do this, he repeats the `spk` scaffolding step.

`spk infra scaffold --name discovery-service/discovery-service-east --source https://github.com/frugal_hugo/bedrock --version 0.1.2 --template cluster/environments/fabrikam-single-keyvault`

Like before, this will create a new directory with a corresponding
`definition.json` file. Again, Hugo modifies the `definition.json` so that _this
time_, the cluster definition will hold information that is unique to the
cluster, like the following:

```
{​
    name: "discovery-service-east",

    variables: {​
        backend_key: "east",
        cluster_name: "discovery-cluster-east",​
        gitops_path: "east"
        resource_group_name: "discovery-cluster-east-rg",​
        vnet_name: "discovery-cluster-east-vnet"​
    }​
}
```

Hugo repeats the steps for his west and central cluster, and eventually he has
the following hierarchy:

```
discovery-service/
    definition.json
    discovery-service-east/
        definition.json
    discovery-service-central/
        definition.json
    discovery-service-west/
        definition.json
```

## Generating Cluster Terraform Templates

Hugo plans on generating the Terraform scripts for all the infrastructure, and
he does this by running:

`spk infra generate discovery-service`

He can also run `spk infra generate discovery-service/discovery-service-east` to
generate Terraform scripts for a single cluster. His directories now look
something like this:

```
discovery-cluster/
    definition.json
    discovery-service-east/
        definition.json
        generated/
            main.tf
            variables.tf
            keyvault.tf
            terraform.tfvars
            backend.tfvars
    discovery-service-central/
        definition.json
        generated/
            main.tf
            variables.tf
            keyvault.tf
            terraform.tfvars
            backend.tfvars
    discovery-service-west/
        definition.json
        generated/
            main.tf
            variables.tf
            keyvault.tf
            terraform.tfvars
            backend.tfvars
```

## Deploying Cluster

With the above defined and the Terraform scripts generated, Hugo can leverage
Terraform tools he has installed to deploy (or update) the defined clusters. To
deploy the infrastructure, he first navigates to
discovery-service/east/generated.

```
$ terraform init
$ terraform plan
$ terraform apply
```

and likewise, afterwards in the discovery-service/west/generated directories.

# CI/CD (Day 2)

## Version 1

From Olina, Hugo has learned of the headaches from manually updating and
versioning his cluster at scale. So, he attempts to come up with an approach to
automate some of these components.

Hugo creates git repositories to hold all of his infrastructure files: (1)
Cluster HLD repo (contains `definition.json` files), and (2) Cluster Generated
repo (contains generated terraform files). He wants to rely on git pull
requests, and triggered Azure DevOps pipelines to automate changes made to his
cluster. To do this, he writes a script for one of his Azure DevOps pipeline
linked to the cluster definition repo that will do the following:

- Download and install the latest version of `spk`
- Runs `spk infra generate` on the modified `definition.json`
  - Regenerates the terraform templates with the new changes
- Creates a pull request against the Cluster Generated repo

He then creates another Azure DevOps pipeline linked to the Cluster Generated
repo that will:

- Download and install the latest version of `terraform`
- Runs `terraform init`, `terraform plan`, and `terraform apply` to update his
  Cloud infrastructure.

## Updating a Configuration

Hugo would like to change the `agent_vm_count` for his `discovery-service-east`
cluster, and although he could simply update the `definition.json` file, run
`spk infra generate` on the directory, and then finally run `terraform apply` to
update the cluster, he would rather have these changes be automated, versioned,
and logged somewhere. With the approach described above, Hugo can update the
`definition.json` file, and push a new commit to the Cluster HLD Repo. From
there, this will trigger an Azure DevOps pipeline that will execute a script.
The script will download and install `spk`, run `spk infra generate` against the
`definition.json` to generate the appropriate terraform files, and finally
create a git pull request against the Cluster Generated repo. Hugo will need
review the pull request on the Cluster Generated repo to ensure that the changes
are correct before merging.

When the changes are merged, another Azure DevOps pipeline will be triggered to
execute a simple script to perform `terraform` commands. Once the `terraform`
commands succeed, the cluster should be updated!

**NOTE**: This approach only supports Terraform infrastructure that uses a
remote backend.

## Updating a Template

Hugo wants to add a null resource to his `fabrikam-single-keyvault` template.
So, he makes changes to the terraform templates to his personal Bedrock
**source** repo. However, now he wants the `discovery-service-west` cluster to
reflect this change. Similar to updating a configuration, Hugo makes a change to
his `definition.json` by running `spk infra scaffold` to regenerate a
`definition.json` with the appropriate (new) variables (or he can simply modify
the existing `definition.json`). Then, he commits this change to the Cluster HLD
repo, which will trigger the CI/CD pipelines to accomplish a successful cluster
deployment.

If the template change did not require an update to the `definition.json`, Hugo
can also manually trigger the Azure DevOps pipeline to regenerate the terrform
files in the Cluster Generated Repo.

## Version 2

Hugo has done some research on CI/CD tools, and stumbled upon
[Atlantis](https://github.com/runatlantis/atlantis). He attempts to incorporate
Atlantis as part of the CI/CD for infrastructure.

Instead of using an Azure DevOps pipeline to deploy changes to the cluster, Hugo
creates a pull request against the Cluster Generated repo (via the first Azure
DevOps pipeline) and then relies on Atlantis to run `terraform plan` and
`terraform apply` remotely and comment back on the pull request with the output
by executing the following as PR comments:

```
$ atlantis plan
$ atlantis apply
```

![](../images/spk-infra-cicd.png)

# Summary

- User runs `spk infra scaffold` to generate `definition.json` files and build
  hiearchy for multi-cluster.
- User runs `spk infra generate` to generate Terraform scripts based on the
  `definition.json` files.
- User creates two git repositories: (1) Infra HLD repo and (2) Infra Generated
  repo. The `definition.json` resides in the Infra HLD repo, meanwhile, the
  generated Terraform scripts reside in the Infra Generated repo.
- User configures Azure DevOps pipelines that are triggered off of git commits
  and PRs.
  - The first Azure DevOps pipeline will (re)generate Terraform files when
    `definition.json` files are updated. (triggered off Infra HLD repo)
  - The second Azure DevOps pipeline will execute Terraform commands to deploy
    changes to cluster. (triggered off Infra Generated repo)
- Atlantis does not have support for Azure DevOps repos (yet). Open PR is yet to
  be resolved (See footnotes).
  - Implementing Atlantis could potentially condense repos, and reduce the
    number of Azure DevOps pipelines in CI/CD workflow.

## Footnotes

- https://github.com/runatlantis/atlantis/pull/719
- https://medium.com/runatlantis/introducing-atlantis-6570d6de7281
