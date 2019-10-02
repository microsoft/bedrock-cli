## `spk infra`

Command used to generate, deploy, and update Bedrock infrastructure.

#### `spk infra init`

Initializes the environment to deploy Bedrock infrastructure. The
`spk infra init` will do the following:

- Install prerequisites (e.g. terraform, git, helm, az cli) if not already
  installed.
- Verifies that user is logged into Azure via CLI
- Check for environment variables (e.g. ARM_SUBSCRIPTION_ID, ARM_CLIENT_ID,
  ARM_CLIENT_SECRET, ARM_TENANT_ID)

#### `spk infra create <environment>`

Validates that a working bedrock source is available. The `spk infra create`
will do the following:

- Check if a working Bedrock source for infrastructure deployment is available
- Checks if `spk infra init` has been run (Work in Progress)
- Runs a `terraform init` on a Bedrock environment template (Defaults to Azure
  Simple)
