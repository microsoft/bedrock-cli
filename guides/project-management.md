# Project Management

Create and manage components for a Bedrock project. All project management
commands will need to run in the order as listed below due to dependencies.

Usage:

```
Usage: project [options] [command]

Initialize and manage your Bedrock project.

Options:
  -v, --verbose                                              Enable verbose logging
  -h, --help                                                 output usage information

Commands:
  create-variable-group|cvg [options] <variable-group-name>  Create a new variable group in Azure DevOps project with specific variables (ACR name, HLD Repo name, Personal Access Token, Service Principal id, Service Principal password, and Azure AD tenant id)
  init|i [options]                                           Initialize your spk repository. Add starter bedrock.yaml, maintainers.yaml, hld-lifecycle.yaml, and .gitignore files to your project.
  install-lifecycle-pipeline|p [options]                     Install the hld lifecycle pipeline to your Azure DevOps instance
```

## Prerequisites

An Azure DevOps git repository.

## Commands

- [init](https://catalystcode.github.io/spk/commands/index.html#project_init)
- [create-variable-group](https://catalystcode.github.io/spk/commands/index.html#project_create-variable-group)
- [install-lifecycle-pipeline](https://catalystcode.github.io/spk/commands/index.html#project_install-lifecycle-pipeline)

**Please note all project management commands must run in the order as listed
above.**
