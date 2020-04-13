## Description

This command validates the
[requirements](https://github.com/microsoft/bedrock-cli/blob/master/guides/service-introspection.md#requirements)
and the onboard
[prerequisites](https://github.com/microsoft/bedrock-cli/blob/master/guides/service-introspection.md#prerequisites)

## Note

The purpose of `--self-test` option is to make sure that `spk` is able to write
data to the provided storage account. Once the test ends, it will remove the
test data that was added.
