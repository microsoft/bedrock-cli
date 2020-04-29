## Description

Append an existing variable group in Azure DevOps project and its services.

## Command Prerequisites

This command requires to have an existing bedrock project that was initialized
with `bedrock project init`. It also requires that the variable group to be
added exists in the Azure DevOps project.

## Example

When an bedrock project repository is first initialized with
`bedrock project init`, it will create a `bedrock.yaml` file that looks similar
to this:

```yaml
rings:
  master:
    isDefault: true
variableGroups: []
services: []
.
.
.
```

running `bedrock project append-variable-group my-vg` with a variable group
name, in this case `my-vg`, will add it under the `variables` section if it does
not already exist:

```yaml
rings:
  master:
    isDefault: true
variableGroups:
    - my-vg
services: []
.
.
.
```

If there are any `services` specified, it will add the variable group to its
corresponding `build-update-hld.yaml` file under the `variables` section:

```yaml
variables:
  - group: my-vg
```
