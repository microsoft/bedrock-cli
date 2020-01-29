# Managing a bedrock project with spk

This is a work in progress guide on managing a project with
[bedrock](https://github.com/microsoft/bedrock/) workflows via the
[spk](https://github.com/catalystcode/spk) CLI tool.

## Table of Contents

- [Managing a bedrock project with spk](#managing-a-bedrock-project-with-spk)
  - [Table of Contents](#table-of-contents)
  - [Using SPK with Bedrock](#using-spk-with-bedrock)
  - [Requirements](#requirements)
  - [Components](#components)
    - [Cloud Resource Diagram](#cloud-resource-diagram)
    - [SPK](#spk)
      - [Setup SPK](#setup-spk)
      - [Generating Personal Access Token](#generating-personal-access-token)
      - [Create spk config file](#create-spk-config-file)
      - [Initializing spk](#initializing-spk)
    - [Repositories](#repositories)
      - [Materialized Manifests Repository](#materialized-manifests-repository)
        - [Initializing the Materialized Manifests Repository](#initializing-the-materialized-manifests-repository)
      - [High Level Definition Repository](#high-level-definition-repository)
        - [Initializing the High Level Definition Repository](#initializing-the-high-level-definition-repository)
      - [Application Repositories](#application-repositories)
        - [Initializing an Application Repository](#initializing-an-application-repository)
        - [Adding a Service to a Application Repository](#adding-a-service-to-a-application-repository)
        - [Creating a Service Revision](#creating-a-service-revision)
    - [Varible Groups](#varible-groups)
    - [Pipelines](#pipelines)

## Using SPK with Bedrock

1. First, make sure [Requirements](#requirements) are met
2. Create the required repositories (High Level Definition Repository,
   Materialized Manifests Repository) if they do not exist in the Azure Devops
   Project. Follow the guide
   [here](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-new-repo?view=azure-devops#create-a-repo-using-the-web-portal)
3. [Setup spk](#setup-spk)
4. Optional:
   [Initialize the Materialized Manifest Repository](#initializing-the-materialized-manifests-repository)
5. [Initialize the High Level Definition Repository](#initializing-the-high-level-definition-repository)
6. [Initialize the Bedrock Application Repository](#initializing-an-application-repository)
7. [Add a service to the Bedrock Application Repository](#adding-a-service-to-a-application-repository)
8. Optional: [Create a Service Revision](#creating-a-service-revision)

**Notes:**

- Steps 2-5 typically only need to be done once. Multiple clusters may be
  configured to sync from the single Materialized Manifest Repositories, and
  multiple Project repositories can be pointed to the single High Level
  Definition Repository.
- Step 6 can be repeated anytime you may need to create another Bedrock project.
- Step 7 can be run as many times as required to add a service to a Bedrock
  project.

## Requirements

This guide assumes a few things:

1. The application code and supporting repositories are hosted on
   [Azure Devops](https://azure.microsoft.com/en-us/services/devops/).
   - If starting from scratch, then first create a new Azure Devops Organization
     following the guide
     [here](https://docs.microsoft.com/en-us/azure/devops/user-guide/sign-up-invite-teammates?view=azure-devops),
     then create a project following the guide
     [here](https://docs.microsoft.com/en-us/azure/devops/organizations/projects/create-project?view=azure-devops&tabs=preview-page).
2. Inside the Azure Devops project, there exists repositories for:
   1. Materialized Manifests
   2. High Level Definitions Create the required repositories if they do not
      exist in the Azure Devops Project. Follow the guide
      [here](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-new-repo?view=azure-devops#create-a-repo-using-the-web-portal)
3. The application is packaged and run through a Docker image hosted on
   [Azure Container Registry](https://azure.microsoft.com/en-us/services/container-registry/)
4. The user running `spk` has full access to the above resources.
5. The user is running the latest `spk`
   [release](https://github.com/catalystcode/spk/releases).
6. The user has
   [Azure CLI installed](https://docs.microsoft.com/en-us/cli/azure/?view=azure-cli-latest).

## Components

### Cloud Resource Diagram

![spk resources](/docs/images/spk-resource-diagram.png "Bedrock SPK Resources")

### SPK

`spk` is the Command Line Interface that provides automation around defining and
operating Kubernetes clusters with Bedrock principles.

#### Setup SPK

Make sure to download the latest version of `spk` from the
[releases](https://github.com/catalystcode/spk/releases) page and add it to your
PATH.

To setup a local configuration:

1. [Generate a Personal Access Token](#generating-personal-access-token)
2. [Create a spk config file](#create-spk-config-file)
3. [Initialize spk](#initializing-spk)

#### Generating Personal Access Token

Generate a new Personal Access Token (PAT) to grant `spk` permissions in the
Azure Devops Project. Please grant PAT the following permissions:

- Build (Read & execute)
- Code (Read, write, & manage)
- Variable Groups (Read, create, & manage)

For help, follow the
[guide](https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops&tabs=preview-page).

#### Create spk config file

Create a copy of `spk-config.yaml` from the starter
[template](./../spk-config.yaml) with the appropriate values for the
`azure_devops` section.

**Note:** This `spk-config.yaml` should not be commited anywhere, as it contains
sensitive credentials.

#### Initializing spk

Run `spk init -f <spk-config.yaml>` where `<spk-config.yaml>` the path to the
configuation file.

**Note:** When running `spk init -f <spk-config.yaml>`, `spk` will copy the
values from the config file and store it into local memory elsewhere. If you
wish to utilize `spk` with another project or target, then you must rerun
`spk init` with another configuration first OR, you may overwrite each commands
via flags.

### Repositories

#### Materialized Manifests Repository

This repository holds all the materialized kubernetes manifests that should be
deployed to a cluster. If a cluster has been deployed via bedrock's terraform
templates, then flux should be configured to point to this repository and will
deploy all manifests in this repository to the cluster in a set interval.

##### Initializing the Materialized Manifests Repository

- [Create a repository in the given AzDO project.](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-new-repo?view=azure-devops#create-a-repo-using-the-web-portal)
- [Clone the repository.](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-new-repo?view=azure-devops#clone-the-repo-to-your-computer)
- Add a simple README to the repository
  ```
  touch README.md
  echo "This is the Flux Manifest Repository." >> README.md
  git add -A
  git commit -m "Initializing Materialized Manifests repository with a README."
  git push -u origin --all
  ```

#### High Level Definition Repository

This repository holds all the bedrock "High Level Definition" (HLD) yaml files
and associated configurations. These HLDs and configs are consumed via
[fabrikate](https://github.com/microsoft/fabrikate) to produce kubernetes
manifests. This is typically done via an Azure DevOps pipeline, and the
manifests output by fabrikate are placed into the Materialized Manifests
repository.

##### Initializing the High Level Definition Repository

- [Create a repository in the given AzDO project.](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-new-repo?view=azure-devops#create-a-repo-using-the-web-portal)
- [Clone the repository.](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-new-repo?view=azure-devops#clone-the-repo-to-your-computer)
- Initialize via `spk`, this will add the fabrikate
  [cloud-native](https://github.com/microsoft/fabrikate-definitions/tree/master/definitions/fabrikate-cloud-native)
  stack as a initial sample component.
  ```
  spk hld init
  git add -A
  git commit -m "Initializing HLD repository with the cloud-native stack."
  git push -u origin --all
  ```
- Deploy the Manifest Generation pipeline (optional flag parameters can be used
  if `spk` was not intialized)
  ```
  spk hld install-manifest-pipeline
  ```

**NOTE** `spk hld` command documentation can be found
[here](/docs/hld-management.md).

#### Application Repositories

These repositories hold the application code and its associated Dockerfiles.
Additionally, these repositories can hold one (single application) or more
(monorepository) applications depending on usecase and configuration. Typically,
each repository should be configured with a "hld-lifecycle" Azure DevOps pipeline
that will add all managed applications inside the repository to the High Level
Definition Repository. Additionally, each application inside the repository
should also have an associated Azure DevOps multi-stage pipeline that both
builds and deploys the latest Docker image to Azure Container Registry and
updates the associated configuation in the HLD repository with the latest image
tag.

-TBD Section on packages directory and manging monorepositories vs single
application repositories

##### Initializing an Application Repository

- [Create a repository in the given AzDO project.](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-new-repo?view=azure-devops#create-a-repo-using-the-web-portal)
- [Clone the repository.](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-new-repo?view=azure-devops#clone-the-repo-to-your-computer)
- Initialize the project via `spk`
  ```
  spk project init
  git add -A
  git commit -m "Initializing application repository."
  git push -u origin --all
  ```
- Create Variable Group via `spk` (optional flag parameters can be used if `spk`
  was not intialized)
  ```
  VARIABLE_GROUP_NAME=<my-vg-name>
  spk project create-variable-group $VARIABLE_GROUP_NAME -r $ACR_NAME -u $SP_APP_ID -t $SP_TENANT -p $SP_PASS
  git add -A
  git commit -m "Adding Project Variable Group."
  git push -u origin --all
  ```
  where `ACR_NAME` is the name of the Azure Container Registry where the Docker
  Images will be served from and `SP_APP_ID`, `SP_PASS`, and, `SP_TENANT` are an
  associated Service Principal's ID, Password, and Tenant, that have Read and
  Write access to the ACR.
- Deploy the lifecycle pipeline (optional flag parameters can be used if `spk`
  was not intialized)
  ```
  spk project install-lifecycle-pipeline
  ```

**NOTE** `spk project` command documentation can be found
[here](/docs/project-management.md).

##### Adding a Service to a Application Repository

- [Clone the repository.](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-new-repo?view=azure-devops#clone-the-repo-to-your-computer)
- Create the service via `spk`, there are optional parameters that _should_ be
  used to configure the service and its associated helm charts (other optional
  flag parameters can be used if `spk` was not intialized)
  ```
  SERVICE_NAME=<my-new-service-name>
  spk service create $SERVICE_NAME
  git add -A
  git commit -m "Adding $SERVICE_NAME to the repository."
  git push -u origin --all
  ```
- Deploy the service's multistage build pipeline via `spk` (optional flag
  parameters can be used if `spk` was not intialized)
  ```
  spk service install-build-pipeline $SERVICE_NAME
  ```

**NOTE** `spk service` command documentation can be found
[here](/docs/service-management.md).

##### Creating a Service Revision

- Create and checkout a new git branch
  ```
  git branch <my-new-feature-branch>
  git checkout <my-new-feature-branch>
  ```
- Make code changes and commit
  ```
  echo "# My New Added File" >> myNewFile.md
  git add myNewFile.md
  git commit -m "Adding my new file"
  git push --set-upstream origin <my-new-feature-branch>
  ```
- Create Service Revision via `spk` (optional flag parameters can be used if
  `spk` was not intialized)
  ```
  spk service create-revision
  ```

**NOTE** `spk service` command documentation can be found
[here](/docs/service-management.md).

### Varible Groups

TBD

- Done to hold secure credentials and secrets.

### Pipelines

TBD

- Application build & update (1 per application)
- HLD lifecycle (adds applications to HLD repo)
- HLD to Manifests (generates manifests via fabrikate and places manifests into
  flux's source repo)
