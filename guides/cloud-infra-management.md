# Cloud Infra Management

Manage and update Bedrock infrastructure. For more information on the
`spk infra` design, refer to the infrastructure design docs
[here](./infra/README.md).

Usage:

```
spk infra [command] [options]
```

## Commands

- [scaffold](#https://catalystcode.github.io/spk/commands/index.html#infra_generate)
- [generate](#https://catalystcode.github.io/spk/commands/index.html#infra_scaffold)

## Handling Secrets

`definition.yaml` will handle secrets if specified in the following format:
`variable_name: ${env:secret_name}`. When the yaml file is read,
`spk infra generate` will load any references to environment variables either
from local environment variables in the current shell, or from a .env file.

Example:

```yaml
name: fabrikam
source: "https://github.com/microsoft/bedrock.git"
template: cluster/environments/azure-single-keyvault
version: master
backend:
  storage_account_name: storage-account-name
  access_key: storage-account-access-key
  container_name: storage-account-container
  key: tfstate-key
variables:
  service_principal_id: ${env:ARM_CLIENT_ID}
  service_principal_secret: ${env:ARM_CLIENT_SECRET}
```

## Authentication (Private Repos)

`spk` currently supports the use of Personal Access Tokens to authenticate with
private infrastructure repositories hosted in Azure DevOps. To configure `spk`
to build scaffolded definitions using a private AzDO repo, do one of the
following:

- **Using `.spk-config`** - Pass in your PAT through an .env when you initialize
  spk. Be sure that the `access_token` and `infra_repository` is set and for
  every scaffold, specify your `--version` and `--template`.
- **Using arguments** - Pass in your formatted source url for your private AzDO
  repo with the PAT and arbitrary username specified. Example
  `spk infra scaffold --name fabrikam --source https://spk:{$PAT}@dev.azure.com/microsoft/spk/_git/infra_repo --version master --template cluster/environments/azure-single-keyvault`
