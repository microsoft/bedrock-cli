# Integration Testing SPK
 
This directory contains shell scripts that execute on a build agent and run `spk` commands. An [Azure DevOps pipeline yaml](../smoke-test-pipeline.yml) file scheduled the run of these tests. The yaml file orchestrates the download the lastest master branch build artifact of `spk` on a daily basis and running smoke tests.  

`validations.sh`
- This file orchestrates the scenarios and is designed to fail on first error.

`functions.sh`
- This file is has simple functions that are reused by `validations.sh`.


# Scenarios Exercised So Far
- As a developer create a mono-repo and add services
- As a developer create a pipeline from an existing service
- As a devleper create a service revision from an existing service

# Operational Coverage

## Initialization 
| Command | Coverage |
| --- | --- |
| spk init |  🚫 |

## Project Creation 
| Command | Coverage |
| --- | --- |
| spk project init | ✅ |

## Service Management 
| Command | Coverage |
| --- | --- |
| spk service create | ✅ |
| spk service create-pipeline | ✅ |
| spk service create-revision | ✅ |

## HLD Management 
| Command | Coverage |
| --- | --- |
| spk hld init | 🚫 |
| spk hld install-manifest-pipeline | 🚫 |

## Ingress Route Management 
| Command | Coverage |
| --- | --- |
| spk ingress-route create | 🚫 |

## Variable Group Management 
| Command | Coverage |
| --- | --- |
| spk variable-group create | 🚫 |

## Service Introspection 
| Command | Coverage |
| --- | --- |
| spk deployment get | 🚫 |
| spk deployment onboard | 🚫 |
| spk deployment validate | 🚫 |
| spk deployment dashboard | 🚫 |
| spk deployment create | 🚫 |

## Infrastructure Management 
| Command | Coverage |
| --- | --- |
| spk infra scaffold | 🚫 |
| spk infra validate onboard | 🚫 |
| spk infra generate | 🚫 |


# Setup Instructions

## Requirements
- SPK Binary
- Azure DevOps Organization and Project
- Azure CLI with Azure DevOps Extension
- A variable group named `spk-vg`
