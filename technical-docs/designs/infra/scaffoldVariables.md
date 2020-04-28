# Software Design Document

Reference: Introspection - An option to take variables in Bedrock CLI `scaffold`
command<br> Authors: Andre Briggs, Yvonne Radsmikham, Nathaniel Rose, Dennis
Seah

| Revision | Date         | Author      | Remarks                                                |
| -------: | ------------ | ----------- | ------------------------------------------------------ |
|      0.1 | Mar-07, 2020 | Dennis Seah | Initial Draft                                          |
|      0.2 | Mar-09, 2020 | Dennis Seah | Incorporated comments from Nate, Yvonne and Andre      |
|      1.0 | Mar-11, 2020 | Dennis Seah | Added information on support YAML and JSON file format |

## 1. Overview

`bedrock infra scaffold` command create a `definition.yaml` that enables user to
version, modify and organize terraform deployments. There are many variables in
this file; and it requires use to edit this file in order to complete it.

We want to reduce this two steps process (running `bedrock infra scaffold` and
edit `definition.yaml` file) into a single process by enhancing the existing
`bedrock infra scaffold` command.

## 2. Out of Scope

This design shall only target making user experience better by reducing the
number of steps in scaffolding.

## 3. Design Details

### 3.1 New option --file

In the current release (0.5.6),
[`bedrock infra scaffold`](https://microsoft.github.io/bedrock-cli/commands/index.html#0.5.6@infra_scaffold)
has 4 options (`--name`, `--source`, `--version` and `--template`). We shall
introduce a new option `-f`, `--file` which allows user to specify a file that
contains values for these variables.

The format of the file can be YAML or JSON. The command line tool will detect
the format automatically. Example of YAML file is

```
address_space: 10.10.0.0/16
agent_vm_count: 4
agent_vm_size: Standard_D2s_v3
cluster_name: discovery-service-west
```

And example of JSON file is

```
{
  "address_space": "10.10.0.0/16",
  "agent_vm_count": 4,
  "agent_vm_size": "Standard_D2s_v3",
  "cluster_name": "discovery-service-west"
}
```

leading and trailing spaces should be trimmed. E.g. `address_space=10.10.0.0/16`
is the same as `address_space = 10.10.0.0/16` and `address_space = 10.10.0.0/16`

The command shall not be executed if

1. unknown key(s) are found in the file. E.g. `abc=hello`
2. incorrect type e.g `agent_vm_count=four` where `agent_vm_count` needs a
   integer value.

This means that pre validations are needed before executing the command.

### 3.2 Interactive option

User can runs `bedrock infra scaffold --interactive`. In this mode, user shall
be prompt for

1. Cluster name for scaffolding (value for option `--name`)
2. Source URL for the repository containing the terraform deployment (value for
   option `--source`)
3. Version or tag for the repository so a fixed version is referenced (value for
   option `--version`)
4. Location of the variables.tf for the terraform deployment (value for option
   `--template`)

And a question to each of the variable in `definition.yaml`. User can provide
answers the questions; or hit \<enter> key to skip them. Validation shall be
done on each question.

> Description for each variable can be found in
> [terraform's azure webpage](https://learn.hashicorp.com/terraform/azure/variables_az).
> We just have to create a map of variable names to their descriptions (that's
> not hardcoding description in our code).

Answer to question can be also placeholder like `${SERVICE_PRINCIPAL_PASSWORD}`
when environment parameter value is used for the variable.

## 4. Dependencies

Open source project, [inquirer](https://www.npmjs.com/package/inquirer).

We do not have list and map variable formats now. In future, we may have them
and we need to provide proper interactive interfaces for them.

## 5. Risks & Mitigations

Sensitive information is in the input for `--file` option. User has to take
special case of this file.

## 6. Documentation

Documentation should be done in the
[`md` file](https://github.com/microsoft/bedrock-cli/blob/master/src/commands/infra/scaffold.md)
that are associated with `bedrock infra scaffold` command.

\- end -
