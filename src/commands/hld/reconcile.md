## Description

The reconcile feature scaffolds a HLD with the services in the `bedrock.yaml`
file at the root level of the application repository. Recall that in a
mono-repo, `spk service create` will add an entry into the `bedrock.yaml`
corresponding to all tracked services. When the service has been merged into
`master` of the application repository, a pipeline (see `hld-lifecycle.yaml`,
created by `spk project init`) runs `spk hld reconcile` to add any _new_
services tracked in `bedrock.yaml` to the HLD.

This command is _intended_ to be run in a pipeline (see the generated
`hld-lifecycle.yaml` created from `spk project init`), but can be run by the
user in a CLI for verification.

For a `bedrock.yaml` file that contained within the
`https://dev.azure.com/foo/bar/_git` repository, that has the following
structure:

```yaml
rings:
  master:
    isDefault: true
services:
  - path: ./services/fabrikam
    displayName: "fabrikam"
    k8sBackendPort: 8001
    k8sBackend: "fabrikam-k8s-svc"
    pathPrefix: "fabrikam-service"
    pathPrefixMajorVersion: "v1"
    helm:
      chart:
        branch: master
        git: "https://dev.azure.com/foo/bar/_git"
        path: stable/fabrikam-application
    middlewares:
      - ""
variableGroups:
  - fabrikam-vg
```

A HLD is produced that resembles the following:

```
├── component.yaml
└── fabrikam
    ├── access.yaml
    ├── component.yaml
    ├── config
    │   └── common.yaml
    └── fabrikam
        ├── component.yaml
        ├── config
        │   └── common.yaml
        └── master
            ├── component.yaml
            ├── config
            │   └── common.yaml
            └── static
                ├── ingress-route.yaml
                └── middlewares.yaml
```

With the `ingress-route.yaml` representing a
[Traefik2 Ingress Route](https://docs.traefik.io/routing/providers/kubernetes-crd/#kind-ingressroute)
backed by a Kubernetes Service, and the `middlewares.yaml` representing a
[Traefik2 Middleware](https://docs.traefik.io/routing/providers/kubernetes-crd/#kind-middleware)
that strips path prefixes.

For the `bedrock.yaml` shown above, the `ingress-route.yaml` produced is:

```yaml
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRoute
metadata:
  name: fabrikam-master
spec:
  routes:
    - kind: Rule
      match: "PathPrefix(`/v1/fabrikam-service`) && Headers(`Ring`, `master`)"
      middlewares:
        - name: fabrikam-master
      services:
        - name: fabrikam-k8s-svc-master
          port: 8001
```

And the `middlewares.yaml` produced is:

```yaml
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: fabrikam-master
spec:
  stripPrefix:
    forceSlash: false
    prefixes:
      - /v1/fabrikam-service
```

Note that there exists a third generated file, `access.yaml`. For the above
`bedrock.yaml`, `access.yaml` contains a single line, which represents a
[Fabrikate access.yaml definition](https://github.com/microsoft/fabrikate/blob/master/docs/auth.md#accessyaml),
allowing Fabrikate to pull Helm Charts that are contained within the same
application repository:

```yaml
"https://dev.azure.com/foo/bar/_git": ACCESS_TOKEN_SECRET
```

When `fabrikate` is invoked in the HLD to Manifest pipeline, it will utilize the
`ACCESS_TOKEN_SECRET` environment variable injected at pipeline run-time as a
Personal Access Token to pull any referenced helm charts from the application
repository.
