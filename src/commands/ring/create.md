## Description

SPK command to create a ring into an initialized bedrock project.

## Example

For a bedrock.yaml file that looks like this:

```yaml
rings:
  dev:
    isDefault: true
  qa:
  prod:
services:
  - path: ./
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

running `spk ring create stage` will result in a few changes:

1. `stage` will be added into `bedrock.yaml` rings component:
   ```yaml
   rings:
   dev:
     isDefault: true
   qa:
   prod:
   stage:
   services:
     - path: ./
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
2. Each of the referenced services within `bedrock.yaml` will have their
   `build-update-hld.yaml` updated to include the new ring, `stage` in their
   branch triggers:

   ```yaml
    trigger:
    branches:
        include:
        - dev
        - qa
        - prod
        - stage <-- NEW -->
    variables:
    - group: fabrikam-vg
    …
   ```

3. Commiting these changes will trigger the project's lifecycle pipeline, which
   will then scaffold out the newly created ring, along with the appropriate
   IngressRoutes in the linked HLD repository.
