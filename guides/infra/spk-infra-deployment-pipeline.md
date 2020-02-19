# Guide: Infrastructure Deployment Pipeline

Before reading this guide, it is recommended to visit the guide on deploying an
[Infra Generation Pipeline](./spk-infra-generation-pipeline.md).

This section will cover approaches for deploying your infrastructure, which
captures the process for applying changes to your existing Terraform
infrastructure. This guide will not go into detail about implementing each of
the approaches, but instead will suggest different methods for deploying your
infrastructure when already using `spk` to manage infrastructure.

## Approaches

### Manual Deployment

With the ability to manage and execute `spk infra` commands locally, it is often
more secure to be running `terraform apply` to create or update production
infrastructure manually. This means that you can still rely on `spk infra` to
scaffold and generate your terrafom projects, but any terraform operations will
be handled manually.

If you make changes to any `definition.yaml` files in your project hierarchy,
and want to push those changes to an existing infrastructure, this will require
you to re-generate the terraform scripts by running `spk infra generate` on the
targeted project folder (i.e. `east`), and from there, you can execute
`terraform apply` on the regenerated terraform files to update individual
clusters.

### Deployment Pipeline using Azure DevOps

Some may find automating terraform executions in a pipeline to be a more
favorable approach for infrastructure deployment. This approach will require
prerequisite actions to occur beforehand:

1. Access to an Azure DevOps account with permissions to create repos, and
   pipelines
2. A pipeline script, which at the minimum, will perform the following:
   - Triggered from commits made to the master branch of a Generated repo
   - Download and install Terraform
   - Run `terraform apply` on terraform scripts
