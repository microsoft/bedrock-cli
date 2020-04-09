## Description

Gets display name of a service based on the provided path by extracting this
information from bedrock.yaml. This command tries to locate bedrock.yaml in the
current directory.

If bedrock.yaml is not found in current directory, the command will fail to
extract display name.

If the specified path is not found in any services listed in bedrock.yaml, the
display name will not be extracted. Make sure that specified path matches the
path in bedrock.yaml exactly.
