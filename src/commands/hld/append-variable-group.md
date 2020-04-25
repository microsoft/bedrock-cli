## Description

Append a variable group name to the current `manifest-generation.yaml` of an
initialized hld repository.

## Example

When an HLD repository is first initialized with `bedrock hld init`, the top
portion of the `manifest-generation.yaml` looks like this:

```yaml
trigger:
  branches:
    include:
      - master
variables: []
pool:
  vmImage: ubuntu-latest
steps:
.
.
.
```

running `bedrock hld append-variable-group my-vg` with a variable group name, in
this case `my-vg`, will add it under the `variables` section if it does not
already exist:

```yaml
trigger:
  branches:
    include:
      - master
variables:
  - group: my-variable-group
pool:
  vmImage: ubuntu-latest
steps:
.
.
.
```
