## Description

Creates a "generated" deployment folder with the completed Terraform files based
on definitions provided from a scaffolded project.

It will do the following:

- Check if a provided project folder contains a `definition.yaml`
- Verify the configuration of parent and leaf definitions.
- Check if the terraform template `source` provided has a valid remote
  repository.
- Clone and cache the master version of the provided `source` repository locally
  in `~/.bedrock/templates`
  > Cached repositories will be converted through regex for bedrock to hash.
  > (i.e. a `source` template of `https://github.com/microsoft/bedrock` will be
  > cached into a folder called `_microsoft_bedrock_git`)
- Create a "generated" directory for Terrform deployments (alongside the
  scaffolded project directory)
- Copy the appropriate Terraform templates to the "generated" directory
- Check the Terraform module source values and convert them into a generic git
  url based on the `definition.yaml`'s `source`, `version` and `template` path.
- Create a `bedrock.tfvars` in the generated directory based on the variables
  provided in `definition.yaml` files of the parent and leaf directories.

## Example

Assuming you have the following setup:

```
fabrikam
    |- definition.yaml
    |- east/
        |- definition.yaml
    |- central/
        |- definition.yaml
```

When executing the following command **in the `fabrikam` directory**:

```
bedrock infra generate --project east
```

The following hiearchy of directories will be generated _alongside_ the targeted
directory. In addition, the appropriate versioned Terraform templates will be
copied over to the leaf directory with a `bedrock.tfvars`, which contains the
variables accumulated from parent **and** leaf definition.yaml files, where if a
variable exists in both parent and leaf definition, the **leaf definitions will
take precedence**.

```
fabrikam
    |- definition.yaml
    |- east/
        |- definition.yaml
    |- central/
        |- definition.yaml
fabrikam-generated
    |- east
        |- main.tf
        |- variables.tf
        |- bedrock.tfvars (concatenation of variables from fabrikam/definition.yaml (parent) and fabrikam/east/definition.yaml (leaf))
```

You can also have a "single-tree" generation by executing
`bedrock infra generate` inside a directory without specifying a project folder.
For example, if you had the following tree structure:

```
fabrikam
    |- definition.yaml
```

and executed `bedrock infra generate` inside the `fabrikam` directory, this will
generate the following:

```
fabrikam-generated
    |- main.tf
    |- variables.tf
    |- bedrock.tfvars
```
