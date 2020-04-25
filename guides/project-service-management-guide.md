# Service Management in Bedrock

This document describes the workflow for deploying a set of services
[Bedrock](https://github.com/microsoft/bedrock/) workflows via the
[bedrock](https://github.com/microsoft/bedrock-cli) CLI tool.

## High Level Overview

1. Confirm you have met the [Requirements](#requirements) for Bedrock's
   automation.
2. [Install and configure Bedrock CLI](#installing-and-configuring-bedrock)
3. Create and configure the required
   [high level definition and manifest repositories](#repositories)
4. [Initialize the Bedrock Application Repository](#initializing-an-application-repository)
5. [Add a service to the Bedrock Application Repository](#adding-a-service-to-a-application-repository)
6. Optional: [Create a Service Revision](#creating-a-service-revision)

**Notes:**

- Steps 1-4 typically only need to be done once. Multiple clusters may be
  configured to sync from the single Materialized Manifest Repositories, and
  multiple Project repositories can be pointed to the single High Level
  Definition Repository.
- Step 5 can be repeated each time you need to onboard a service to your Bedrock
  automated infrastructure.
- Step 6 can be run as many times as required to add a service revision to a
  Bedrock project.

An overview of how these different pieces fit together from an automation
perspective:

![bedrock resources](./images/bedrock-resource-diagram.png "Bedrock CLI Resources")

## Requirements

This guide assumes a few things as requirements to use this automation:

1. The application code and supporting repositories are hosted on
   [Azure Devops](https://azure.microsoft.com/en-us/services/devops/).
   - If starting from scratch, then first create a
     [new Azure Devops Organization](https://docs.microsoft.com/en-us/azure/devops/user-guide/sign-up-invite-teammates?view=azure-devops),
     then
     [create a project](https://docs.microsoft.com/en-us/azure/devops/organizations/projects/create-project?view=azure-devops&tabs=preview-page).
2. The application will be packaged and run using container images hosted on
   [Azure Container Registry](https://azure.microsoft.com/en-us/services/container-registry/)
3. The user running `bedrock` has full access to the above resources.
4. The user is running the latest `bedrock`
   [release](https://github.com/microsoft/bedrock-cli/releases).
5. The user has
   [Azure CLI installed](https://docs.microsoft.com/en-us/cli/azure/?view=azure-cli-latest).
6. The user is running [git](http://git-scm.org) version
   [2.22](https://github.blog/2019-06-07-highlights-from-git-2-22/) or later.
7. Optional: If a user wishes to store helm charts in the application
   repositories, then all repositories (application, high level definition,
   materialized manifests) must be in the same Azure DevOps Organization AND
   Project.

## Installing and Configuring Bedrock

`bedrock` is the Command Line Interface that provides automation around defining
and operating Kubernetes clusters with Bedrock principles.

### Setup Bedrock

Download the latest version of `bedrock` from the
[releases](https://github.com/microsoft/bedrock-cli/releases) page and add it to
your PATH.

To setup a local configuration:

1. [Generate a Personal Access Token](#generating-personal-access-token)
2. [Create a bedrock config file](#create-bedrock-config-file)
3. [Initialize bedrock](#initializing-bedrock)

### Generate Personal Access Token

Generate a new Personal Access Token (PAT) to grant `bedrock` permissions in the
Azure Devops Project. Please grant PAT the following permissions:

- Build (Read & execute)
- Code (Read, write, & manage)
- Variable Groups (Read, create, & manage)

For help, follow the
[guide](https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops&tabs=preview-page).

### Create Bedrock config file

Create a copy of `bedrock-config.yaml` from the starter
[template](./../bedrock-config.yaml) with the appropriate values for the
`azure_devops` section.

**Note:** This `bedrock-config.yaml` should not be commited anywhere, as it
contains sensitive credentials.

### Initialize Bedrock

Run `bedrock init -f <bedrock-config.yaml>` where `<bedrock-config.yaml>` the
path to the configuation file.

**Note:** When running `bedrock init -f <bedrock-config.yaml>`, `bedrock` will
copy the values from the config file and store it into local memory elsewhere.
If you wish to utilize `bedrock` with another project or target, then you must
rerun `bedrock init` with another configuration first OR, you may overwrite each
commands via flags.

## Repositories

Our next step is to create or onboard the repositories that support the
deployment of our services:

1. The high level definition repository
2. The materialized manifest repository
3. The application source code repository

### High Level Definition Repository

This repository holds the Bedrock High Level Deployment Definition (HLD) and
associated configurations.

This HLD is processed via [fabrikate](https://github.com/microsoft/fabrikate) in
Azure Devops on each change to generate Kubernetes YAML manifests that are
applied to the Kubernetes cluster by Flux.

#### Initializing the High Level Definition Repository

- [Create a repository in the given AzDO project.](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-new-repo?view=azure-devops#create-a-repo-using-the-web-portal)
- Edit your Bedrock config to point to this repo (if you haven't already done
  this).
- [Clone the repository.](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-new-repo?view=azure-devops#clone-the-repo-to-your-computer)
- Initialize via `bedrock`, this will add the fabrikate
  [traefik2](https://github.com/microsoft/fabrikate-definitions/tree/master/definitions/traefik2)
  as the initial sample component. This can be overridden via optional flags.
  ```
  bedrock hld init --git-push
  ```

**NOTE** `bedrock hld` command documentation can be found
[here](./hld-management.md).

### Materialized Manifests Repository

This repository holds all the materialized kubernetes manifests that should be
deployed to a cluster. If a cluster has been deployed via Bedrock's Terraform
templates, then flux should be configured to point to this repository and will
deploy all manifests in this repository to the cluster periodically.

#### Initializing the Materialized Manifests Repository

- [Create a repository in the given AzDO project.](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-new-repo?view=azure-devops#create-a-repo-using-the-web-portal)
- Edit your Bedrock config to point to this repo (if you haven't already done
  this).
- [Clone the repository.](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-new-repo?view=azure-devops#clone-the-repo-to-your-computer)
- Add a simple README to the repository
  ```
  touch README.md
  echo "This is the Flux Manifest Repository." >> README.md
  git add -A
  git commit -m "Initializing Materialized Manifests repository with a README."
  git push -u origin --all
  ```

#### Deploy Manifest Generation Pipeline

Deploy a manifest generation pipeline between the high level definition repo and
the materialized manifests repo. Assuming you have configured `bedrock`, you can
run this without flag parameters from your HLD repo root:

```
$ bedrock hld install-manifest-pipeline
```

### Application Repositories

These repositories hold the application code, its associated Dockerfile(s), and
helm deployment charts.

Additionally, these repositories can hold one (single application) or more
(monorepository) applications depending on your development methodology.
Typically, each repository shold be configured with a "hld-lifecycle" Azure
DevOps pipeline that will add all managed applications inside the repository to
the High Level Definition Repository. Additionally, each application inside the
repository should also have an associated Azure DevOps multi-stage pipeline that
both builds and deploys the latest Docker image to Azure Container Registry and
updates the associated configuation in the HLD repository with the latest image
tag.

-TBD Section on packages directory and manging monorepositories vs single
application repositories

#### Initializing an Application Repository

- [Create a repository in the given AzDO project.](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-new-repo?view=azure-devops#create-a-repo-using-the-web-portal)
- [Clone the repository.](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-new-repo?view=azure-devops#clone-the-repo-to-your-computer)
- Initialize the project via `bedrock`
  ```
  $ bedrock project init
  $ git add -A
  $ git commit -m "Initializing application repository."
  $ git push -u origin --all
  ```
- Create a variable group via `bedrock`. If you are using a repo per service
  source control strategy, you only need to do this once.
  ```
  $ export VARIABLE_GROUP_NAME=<my-vg-name>
  $ bedrock project create-variable-group $VARIABLE_GROUP_NAME -r $ACR_NAME -u $SP_APP_ID -t $SP_TENANT -p $SP_PASS
  $ git add -A
  $ git commit -m "Adding Project Variable Group."
  $ git push -u origin --all
  ```
  where `ACR_NAME` is the name of the Azure Container Registry where the Docker
  Images will be served from and `SP_APP_ID`, `SP_PASS`, and, `SP_TENANT` are an
  associated Service Principal's ID, Password, and Tenant, that have Read and
  Write access to the ACR.
- Deploy the lifecycle pipeline (optional flag parameters can be used if
  `bedrock` was not intialized)

  ```
  $ bedrock project install-lifecycle-pipeline --org-name $ORG_NAME --devops-project $DEVOPS_PROJECT --repo-url $SERVICE_REPO_URL --repo-name $SERVICE_NAME
  ```

  where `ORG_NAME` is the name of your Azure Devops org, `DEVOPS_PROJECT` is the
  name of your Azure Devops project, `SERVICE_REPO_URL` is the url that you used
  to clone your service from Azure Devops, and `SERVICE_NAME` is the name of the
  service.

  Note: If you are using a repo per service source control strategy you should
  run `install-lifecycle-pipeline` once for each repo.

**NOTE** `bedrock project` command documentation can be found
[here](./project-management.md).

#### Adding a Service to a Application Repository

- [Clone the repository.](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-new-repo?view=azure-devops#clone-the-repo-to-your-computer)
- Create the service via `bedrock`, there are optional parameters that _should_
  be used to configure the service and its associated helm charts (other
  optional flag parameters can be used if `bedrock` was not intialized)
  ```
  SERVICE_NAME=<my-new-service-name>
  bedrock service create $SERVICE_NAME . ...
  git add -A
  git commit -m "Adding $SERVICE_NAME to the repository."
  git push -u origin --all
  ```
- Deploy the service's multistage build pipeline via `bedrock` (optional flag
  parameters can be used if `bedrock` was not intialized)
  ```
  bedrock service install-build-pipeline . -n $SERVICE_NAME-build-pipeline -o $ORG_NAME -r $SERVICE_NAME -u $SERVICE_REPO_URL -d $DEVOPS_PROJECT
  ```
- Review and accept the pull request to add the service to the high level
  definition in Azure Devops.

**NOTE** `bedrock service` command documentation can be found
[here](./service-management.md).

#### Helm Configuration for Bedrock CLI

`bedrock service create` allows a user to configure a service a number of ways
with a backing helm chart.

Presently, there are are a number of options for `bedrock service create`
documented below:

```
  -c, --helm-chart-chart <helm-chart>                         bedrock helm chart name. --helm-chart-* and --helm-config-* are exclusive; you may only use one. (default: "")
  -r, --helm-chart-repository <helm-repository>               bedrock helm chart repository. --helm-chart-* and --helm-config-* are exclusive; you may only use one. (default: "")

  -g, --helm-config-git <helm-git>                            bedrock helm chart configuration git repository. --helm-chart-* and --helm-config-* are exclusive; you may only use one. (default: "")
  -b, --helm-config-branch <helm-branch>                      bedrock custom helm chart configuration branch. --helm-chart-* and --helm-config-* are exclusive; you may only use one. (default: "")
  -p, --helm-config-path <helm-path>                          bedrock custom helm chart configuration path. --helm-chart-* and --helm-config-* are exclusive; you may only use one. (default: "")
  --service-build-vg <variable-group>                         existing azure devops variable groups
  may use multiple. (default: "")
  --service-build-variables <variables>                       existing variables from azure devops variable groups
  may use multiple. (default: "")
```

As noted by the the documentation text, `helm-chart-*` and `helm-config-*` are
both mutually exclusive configurations: you can _only_ use one set of
configurations or the other.

This section intends on documenting the various use cases for both sets of
mutually exclusive configurations.

##### Helm Charts in a well-known Helm Repository

A Helm Repository is a well known set of helm charts conforming to the
[helm repository guidelines](https://helm.sh/docs/topics/chart_repository/).
Perhaps the best known helm repository is the community run
[helm charts repository](https://github.com/helm/charts).

As an `bedrock` user, if you would like to incorporate helm charts from a well
known public repository, you may simply run `bedrock` the following `helm-chart`
arguments:

```sh
bedrock service create nginx my-nginx-service --helm-chart-chart stable/nginx --helm-chart-repository github.com/helm/charts
```

##### Helm Charts in a distinct Git Repository from Application Sources in the same Azure DevOps Project

If your Helm Charts are in their own distinct Git Repository in the _same_ Azure
DevOps project, you can use the `helm-config` arguments to configure `bedrock`:

```
bedrock service create fabrikam path/to/fabrikam \
  --helm-config-git https://dev.azure.com/fabrikam/fabrikam-project/_git/fabrikam-helm-charts
  --helm-config-branch master \
  --helm-path /charts/fabrikam
```

The above invocation presumes that the helm chart repository configured for
`bedrock` is _different_ from the application repository configured for
`bedrock` usage.

The `helm-config-git` parameter _must not_ contain the username portion of a
url. If you retrieve the URL from Azure DevOps's "Clone Repository" UI, it will
automatically have the username filled for an HTTPs clone ie:

`https://fabrikam@dev.azure.com/fabrikam/fabrikam-project/_git/fabrikam-helm-charts`

Ensure that the you _remove_ the `fabrikam@` portion of the URL when passing
parameters to `bedrock service create --helm-config-git`:

`https://dev.azure.com/fabrikam/fabrikam-project/_git/fabrikam-helm-charts`

When you invoke `bedrock service create` with `--helm-config` argments, there is
a 4th optional argument that can be provided
`--helm-config-access-token-variable`. This configuration option is the name of
the environment variable containing a Personal Access Token to access the git
repository in `helm config git`. In this scenario, however, both git
repositories are in the same Azure DevOps project, `fabrikam-project`, so it is
un-necessary to provide `--helm-config-access-token-variable`, as the Personal
Access Token utilized by the pipelines, `ACCESS_TOKEN_SECRET`, will be the same
for both application repository and helm chart repository. When
`--helm-config-access-token-variable` is not provided, the repository defined by
`--helm-config-git` will automatically use `ACCESS_TOKEN_SECRET`. The following
scenario covers a situation in which you will want to configure the
`--helm-config-access-token-variable` to something custom.

##### Helm Charts in a distinct Git Repository from Application Sources in a different Azure DevOps Project

If your Helm Charts are in their own distinct Git Repository in a different
Azure DevOps project, you can use still use the `helm-config` arguments to
configure `bedrock`, but must also provide another option,
`--helm-config-access-token-variable`. This configuration option is the name of
the environment variable containing the Personal Access Token to access the git
repository in `helm-config-git`:

```
bedrock service create fabrikam path/to/fabrikam \
  --helm-config-git https://dev.azure.com/fabrikam/fabrikam-helm-charts-project/_git/fabrikam-helm-charts \
  --helm-config-branch master \
  --helm-path /charts/fabrikam \
  --helm-config-access-token-variable FABRIKAM_HELM_CHARTS_REPO_PAT
```

The `helm-config-git` parameter _must not_ contain the username portion of a
url. If you retrieve the URL from Azure DevOps's "Clone Repository" UI, it will
automatically have the username filled for an HTTPs clone ie:

`https://fabrikam@dev.azure.com/fabrikam/fabrikam-helm-charts-project/_git/fabrikam-helm-charts`

Ensure that the you _remove_ the `fabrikam@` portion of the URL when passing
parameters to `bedrock service create --helm-config-git`:

`https://dev.azure.com/fabrikam/fabrikam-helm-charts-project/_git/fabrikam-helm-charts`

Note the different Azure DevOps URL for the helm charts project in Azure DevOps
and the addition of the `--helm-config-access-token-variable` parameter.

The `--helm-config-access-token-variable` parameter configures how an
`access.yaml` file is written to the HLD for `fabrikate` to consume when
rendering helm charts. For more information on authenticating with private git
repositories when rendering helm charts, please refer to
[fabrikate's documentation](https://github.com/microsoft/fabrikate/blob/master/docs/auth.md).

When the bedrock.yaml is committed, all the pipelines created, and the HLD
repository is populated, you must add the environment variable,
`FABRIKAM_HELM_CHARTS_REPO_PAT` to the HLD to Materialized pipeline as a
pipeline variable. To do so, find the HLD to Materialized pipeline in the
pipelines view on Azure DevOps, select it, select `Variables`, then select
`New Variable`:

![Add a new pipeline variable](./images/bedrock-add-variable.png)

##### Helm Charts in the same repository as the application

If your Helm Charts are intended to be placed adjacent to your application
source (no distinct git repository), you may still use the `helm-config`
arguments to configure `bedrock`.

If you presume that the `fabrikam-app` repository is the _same_ repository as
the repository of your application sources, then the following invocation will
allow a user to configure a service with helm charts tracked in the _same_
repository.

```
bedrock service create
  --helm-config-git https://dev.azure.com/fabrikam/fabrikam-project/_git/fabrikam-app \
  --helm-config-branch master \
  --helm-path /charts/fabrikam
```

The `helm-config-git` parameter _must not_ contain the username portion of a
url. If you retrieve the URL from Azure DevOps's "Clone Repository" UI, it will
automatically have the username filled for an HTTPs clone ie:

`https://fabrikam@dev.azure.com/fabrikam/fabrikam-project/_git/fabrikam-helm-charts`

Ensure that the you _remove_ the `fabrikam@` portion of the URL when passing
parameters to `bedrock service create --helm-config-git`:

`https://dev.azure.com/fabrikam/fabrikam-project/_git/fabrikam-helm-charts`

#### Passing Variables as Dockerfile Build Arguments

If you want to pass in build arguments during the Dockerfile build process, you
can inject them using the `--service-build-vg` and `--service-build-variables`
arguments, which will take in multiple variable groups and variables,
respectively.

```
bedrock service create
  --helm-config-git https://dev.azure.com/fabrikam/fabrikam-project/_git/fabrikam-app \
  --helm-config-branch master \
  --helm-path /charts/fabrikam \
  --service-build-vg bedrock-vg,fabrikam-vg \
  --service-build-variables FOO,BAR
```

In this example, variables `FOO` and `BAR` exist in either variable groups
`bedrock-vg` or `fabrikam-vg`, and will be passed in as build arguments for the
Dockerfile.

**NOTE**: It is important to understand that Azure DevOps will have the last
variable group in the pipeline yaml take precedence. This means that if you have
the same variable defined in both variable groups, the variable will take the
value from the **last** variable group appended to the pipeline yaml file.

#### Creating a Service Revision

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
- Create Service Revision via `bedrock` (optional flag parameters can be used if
  `bedrock` was not intialized)
  ```
  bedrock service create-revision . -n $SERVICE_NAME-build-pipeline -o $ORG_NAME -r $SERVICE_NAME -u $SERVICE_REPO_URL -d $DEVOPS_PROJECT
  ```

**NOTE** `bedrock service` command documentation can be found
[here](./service-management.md).

## Helm Charts

To have bedrock's build pipelines work properly, an application needs an
associated [Helm](https://helm.sh/) chart with specific variables.

See the
[guide to building helm charts with bedrock for more details](./building-helm-charts-for-bedrock.md)

### Requirements

TBD

### Sample Helm Chart

This repository bundles a sample helm chart. Please refer to the
[guide for building helm charts](./building-helm-charts-for-bedrock.md) and the
[sample helm chart](./sample-helm-chart) for details.

## Variable Groups

TBD

- Done to hold secure credentials and secrets.

## Pipelines

TBD

- Application build & update (1 per application)
- HLD lifecycle (adds applications to HLD repo)
- HLD to Manifests (generates manifests via fabrikate and places manifests into
  flux's source repo)
