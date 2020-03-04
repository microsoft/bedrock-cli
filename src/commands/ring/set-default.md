## Description

SPK command to set a ring as the default for an initialized bedrock project.

## Example

For a bedrock.yaml file that looks like this:

```yaml
rings:
  dev:
    isDefault: true
  qa:
  prod:
services:
  ./:
    displayName: "fabrikam"
    helm:
      chart:
        branch: master
        git: "https://dev.azure.com/fabrikam/frontend/_git/charts"
        path: frontend
    k8sBackend: "fabrikam-k8s-svc"
    k8sBackendPort: 80
    middlewares: []
    pathPrefix: "fabrikam-service"
    pathPrefixMajorVersion: "v1"
variableGroups:
  - fabrikam-vg
```

running `spk ring set-default prod` will result in:

1. `prod` will be set as the default in `bedrock.yaml`:

   ```yaml
   rings:
   dev:
   qa:
   prod:
     isDefault: true
   services:
   ./:
     displayName: "fabrikam"
     helm:
     chart:
       branch: master
       git: "https://dev.azure.com/fabrikam/frontend/_git/charts"
       path: frontend
     k8sBackend: "fabrikam-k8s-svc"
     k8sBackendPort: 80
     middlewares: []
     pathPrefix: "fabrikam-service"
     pathPrefixMajorVersion: "v1"
   variableGroups:
     - fabrikam-vg
   ```

2. Commiting these changes will trigger the project's lifecycle pipeline, which
   may update the default "no-ring" IngressRoutes to route to the `prod` service
   in the linked HLD repository,
   [pending the work in this issue](https://github.com/microsoft/bedrock/issues/1084).
