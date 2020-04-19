# SPK

[![Build Status](https://dev.azure.com/epicstuff/bedrock/_apis/build/status/microsoft.bedrock-cli?branchName=master)](https://dev.azure.com/epicstuff/bedrock/_build/latest?definitionId=2328&branchName=master)
![Azure DevOps coverage](https://img.shields.io/azure-devops/coverage/epicstuff/bedrock/2328/master)

`spk` helps you automate, manage, and observe Kubernetes deployment operations
based on [Bedrock](http://aka.ms/bedrock) patterns and principles.

Key features:

1. Builds event triggered GitOps pipelines
   ([learn more](./guides/project-service-management-guide.md))
2. Provides tabular introspection of applications from Docker image build to
   multi-cluster deployment
   ([learn more](./guides/service-introspection-onboarding.md))
3. Streamlines management of versioned Terraform environments
   ([learn more](./guides/infra/README.md#guides))

![spk diagram](./guides/images/spk.png)

## Install

Download pre-compiled binaries of SPK on the
[release](https://github.com/microsoft/bedrock-cli/releases) page.

## CLI

```shell
$ spk
Usage: spk [options] [command]

The missing Bedrock CLI

Options:
  -v, --verbose      Enable verbose logging
  -V, --version      output the version number
  -h, --help         output usage information

Commands:
  init|i [options]   Initialize the spk tool for the first time.
  setup|s [options]  An interactive command to setup resources in azure and azure dev-ops
  deployment         Introspect your deployments
  hld                Commands for initalizing and managing a bedrock HLD repository.
  infra              Manage and modify your Bedrock infrastructure.
  project            Initialize and manage your Bedrock project.
  service            Create and manage services for a Bedrock project.
```

## Prerequisites

To use `spk`, you must make sure you have the following tools installed:

- `git` - at _least_ version 2.22. Follow download instructions
  [here](https://git-scm.com/downloads)

Follow instructions to download and install the rest of the prerequisites
[here.](https://github.com/microsoft/bedrock/blob/master/tools/prereqs/README.md)

## Getting Started

The fastest way to get started with `spk` is to following our interactive
initialization.

```bash
spk init -i
```

This will guide you through the process of creating a configuration.
Alternatively if you already have a [configuration file](./guide/config-file.md)
you can run the command:

```bash
spk init -f spk-config.yaml
```

## Guides

You will find several guides to help you get started on each of the areas at
[SPK guides](./guides/README.md).

- [Managing a bedrock project with SPK](./guides/project-service-management-guide.md)
- [Observing deployments with SPK](./guides/service-introspection-onboarding.md)
- [Simplifying multiple Terraform environments with SPK](./guides/infra/README.md#guides)

## CLI Command Reference

> https://microsoft.github.io/bedrock-cli/commands/

## Contributing

[Contributing to spk](./guides/contributing.md).
