# Integration Testing SPK

This directory contains shell scripts that execute on a build agent and run
`spk` commands. An [Azure DevOps pipeline yaml](../smoke-test-pipeline.yml) file
scheduled the run of these tests. The yaml file orchestrates the download the
lastest master branch build artifact of `spk` on a daily basis and running smoke
tests.

`validations.sh`

- This file orchestrates the scenarios and is designed to fail on first error.

`functions.sh`

- This file has simple functions that are reused by `validations.sh`.

# Scenarios Exercised So Far

- As a developer create a mono-repo and add services
- As a developer create a pipeline from an existing service
- As a devleper create a service revision from an existing service

# Operational Coverage

## Initialization

| Command  | Coverage |
| -------- | -------- |
| spk init | 🚫       |

## Project Creation

| Command          | Coverage |
| ---------------- | -------- |
| spk project init | ✅       |

## Service Management

| Command                            | Coverage |
| ---------------------------------- | -------- |
| spk service create                 | ✅       |
| spk service install-build-pipeline | ✅       |
| spk service create-revision        | ✅       |

## HLD Management

| Command                           | Coverage |
| --------------------------------- | -------- |
| spk hld init                      | 🚫       |
| spk hld install-manifest-pipeline | 🚫       |

## Ingress Route Management

| Command                  | Coverage |
| ------------------------ | -------- |
| spk ingress-route create | 🚫       |

## Variable Group Management

| Command                   | Coverage |
| ------------------------- | -------- |
| spk variable-group create | 🚫       |

## Service Introspection

| Command                  | Coverage |
| ------------------------ | -------- |
| spk deployment get       | 🚫       |
| spk deployment onboard   | 🚫       |
| spk deployment validate  | 🚫       |
| spk deployment dashboard | 🚫       |
| spk deployment create    | 🚫       |

## Infrastructure Management

| Command                    | Coverage |
| -------------------------- | -------- |
| spk infra scaffold         | 🚫       |
| spk infra validate onboard | 🚫       |
| spk infra generate         | 🚫       |

# Setup Instructions

## Requirements
1. Azure DevOps Organization and Project
2. Create variable group named `spk-vg`. Inside the variable group have the following key/values:
    - AZDO_PROJECT (e.g. `bedrock`)
    - AZDO_ORG (e.g. `epicstuff`)
    - AZDO_PAT (e.g. Personal Access Token with access to AZDO_PROJECT) <-- 🔒
    - SP_APP_ID (e.g Service Principal App Id)
    - SP_PASS (e.g Service Principal Password) <-- 🔒
    - SP_TENANT (e.g Service Principal Tenant Id)
    - FUNC_SCRIPT (e.g. https://raw.githubusercontent.com/MY_ORG/spk/master/tests/functions.sh)
    - TEST_SCRIPT (e.g. https://raw.githubusercontent.com/MY_ORG/spk/master/tests/validations.sh)
3. Azure CLI with Azure DevOps Extension
    - Provided in pipeline yaml
4. SPK Binary
    - Provided in pipeline yaml

## Testing locally
1. Login into AZ CLI
2. Install Azure DevOps Extension
3. Set the following environment variables
    <pre>
    export SPK_LOCATION=<b>REPLACE_ME</b>
    export AZDO_PROJECT=<b>REPLACE_ME</b>
    export AZDO_ORG=<b>REPLACE_ME</b>
    export ACCESS_TOKEN_SECRET=<b>REPLACE_ME</b>
    </pre>
4. Navigate to this directory in shell
5. RUN --> `$ . functions.sh`
6. RUN --> `$ sh validations.sh`


