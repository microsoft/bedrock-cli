# spk-config.yaml

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
