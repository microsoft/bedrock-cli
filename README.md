# SPK

[![Build Status](https://dev.azure.com/epicstuff/bedrock/_apis/build/status/CatalystCode.spk?branchName=master)](https://dev.azure.com/epicstuff/bedrock/_build/latest?definitionId=128&branchName=master)
![Azure DevOps coverage](https://img.shields.io/azure-devops/coverage/epicstuff/bedrock/128/master)

`spk` is a tool that provides automation around defining and operating
Kubernetes clusters with [Bedrock](https://github.com/microsoft/bedrock)
principles.

The three core areas of `spk` are:

- [Service Introspection](./docs/service-introspection.md)
- [Service Management](./docs/service-management.md)
- [Cloud Infra Management](./docs/cloud-infra-management.md)

![spk diagram](./docs/images/spk.png)

For more information on the end-to-end experience of using Bedrock principles
refer to:
[Bedrock Developer and Operations Experience](https://github.com/CatalystCode/bedrock-end-to-end-dx)

## Installation

Please refer to the latest SPK
[release](https://github.com/CatalystCode/spk/releases) and navigate to the
_assets_ section. From there choose from one of the following platform options
to download:

- linux
- macos
- windows

## CLI

```
Usage: spk [options] [command]

The missing Bedrock CLI

Options:
  -v, --verbose     Enable verbose logging
  -V, --version     output the version number
  -h, --help        output usage information

Commands:
  init|i [options]  Initialize the spk tool for the first time.
  deployment        Introspect your deployments
  project           Initialize and manage your Bedrock project.
  service           Create and manage services for a Bedrock project.
  infra             Manage and modify your Bedrock infrastructure.
  hld               Commands for initalizing and managing a bedrock HLD repository.
  variable-group    Creates Variable Group in Azure DevOps project.
```

## `spk` commands docs

- [spk deployment](./docs/service-introspection.md)
- [spk hld](./docs/hld-management.md)
- [spk infra](./docs/cloud-infra-management.md)
- [spk init](./docs/init.md)
- [spk project](./docs/project-management.md)
- [spk service](./docs/service-management.md)
- [spk variable-group](./docs/variable-group.md)

## Getting Started

To utilize `spk` as your bedrock project and service management tool, follow the
[Managing a bedrock project with spk guide](/docs/project-service-management-guide.md).

Otherwise, generally:

To start using `spk` you'll need to:

1. Configure `spk` in `spk-config.yaml`. Refer to [this](./spk-config.yaml)
   template to get started.
2. Run `spk init -f spk-config.yaml`

### spk-config.yaml

The [`spk-config.yaml`](./spk-config.yaml) consists of three main sections:

1. `introspection`
2. `infra`
3. `azure_devops`

#### Environment Variables

To specify private keys or access tokens that should **not be stored in raw
text** in the `spk-config.yaml` file, set the values in environment variables.

For example:

```
account_name: "someHardcodedValue"
table_name: "anotherNonPrivateKey"
key: "${env:ACCESS_KEY}"
partition_key: "canBeStoredInRawTextKey"
```

In this case, the value for `key` is taken from the environment variable
`ACCESS_KEY`.

#### Creating environment variables

There are two options to create environment variables:

1. In a `.env` file
2. In your shell

##### Option 1: .env File

A recommended approach is to have a `.env` file in your folder **(make sure it's
gitignored!)** with all variables and their values.

[Sample `.env`](./.env.example):

```
INTROSPECTION_STORAGE_ACCESS_KEY="access key"
AZURE_TENANT_ID="AAD tenant id"
AZURE_CLIENT_ID="Azure service principal client Id"
AZURE_CLIENT_SECRET="Azure service principal client secret/password"
AZURE_SUBSCRIPTION_ID="Azure subscription id"
```

##### Option 2: shell

To create an environment variable, run the `export` command.

The following example creates the `ACCESS_KEY` environment variable.

```
export ACCESS_KEY="33DKHF933JID"
```

**Note:** Opening a new shell window erases the previously defined environment
variables. Run the `export` command again to create them or use an `.env` file
to define them instead.

## Contributing

[Contributing to spk](./docs/contributing.md).
