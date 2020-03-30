## Description

SPK command to remove a ring from an initialized bedrock project.

_Note:_ A default ring cannot be removed. First set another ring as the default
via `spk ring set-default` before deleting.

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

running `spk ring delete prod` will result in a few changes:

1. `prod` will be removed from `bedrock.yaml`:
   ```yaml
   rings:
   dev:
     isDefault: true
   qa:
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
   `build-update-hld.yaml` updated to remove the ring, `prod` in their branch
   triggers:

   ```yaml
    trigger:
    branches:
        include:
        - dev
        - qa
        # - prod <-- THIS WILL BE DELETED! -->
    variables:
    - group: fabrikam-vg
    …
   ```

3. Commiting these changes will trigger the project's lifecycle pipeline, which
   will then remove the ring from linked services in this project,
   [pending this epic](https://github.com/microsoft/bedrock/issues/858).
