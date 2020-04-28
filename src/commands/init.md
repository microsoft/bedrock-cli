This command creates a configuration file, `config.yaml` in a folder `.bedrock`
under your home directory. There are two options for creating this file

1. an interactive mode where you have to answer a few questions; and
2. you provide a `yaml` file and this `yaml` will be copied to the target
   location.

## Interactive mode

The command line tool attempts to read `config.yaml` in a folder `.bedrock`
under your home directory. Configuration values shall be read from it if it
exists. And these values shall be default values for the questions. Otherwise,
there shall be no default values. These are the questions

1. Organization Name of Azure dev-op account
2. Project Name of Azure dev-op account
3. Personal Access Token (guides)
4. Would like to have introspection configuration setup? If yes
   1. Storage Account Name
   1. Storage Table Name
   1. Storage Partition Key
   1. Storage Access Key

This tool shall verify these values by making an API call to Azure dev-op. They
shall be written to `config.yaml` regardless the verification is successful or
not.

> Note: In the event that you do not have internet connection, this verification
> shall not be possible

## Example

```
bedrock init --interactive
```

or

```
bedrock init --file myConfig.yaml
```
