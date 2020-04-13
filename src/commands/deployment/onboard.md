## Description

Prepare storage for the service introspection tool. This will create a storage
account if it does not already exist in your subscription in the given
`resource-group`. The storage table will also be created in a newly created or
in an existing storage account if it does not exist already. When the Azure Key
Vault argument is specified, a secret with Azure storage access key will be
created. Otherwise, the storage access key will need to be specified in
environment variables manually.

See
[Prerequisites](https://github.com/microsoft/bedrock-cli/blob/master/guides/service-introspection.md#prerequisites)
