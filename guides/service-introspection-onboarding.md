# Service Introspection: Getting Started

Service Introspection shows information about a
[Bedrock GitOps workflow](https://github.com/microsoft/bedrock/tree/master/gitops).

Service introspection is used via the `bedrock deployment` commands. More
information about the commands is available in the command reference
[here](./service-introspection.md).

The following diagram shows the main components of service introspection.
![bedrock service introspection diagram](./images/service_introspection.png)

To use service introspection you first need to make sure you have the following
pre-requisites.

## Components

1. GitOps pipelines workflow in Bedrock. To setup the workflow, follow
   [these](https://github.com/microsoft/bedrock/tree/master/gitops)
   instructions.
2. [Service introspection storage in Azure](#service-introspection-storage). See
   below for instructions on how to create one.
3. [Pipelines configuration](#pipelines-configuration)

### Service introspection storage

Service introspection tool needs a database to store the information about your
pipelines, builds and deployments. Currently, service introspection supports
storage in the form of an Azure Storage table. Follow the steps below to create
it or use an existing one.

#### 1.Create an Azure storage account:

**Option 1:**

Use the
[`bedrock deployment onboard`](https://microsoft.github.io/bedrock-cli/commands/#master@deployment_onboard)
command.

**Option 2:**

Create the account manually or use an existing storage account. You will need to
have the following properties of this storage before proceeding as they are
required to configure:

- Name of the storage account
- Access key to this storage account
- Table name (this is the table that will store Spektate introspection details)

Once you have a storage account with a table, you may proceed to start updating
the pipelines to send data to Spektate storage.

**Note:** The Azure storage account is needed to store information about your
pipelines and services that is displayed by service introspection.

#### 2. Create a table. Follow these

[instructions](https://docs.microsoft.com/en-us/azure/storage/tables/table-storage-quickstart-portal).

### Pipelines Configuration

The Bedrock GitOps pipelines need to be configured to start sending data to
`bedrock` service introspection. This is done by adding a script snippet in each
`azure-pipelines.yml` configuration.

#### 1. Configure a variable group

To send data from Azure pipelines to the service introspection storage created
previously a variable group needs to be configured in Azure DevOps (where the
pipelines are).

You will need the following variables:

- `INTROSPECTION_ACCOUNT_KEY`: Set this to the access key for your storage
  account
- `INTROSPECTION_ACCOUNT_NAME`: Set this to the name of your storage account
- `INTROSPECTION_PARTITION_KEY`: This field can be a distinguishing key that
  recognizes your source repository in the storage, for eg. in this example,
  we're using the name of the source repository `hello-bedrock`
- `INTROSPECTION_TABLE_NAME`: Set this to the name of the table in your storage
  account that you prefer to use

![](./images/variable_group.png)

#### 2. CI pipeline configuration

The CI pipeline runs from the source repository to build a docker image.

**Important note**: If you used bedrock to configure your pipelines, the
following scripts should already be present in your pipelines with the condition
that above variables are specified in a variable group. In that case make sure
the pipeline has added the variable group that defines the above variables, and
you may skip the steps ahead!

Paste the following task in its corresponding `azure-pipelines.yml`:

```yaml
- bash: |
    tag_name="hello-spektate-$(Build.SourceBranchName)-$(Build.BuildId)"
    commitId=$(Build.SourceVersion)
    commitId=$(echo "${commitId:0:7}")
    service=$(Build.Repository.Name)
    service=${service##*/}
    echo "Downloading Bedrock"
    curl https://raw.githubusercontent.com/Microsoft/bedrock/master/gitops/azure-devops/build.sh > build.sh
    chmod +x build.sh
    . ./build.sh --source-only
    get_bedrock_version
    download_bedrock
    ./bedrock/bedrock deployment create -n $(INTROSPECTION_ACCOUNT_NAME) -k $(INTROSPECTION_ACCOUNT_KEY) -t $(INTROSPECTION_TABLE_NAME) -p $(INTROSPECTION_PARTITION_KEY) --p1 $(Build.BuildId) --image-tag $tag_name --commit-id $commitId --service $service

  displayName: Update manifest pipeline details in Spektate db
```

This task will update the service introspection storage table for every build
that runs from the source repository. This information will be available for use
by service introspection.

##### Note:

- Make sure the variable `tag_name` is set to the tag name for the image being
  built in your docker step.

- Add the task before the crucial steps in your pipeline. This will capture
  details about failures if the important steps fail.

- To specify the `bedrock` version you want to download, set the `VERSION`
  environment variable. With this, `get_bedrock_version` will download that
  version. If `VERSION` is not set, it will download the latest version.

#### 3. CD release pipeline (ACR to HLD) configuration

The CD release pipeline updates the docker image number in the HLD.

The release pipeline can be setup in two different ways: There are two options
to setup the ACR to HLD step.

\***\*Option 1:\*\*** As an
[Azure Release Pipeline](https://docs.microsoft.com/en-us/azure/devops/pipelines/release/?view=azure-devops)

**Instructions:**

Paste the following task towards the end of your release step in the release
pipeline in the Azure DevOps portal:

```yaml
latest_commit=$(git rev-parse --short HEAD) curl
https://raw.githubusercontent.com/Microsoft/bedrock/master/gitops/azure-devops/build.sh
> build.sh chmod +x build.sh . ./build.sh --source-only get_bedrock_version
download_bedrock ./bedrock/bedrock deployment create  -n
$(INTROSPECTION_ACCOUNT_NAME) -k $(INTROSPECTION_ACCOUNT_KEY) -t
$(INTROSPECTION_TABLE_NAME) -p $(INTROSPECTION_PARTITION_KEY)  --p2
$(Release.ReleaseId) --hld-commit-id $latest_commit --env
$(Release.EnvironmentName) --image-tag $(Build.BuildId)
```

This task is similar to the one from step 1 but instead passes the information
that corresponds to the CD release pipeline.

\***\*Option 2:** As a **stage\*\*** (if your setup is a
[Multi-stage Azure Pipeline](https://devblogs.microsoft.com/devops/whats-new-with-azure-pipelines/))

**Instructions:**

Paste the following yaml task towards the end of your image tag release stage in
your multi-stage `azure-pipelines.yml`:

```yaml
latest_commit=$(git rev-parse --short HEAD) tag_name=$(Build.BuildId) echo
"Downloading Bedrock" curl
https://raw.githubusercontent.com/Microsoft/bedrock/master/gitops/azure-devops/build.sh
> build.sh chmod +x build.sh . ./build.sh --source-only get_bedrock_version
download_bedrock ./bedrock/bedrock deployment create  -n
$(INTROSPECTION_ACCOUNT_NAME) -k $(INTROSPECTION_ACCOUNT_KEY) -t
$(INTROSPECTION_TABLE_NAME) -p $(INTROSPECTION_PARTITION_KEY)  --p2
$(Build.BuildId) --hld-commit-id $latest_commit --env $(Build.SourceBranchName)
--image-tag $tag_name
```

Make sure your variable `tag_name` in this script matches the `tag_name` in the
source build pipeline step above.

You can find a working example of a multi-stage `azure-pipelines.yml`
configuration
[here](https://github.com/edaena/spartan-app/blob/master/azure-pipelines.yml).

#### 4. HLD manifest pipeline configuration

The HLD manifest pipeline builds the HLD using `fabrikate` and generates
resource manifests that are then placed in the resource manifest repository.

Paste the following task in the `azure-pipelines.yml` file **after** the
`fabrikate` steps:

```yaml
- bash: |
    cd "$HOME"/<name of your manifest repository>
    commitId=$(Build.SourceVersion)
    commitId=$(echo "${commitId:0:7}")
    latest_commit=$(git rev-parse --short HEAD)
    echo "Downloading Bedrock"
    curl https://raw.githubusercontent.com/Microsoft/bedrock/master/gitops/azure-devops/build.sh > build.sh
    chmod +x build.sh
    . ./build.sh --source-only
    get_bedrock_version
    download_bedrock
    ./bedrock/bedrock deployment create -n $(INTROSPECTION_ACCOUNT_NAME) -k $(INTROSPECTION_ACCOUNT_KEY) -t $(INTROSPECTION_TABLE_NAME) -p $(INTROSPECTION_PARTITION_KEY) --p3 $(Build.BuildId) --hld-commit-id $commitId --manifest-commit-id $latest_commit
  displayName: Update manifest pipeline details in Spektate db
```

## Getting started

After completing the steps in this guide, you should be able to:

- Fill out the `azure_devops` and `introspection` settings in
  [`bedrock-config.yaml`](https://github.com/microsoft/bedrock-cli/blob/master/bedrock-config.yaml)
  so that you can use service introspection. More information about `bedrock`
  config can be found on the
  [main page](https://github.com/microsoft/bedrock-cli).

- Validate and verify the `bedrock-config.yaml` settings and the service
  introspection storage using
  [`bedrock deployment validate`](https://microsoft.github.io/bedrock-cli/commands/#master@deployment_validate)

- Get information about your deployment using
  [`bedrock deployment get`](https://microsoft.github.io/bedrock-cli/commands/#master@deployment_get)

- Launch the dashboard to visualize the data using
  [`bedrock deployment dashboard`](https://microsoft.github.io/bedrock-cli/commands/#master@deployment_dashboard)
