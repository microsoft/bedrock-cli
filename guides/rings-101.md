# Rings

## What are Deployment Rings?

The concept of _Deployment Rings_ is an encapsulation of a production-first
DevOps strategy to group your users into cohorts based on the features of your
application your wish to expose to them -- think A/B or canary testing but in a
more formalized matter in which you rollout changes from a smaller ring into a
larger encompassing ring.

Rings formalize around a the idea of having a single of production users and
smaller rings targeting cohorts of the larger ring and potentially even smaller
rings targeting cohorts of those cohorts. This enables the ability to measure
the impact or _Blast Radius_ of the deployed version of the application.

## When Should I Use a Ring?

Rings are useful when you want:

- To be able to test in production.
- Have flexibility in the number of environments/rings available to your system
  at any given time.
- Have a standardized means to promote environments/rings to larger cohorts.

## Bedrock -- Applying Rings To Microservices

Generally speaking, rings are more traditionally applied to monolithic
applications -- Delivering specific versions of a single application to specific
cohorts as needed. When in the context of Kubernetes and microservices, this
becomes a much larger problem to tackle as you need to be able to extend the
concept and deployment of rings to not only a single application, but _sets_ of
applications within your cluster.

### Conceptual mapping to Git branches

Bedrock maps rings to branches in your application git repository. As branches
represent a divergence from your main production code (i.e; `master`), they map
to the idea or rings cleanly.

### How its implemented in Bedrock

Due to the limitations of the `Service` type in Kubernetes, Bedrock adopts the
usage of edge routers (Traefik2) with header-based routing capabilities to
identify your Ring via a provided header at ingress time. Instead of only
routing to vanilla Kubernetes `Service`s, for every Bedrock `Ring` and `Service`
defined in your cluster, a Kubernetes `Service` is created to expose it (the
Kubernetes service will be called `<service-name>-<ring-name>`). This _Ringed
Service_ is then exposed via a Traefik2 IngressRoute which routes to it when a
request is made to the router for `/<major-version>/<service-name>/` with a
Header of `Ring: <ring-name>`

To recap, lets imagine you have a Traefik2 ingress service in our cluster with
the name `traefik` and we had an _Ringed Service_ to expose called
`foobar-prod`. Instead of making requests to
`foobar-prod.my-namespace.svc.cluster.local` in your cluster, you would instead
make requests to `traefik.my-namespace.svc.cluster.local/<major-version>/foobar`
with an HTTP header containing `Ring: prod`. The request would be routed via
Traefik2 to the correct _Ringed Service_ based on the service requested and the
`Ring` header -- routing the request to
`foobar-prod.my-namespace.svc.cluster.local` for you.

## Rings & SPK

### Prerequisites

[SPK](https://github.com/microsoft/bedrock-cli) is command line tool meant to
ease the adoption of [Bedrock](https://github.com/microsoft/bedrock/)
methodologies and patterns. With SPK, rings are first class citizens and are
managed/tracked alongside your services, enabling quick scaffolding and
deployment of your services to your rings.

### Creating/Adding a Ring

Creating/adding a Ring is based around a single command:
`spk ring create <ring-name>`.

This command adds a new ring to your spk project and tracks it in projects
`bedrock.yaml` file. Subsequently, the command walks through every service in
your project and updates their build pipeline YAML to monitor the git branch the
ring corresponds to, so that every merge into the ring branch will trigger a new
build/deployment of your ring for the associated service.

Commiting these changes to the `master` branch, or the branch where the
`hld-lifecycle.yaml` pipeline triggers off of, will trigger the project
lifecycle pipeline to add the ring to each service defined in the project
`bedrock.yaml` in the HLD repository.

A sample HLD repository tree for a sample application repository
(`fabrikam-project`) with a service (`fabrikam`) and a newly added ring (`dev`):

![Sample HLD](./images/spk-hld-generated.png)

**Note:** There should only ever be a single lifecycle pipeline associated with
a project. The single branch on which it triggers, points to the "source of
truth" `bedrock.yaml`. This is the branch on which ring creation and deletion
needs to be commited to.

**Note:** Because `spk` will add the branch triggers for each ring added to all
associated service build pipelines within a project, no additional pipelines
should be created when adding a ring.

### Deleting/Removing a Ring

Deleting/removing a ring does the inverse of [creating](#creatingadding-a-ring):
`spk ring delete <ring-name>`.

This command removes the ring from your `bedrock.yaml` file and walks through
all the services in your project and removing the ring branch from the service
pipeline YAML.

**Note:** The "default" ring cannot be deleted. If you wish to remove the ring
defined under `bedrock.yaml` with `isDefault: true`, you must first set another
ring to be the default ring via `spk ring set-default <new-default-ring-name>`.

**Note:** Deleting a `ring` presently does not remove the service and `ring`
from a cluster as the project lifecycle pipeline does not yet remove rings or
services from the HLD repository. The work to support the automated removal of
rings and services is being
[tracked here.](https://github.com/microsoft/bedrock/issues/858) To manually
remove the `ring` from the HLD repository and subsequently, the cluster, follow
the manual steps outlined
[here.](manual-guide-to-rings.md#removing-the-ring-from-the-cluster)

### Setting the Default Ring / Routing

For every bedrock project, there may be a single default ring. By default, this
is the `master` ring, which corresponds to the master branch of the repository.

For a `bedrock.yaml`:

```yaml
rings:
  master:
    isDefault: true
  develop:
    isDefault: false
  qa: {} # isDefault not present is same as isDefault: false
services:
  - path: my-service-foo
    displayName: fancy-service
    helm:
      chart:
        accessTokenVariable: MY_ENV_VAR
        branch: master
        git: "https://dev.azure.com/my-org/my-project/_git/my-repo"
        path: my-service-helm-chart
    k8sBackend: backend-service
    k8sBackendPort: 80
    middlewares: []
    pathPrefix: ""
    pathPrefixMajorVersion: ""
```

the property `isDefault` denotes which `ring` is the default ring.

Being a _default_ ring means an additional set of Traefik2 IngressRoute and
Middleware will be created for its services in the Manifest-Generation pipeline.
These IngressRoute and Middleware will not be _ringed_ (i.e. not require a
header to ping it) but point to the same underlying Kubernetes service as its
ringed counterpart. In the example of above, the Manifest-Generation pipeline
will generate the following ingress routes:

```yaml
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRoute
metadata:
  name: fancy-service-master
spec:
  routes:
    - kind: Rule
      match: "PathPrefix(`/fancy-service`) && Headers(`Ring`, `master`)" # a route still requiring a the Ring header
      middlewares:
        - name: fancy-service-master
      services:
        - name: backend-service-master # the ringed version of the k8s backend service
          port: 80

---
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRoute
metadata:
  name: fancy-service
spec:
  routes:
    - kind: Rule
      match: PathPrefix(`/fancy-service`) # a route freely exposed without a Ring header
      middlewares:
        - name: fancy-service
      services:
        - name: backend-service-master # points to the same backend service as its ringed counterpart
          port: 80
```

In addition this property is used by the `spk service create-revision` command.
Details can be found
[here.](https://microsoft.github.io/bedrock-cli/commands/index.html#service_create-revision)

Note: there can only be 1 (one) ringed marked as `isDefault`.

### What Services Have What Rings?

For each ring defined in your `bedrock.yaml` file, every services
build-update-hld pipeline will be configured to trigger off the said
rings/branches and build a _ringed_ version of it.

Take for example the following `bedrock.yaml`:

```yaml
rings:
  master:
    isDefault: true
  develop:
    isDefault: false
services:
  - path: ./foo
    displayName: ""
    helm:
      chart:
        accessTokenVariable: MY_ENV_VAR
        branch: master
        git: https://dev.azure.com/my-org/my-project/_git/my-repo
        path: foo-helm-chart
    k8sBackend: foo
    k8sBackendPort: 80
    middlewares: []
    pathPrefix: ""
    pathPrefixMajorVersion: ""
  - path: bar
    displayName: ""
    helm:
      chart:
        accessTokenVariable: MY_ENV_VAR
        branch: master
        git: https://dev.azure.com/my-org/my-project/_git/my-repo
        path: bar-helm-chart
    k8sBackend: bar
    k8sBackendPort: 80
    middlewares: []
    pathPrefix: ""
    pathPrefixMajorVersion: ""
variableGroups:
  - core
```

In this example we have defined 2 rings (`master` and `develop`) and 2 services
(`foo` and `bar`) within our `bedrock.yaml`.

The corresponding `build-update-hld.yaml` files for services `foo` and `bar`
will contain:

```yaml
trigger:
  branches:
    include:
      - master
      - develop
```

Making the Azure DevOp pipeline trigger off those corresponding branches/rings.

### Validating the Deployment of My Ringed Service

After your services have been deployed, the next step is to validate that they
are being correctly routed. Remember that route to rings based off a the header
`Ring`.

Imagine our Traefik2 Ingress has been given the IP address `88.88.88.88` we can
ping our services now via a curl command containing the header
`Ring: <target-ring>` where `<target-ring>` corresponds to the ring we wish to
ping:

```sh
curl -H  88.88.88.88/foo/
curl -H  88.88.88.88/bar/
curl -H "Ring: master" 88.88.88.88/foo/
curl -H "Ring: master" 88.88.88.88/bar/
curl -H "Ring: develop" 88.88.88.88/foo/
curl -H "Ring: develop" 88.88.88.88/bar/
```

Note: the curl requests with and without the header `Ring: master` will be point
to the same underlying service Kubernetes service (refer to:
[Setting A Default Ring](#setting-the-default-ring--routing))
