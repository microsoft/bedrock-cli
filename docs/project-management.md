# Project Management

Create and manage components for a Bedrock project.

Usage:

```
spk project [command] [options]
```

Commands:

- [Project Management](#project-management)
  - [Prerequisites](#prerequisites)
  - [Commands](#commands)
    - [init](#init)

Global options:

```
  -v, --verbose        Enable verbose logging
  -h, --help           Usage information
```

## Prerequisites

An Azure DevOps git repository.

## Commands

### init

Initialize the current working directory as a Bedrock project repository. This
command supports importing a mono-repository with services organized under a
single 'packages' directory.

```
Usage: project init|i [options]

Initialize your spk repository. Will add starter bedrock, maintainers, and azure-pipelines YAML files to your project.

Options:
  -m, --mono-repo                   Initialize this repository as a mono-repo. All directories under `packages` (modifiable with `-d` flag) will be initialized as packages. (default: false)
  -d, --packages-dir <dir>          The directory containing the mono-repo packages. This is a noop if `-m` not set. (default: "packages")
  -r, --default-ring <branch-name>  Specify a default ring; this corresponds to a default branch which you wish to push initial revisions to
  -h, --help                        output usage information
```

**NOTE:**

`-d,--packages-dir` will be ignored if the `-m,--mono-repo` flag is not set. If
there is not a singular package directory, then services can be individually
added with the [`spk service` command](./service-management.md).
