# Command Implementation

## Main Objective

We want to align all command implementation to adhere to a pattern for ease code
review, and maintenance; reduce defects; and generate documentations.

## Structure

All command implementations are under `src/commands` folder. Every command shall
have

1. `.ts` file that implements the command.

   1. has a function, `commandDecorator` which is the entry point to the command
   2. this `commandDecorator` provide an `action` function for the `commander`
      library.
   3. `action` command has to terminate by calling `CommandBuilder.exit`
      function with a `0` or `1` status code for `successeful` or `unsuccessful`
      execution respectively.

2. `.test.ts` file that contains unit test for the command
   1. code coverage shall be above 80%.
3. `.json` file that contains the command declaration
4. `.md` file that contains detailed information about the command.
   1. describe what this command is for (what it does)
   2. information that you think that users should be aware of
   3. sample(s) of the command

## Guidelines

1. Consistent verb and option naming conventions. For example, we standardize on
   `-o, --org-name` where `-o` is the alias and `--org-name` is the full option
   name for organization option. We do not use another aliases other than `-o`
   and other name like `--organization-name`. See
   [Option Name Section](#option-name)
2. Consistent command syntax. We use
   [commander open source library](https://www.npmjs.com/package/commander) to
   enforce this.
3. Common behaviors
   1. Consistent error messages. See [Error Messages Section](#error-messages)
   2. Command terminates with either 0 or 1 status code for successful or failed
      execution respectively.
   3. For interactive mode, we need to support an option to proivde a file that
      contains answers to all questions.
4. All commands have to be well documented in its `.md` file
5. All commands have to be well tested (above 80% code coverage).

## Option Name

We want to have a consistent way for naming option and its alias for better user
experience.

### Choosing an option name.

Use a noun or a well known abbreviation. E.g. do not use `--pr` as an option
name for pull request. Use `--pull-request`. `--pr` can mean many different
things. And it is ok to use `--url` because URL is a well known abbreviation.

Reuse the same option name in existing commands. E.g. use `--org-name` because
it is already used in several commands; and do not create a new one like
`--organization` or `--organization-name`. To see all the existing option names
and aliases, type

```
ts-node tools/locateAliases.ts
```

### Choosing an alias for option name

Reuse the same alias in existing commands. E.g. use `-o` for `--org-name`
because it is already used in several commands. To see all the existing option
names and aliases, type

```
ts-node tools/locateAliases.ts
```

In the event that you need to choose a new alias. Please follow these guidelines

1. Do not use `-V`, `-v` and `-h` because they are reserved
2. Choose the first letter of the option name. For example, option name is
   `--key-value-name`, choose `-k`
3. Choose the upper case of first letter of the option name if the above option
   is not available. For example, option name is `--helm-chart`. We cannot use
   `-h` because it is reserved. We can use `-H`
4. Choose the last letter of the option name if the above option is not
   available. For example, option name is `--helm-chart`. We cannot use `-h`
   because it is reserved and `-H` is already used by an option. we can use `-t`
5. Choose the upper case of last letter of the option name if the above option
   is not available. For example, option name is `--helm-chart`. we can use `-T`
6. Choose the second letter of the option name if the above option is not
   available. For example, option name is `--helm-chart`. we can use `-e`.
7. Repeat the same process of as mentioned above until an alias is available.
   Taking `--helm-chart` as example, the selected aliases are in this order

```
-h, -H, -t, -T, -e, -E, -r, -R, -l, -L, -a, -A, m, -M, -c, -C
```

## Error Messages

1. Every error messages shall have these format

> \<Error message in past tense>. \<How to resolve it in present tense>.

E.g.

> Value for organization name option was missing. Provide value for this option.

2. We do not want pronoun in error messages. E.g.

   > You did not enter value for organization name. Please provide value for it.

3. All error shall be created with the error builder,
   https://github.com/microsoft/bedrock-cli/blob/master/src/lib/errorBuilder.ts so
   that we can generate the exception chain. In this manner, we can precisely
   know the root cause of the problem. For more information, refer to
   [error handling](./error-handling.md).
