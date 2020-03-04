# A Manual Guide to Managing Rings

## Introduction

This guide presumes that you have set up your `spk` project, and installed all
necessary pipelines created via `spk project init` (the lifecycle pipeline),
`spk service create` (build update hld pipeline), and `spk hld init` (manifest
generation pipeline), and followed the
[guidelines for creating helm charts](./building-helm-charts-for-spk).

In `spk`, we offer the concept of a `ring` - a way to route inbound traffic to
_revisions_ of a service on a Kubernetes cluster via request headers. For
example, if an inbound request is decorated with the `Ring: dev` header, the
request is routed to the `dev` revision of a service. Similarly, if a request is
decorated with the `Ring: prod` header, the request is routed to the `prod`
revision of a service.

## Service Revisions and Git

Service revisions are built and deployed by committing to bedrock.yaml tracked
git branches in the form of a `ring`. A `ring` maps one to one with a service
revision, which maps directly onto a git branch.

Let's think about a git repository containing three branches, `dev`, `qa`, and
`prod`. Each of these branches contain variations of an application's source
code. `dev` containing the in-progress feature work, `qa` containing stable, but
under-test feature work, and `prod`, containing live/production ready features.

A `bedrock.yaml` for this service might look like:

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

Each of the three entries under the `rings` object map one to one with a git
branch in the application source repository. When this `bedrock.yaml` is
deployed, and the container images for each of the `rings` are built and pushed
for the `fabrikam` service, your cluster will have three running revisions of
the `fabrikam` application - one each for `dev`, `qa`, and `prod`. A user is
then able to invoke each revision by making HTTP requests to a single endpoint,
decorated with the proper header for each Ring.

## How deploying service revisions with rings will work

Refer to the `bedrock.yaml` above, with the following rings, and thus git
branches:

```
- dev
- prod
- qa
```

A user wants to add a ring `test-new-homepage`, they first create the `ring`, by
invoking the relevant `spk` command:

- `spk ring create test-new-homepage`

This command will add an entry to our `rings` dictionary in `bedrock.yaml`, and
modify all `build-update-hld` pipelines for services tracked in bedrock.yaml.
Our revised `bedrock.yaml` will now look like:

```yaml
rings:
  dev:
    isDefault: true
  qa:
  prod:
  test-new-homepage: <-- NEW -->
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

And the revised `build-update-hld` pipeline for the `fabrikam` service will now
look like:

```yaml
trigger:
  branches:
    include:
      - dev
      - qa
      - prod
      - test-new-homepage <-- NEW -->
variables:
  - group: fabrikam-vg
…
```

_Note that the `test-new-homepage` branch name has been added to the branch
include trigger_

A user is then expected to commit and push the `bedrock.yaml`, and the updated
pipelines yaml files.

The user can then create the `test-new-homepage` branch, and check it out:

- `git checkout dev -b test-new-homepage`

When a user commits to the `test-new-homepage` branch in the application
repository, the `build-update-hld` pipeline will be able to build the container
image with the changes to the source code from the `test-new-homepage` branch.
It will continue to push the image to Azure Container Registry, and make a pull
request against the High Level Definition repository with the newly built
container image tag.

## Status Quo and current work

At present, `spk` is at version `0.5.4`, which _does_ not implement `ring`
management commands - ie adding or removing a `ring` using a _more_ user
friendly cli, however this work is being tracked in the following github issues:

- [Ring Management Docs and Implementation Epic](https://github.com/microsoft/bedrock/issues/955)
- [Adding a Ring in SPK](https://github.com/microsoft/bedrock/issues/969)
- [Deleting a Ring in SPK](https://github.com/microsoft/bedrock/issues/971)
- [Setting a default Ring in SPK](https://github.com/microsoft/bedrock/issues/972)
- [Removing a service and a ring from a Cluster](https://github.com/microsoft/bedrock/issues/858)

## Bridging the gap

While `ring` management features are not yet available in `spk`, we can bridge
the gap to using `rings` with a few manual steps for configuration

### Adding a Ring

See [this issue](https://github.com/microsoft/bedrock/issues/969) for details on
how this feature will be implemented in `spk`.

To add a ring manually, an `spk` user can take the following steps:

1. Ensure a git branch exists with the same name of the `ring` to be added (eg:
   a `ring` named `test-new-feature` relies on a git branch with the same name,
   `test-new-feature`)
2. In an application repository's `bedrock.yaml`, add the name of the `ring` to
   the top level `rings` object ie:

```yaml
rings:
  dev:
    isDefault: true
  qa:
  prod:
  test-new-feature: <-- NEW -->
…
```

3. For _every_ service tracked in bedrock.yaml, ensure that service's
   `build-update-hld` pipeline is configured to trigger off of the `ring` branch
   ie:

```yaml
trigger:
  branches:
    include:
      - dev
      - qa
      - prod
      - test-new-feature <-- NEW -->
variables:
  - group: fabrikam-vg
…
```

4. Commit the changes to the `bedrock.yaml`, and all updated `build-update-hld`
   pipelines.
5. Approve the generated Pull Request from the `hld-lifecycle` pipeline against
   the HLD repository. This Pull Request will add a new `ring` component for
   each service tracked in bedrock.yaml. The `ring` component is identified in
   the below diagram as `[Ring Component]`

![Sample HLD](./images/spk-hld-generated.png)

6. Change to the new `ring` branch: `test-new-feature`, and begin to commit, and
   push code as you normally would.

### Deleting a Ring

See: [this issue](https://github.com/microsoft/bedrock/issues/971) for details
on how this feature will be implemented in `spk`.

To delete a `ring` manually, an `spk` user can take the following steps:

1. In an application repository's `bedrock.yaml`, remove the name of the `ring`
   from the top level `rings` object ie:

Before:

```yaml
rings:
  dev:
    isDefault: true
  qa:
  prod:
  test-new-feature: <-- DELETE -->
…
```

After:

```yaml
rings:
  dev:
    isDefault: true
  qa:
  prod:
…
```

2. For _every_ service tracked in bedrock.yaml, ensure that service's
   `build-update-hld` pipeline is no longer configured to trigger off the `ring`
   branch ie:

Before:

```yaml
trigger:
  branches:
    include:
      - dev
      - qa
      - prod
      - test-new-feature <-- DELETE -->
variables:
  - group: fabrikam-vg
…
```

After:

```yaml
trigger:
  branches:
    include:
      - dev
      - qa
      - prod
variables:
  - group: fabrikam-vg
…
```

3. Commit the changes to the `bedrock.yaml`, and all updated `build-update-hld`
   pipelines.
4. Observe that committing to the `test-new-feature` should no longer trigger
   builds.

_Do note that deleting a `ring` presently does not remove the service and `ring`
from a cluster. This work is being
[tracked here](https://github.com/microsoft/bedrock/issues/858) but the
following instructions will detail how this can be done manually_

5. To remove a `ring` from a cluster, you must remove the `ring` component from
   the HLD. Recall the Pull Request generated by the `hld-lifecycle` pipeline
   when adding a `ring` to the `bedrock.yaml` file. The `ring` component is
   identified in the below diagram as `[Ring Component]`. In a clone of the HLD
   repository, one can delete the directory identified by `[Ring Component]`:

![Sample HLD](./images/spk-hld-generated.png)

6. Finally, a user must modify the `component.yaml` within the directory
   identified by `[Service Component]` in the above diagram to no longer point
   to the directory that was deleted. For our sample service, `fabrikam`, with a
   ring to be removed, `test-new-feature`, the Service Component
   `component.yaml` resembles this structure. A user can simply remove the
   `test-new-feature` entry in the subcomponents array:

```yaml
name: fabrikam
subcomponents:
  - name: dev
    type: component
    method: local
    path: ./dev
  - name: qa
    type: component
    method: local
    path: ./qa
  - name: prod
    type: component
    method: local
    path: ./prod
  - name: test-new-feature   <-- DELETE -->
    type: component          <-- DELETE -->
    method: local            <-- DELETE -->
    path: ./test-new-feature <-- DELETE -->
```

7. Finally, after ensuring the `component.yaml` has been updated, and the `ring`
   component directory in the HLD has been removed for the service, a user can
   commit and push the changes to a branch, merging it into the master branch of
   their HLD, and triggering a rebuild of manifests deployed to the cluster.
