## Description

This command assists in creating resources in Azure DevOps so that you can get
started with using Bedrock. It creates

1. An Azure DevOps project.

By Default, it runs in an interactive mode where you are prompted for answers
for a few questions

1. Azure DevOps Organization Name
2. Azure DevOps Project Name, the project to be created.
3. Azure DevOps Personal Access Token. The token needs to have these permissions
   1. Read and write projects.
   2. Read and write codes.
4. To create a sample application Repo
   1. If Yes, a Azure Service Principal is needed. You have 2 options
      1. have the command line tool to create it. Azure command line tool shall
         be used. You will be prompted to select a subscription identifier.
      2. Provide the Service Principal Id, Password, and Tenant Id. From this
         information, the tool will retrieve the subscription identifier.

It can also run in a non interactive mode by providing a file that contains
answers to the above questions.

After this command is successfully executed, you can launch the introspection
dashboard to view the status of pipelines.

```
bedrock setup --file <file-name>
```

Content of this file is as follow

```
azdo_org_name=<Azure DevOps Organization Name>
azdo_project_name=<Azure DevOps Project Name>
azdo_pat=<Azure DevOps Personal Access Token>
az_create_app=<true to create sample service app>
az_create_sp=<true to have command line to create service principal>
az_sp_id=<sevice principal Id need if az_create_app=true and az_create_sp=false>
az_sp_password=<sevice principal password need if az_create_app=true and az_create_sp=false>
az_sp_tenant=<sevice principal tenant Id need if az_create_app=true and az_create_sp=false>
az_subscription_id=<subscription id>
az_acr_name=<name of azure container registry>
```

`azdo_project_name` is optional and default value is `BedrockRocks`.

The followings shall be created

1. A working directory, `quick-start-env`
2. Project shall not be created if it already exists.
3. A Git Repo, `quick-start-hld`, it shall be deleted and recreated if it
   already exists.
   1. And initial commit shall be made to this repo
4. A Git Repo, `quick-start-manifest`, it shall be deleted and recreated if it
   already exists.
   1. And initial commit shall be made to this repo
5. A High Level Definition (HLD) to Manifest pipeline.
6. If user chose to create sample app repo
   1. A Service Principal (if requested)
   1. A resource group, `quick-start-rg` if it does not exist.
   1. A storage account if it does not exist. Storage Account name has to be
      unqiue acess Azure.
   1. A storage table in the storage account.
   1. A Azure Container Registry, `quickStartACR` in resource group,
      `quick-start-rg` if it does not exist.
   1. A Git Repo, `quick-start-helm`, it shall be deleted and recreated if is
      already exists.
   1. A Git Repo, `quick-start-app`, it shall be deleted and recreated if is
      already exists.
   1. A Lifecycle pipeline.
   1. A Build pipeline.

## Pre-requisite

1. azure cli needs to be installed so that pull request can be automatically
   approved. type `az version` to check if you have version 2.0.x installed.
2. install `azure-devops` extension. To check if you have the extension, type
   `az extension list`

## Setup log

A `setup.log` file is created after running this command. This file contains
information about what are created and the execution status (completed or
incomplete). This file will not be created if input validation failed.

## Note

To remove the service principal that it is created by the tool, you can do the
followings:

1. Get the identifier from `setup.log` (look for `az_sp_id`)
2. run on terminal `az ad sp delete --id <the sp id>`
