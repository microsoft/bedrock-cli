# Private Helm/Git Repositories -- Authorization/PAT For HLD to Materialized Pipeline

An operator may want to store their Helm charts in a different repository than
their application code. In this scenario, the operators Helm chart git
repository will most likely be private; making the ability to clone it in the
HLD-to-Materialized pipeline an issue. To facilitate the ability to clone the
Helm chart repository, we can piggy back off the ability for
[Fabrikate to consume env variables consuming personal access tokens (PATs)](https://github.com/microsoft/fabrikate/blob/master/docs/auth.md).

## Utilizing The Default PAT (ACCESS_TOKEN_SECRET)

By default, all services created via `spk service create` with the
`--helm-config-*` family of options will be setup to consume the environment
variable `ACCESS_TOKEN_SECRET` -- The PAT used to clone the application
repository in the HLD-to-Materialized pipeline. So if the PAT used to setup your
HLD-to-Materialized pipeline has full read access to the Azure DevOps
organizations your Helm git repositories are stored, the pipeline is all set to
clone the Helm charts by default.

## Making The Pipeline Aware of Custom Environment Variables

In order to tell the pipeline that it needs to utilize a PAT stored in a user
defined environment variable in the HLD-to-Materialized pipeline, the
environment variable name -- not the PAT itself -- needs to be tracked in the
`bedrock.yaml`. This environment variable will be used to clone the `https` git
URI for the Helm chart git repository.

Visit https://docs.microsoft.com/en-us/azure/devops/pipelines/process/variables
for more information on how to add a variables to your pipeline.

### Setting Up At Service Create Time

If you already have a environment variable name in mind you want to consume or
already have it available in your pipeline before you create your service, you
can make it aware of it via the `--helm-config-access-token-variable` flag in
the `spk service create` command.

```sh
spk service create my-service ./path/to/service \
  --helm-config-git https://dev.azure.com/my-org/my-project/_git/my-repo \
  --helm-config-branch master \
  --helm-config-path my-service-helm-chart \
  --helm-config-access-token-variable MY_ENV_VAR
```

**Note**: it is important that the git URI you pass is an `https` URI and does
NOT contain a username in it. By default, the clone URIs that the Azure DevOps
creates presents in the UI contain your username in them (e.g.
`https://<my-username>@dev.azure.com/my-org/my-project/_git/my-repo`). Fabrikate
will not inject the PAT if the username is there as the value contained in place
of the username can be a PAT itself.

`MY_ENV_VAR` will be tracked in the service definition in your `bedrock.yaml`:

```yaml
rings:
  master:
    isDefault: true
services:
  - path: ./path/to/service
    displayName: my-service
    helm:
      chart:
        accessTokenVariable: MY_ENV_VAR # Note: this is where the environment variable gets tracked
        branch: master
        git: "https://dev.azure.com/my-org/my-project/_git/my-repo" # Note: it is important that the HTTPS URI does NOT contain your username
        path: my-service-helm-chart
    k8sBackend: ""
    k8sBackendPort: 80
    middlewares: []
    pathPrefix: ""
    pathPrefixMajorVersion: ""
variableGroups:
  - my-var-group
```

### Updating/Changing The Environment Variable

If you want to change the environment variable used after creating your service,
simply change the value of `accessTokenVariable` in your `bedrock.yaml` to the
target environment variable (and ensure that the environment variable exists in
your HLD-to-Materialized pipeline).
