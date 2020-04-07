## Description

Append a variable group name to the current `manifest-generation.yaml` of an
initialized hld repository.

## Example

When an HLD repository is first initialized with `spk hld init`, the top portion
of the `manifest-generation.yaml` looks like this:

```yaml
# GENERATED WITH SPK VERSION 0.5.8
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

running `spk hld append-variable-group my-vg` with a variable group name, in
this case `my-vg`, will add it under the `variables` section if it does not
already exist:

```yaml
# GENERATED WITH SPK VERSION 0.5.8
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
