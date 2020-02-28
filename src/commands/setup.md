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

It can also run in a non interactive mode by providing a file that contains
answers to the above questions.

```
spk setup --file <file-name>
```

Content of this file is as follow

```
azdo_org_name=<Azure DevOps Organization Name>
azdo_project_name=<Azure DevOps Project Name>
azdo_pat=<Azure DevOps Personal Access Token>
```

azdo_project_name is optional and default value is `BedrockRocks`
