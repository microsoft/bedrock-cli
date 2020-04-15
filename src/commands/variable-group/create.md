## Description

Add a new variable group in Azure DevOps project

## Example

Below is an example of the expected schema in the `--file` argument where
`storage-account-name` is a key name and `fabrikamstorage` is a value. If the
value is a secret then the key/value `isSecret: true` is expected

```yaml
name: "my-variable-group"
description: "My variable group description"
type: "Vsts"
variables:
  storage-account-name:
    value: fabrikamstorage
  storage-account-access-key:
    value: "fabrikamstorage access key"
    isSecret: true
```

If the yaml file above is available at `$PATH_TO_FILE` you would call `spk variable-group create --file $PATH_TO_FILE`
