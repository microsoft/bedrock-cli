## Description

Add a new service into this initialized spk project repository.

## Note

- `--helm-chart-*` and `--helm-config-*` settings are exclusive. **You may only
  use one.**
  - If the git repository referenced in `--helm-config-git` is a private
    repository, you can specify an environment variable in your
    HLD-to-Materialized pipeline containing your a PAT to authenticate with via
    the `--helm-chart-access-token-variable` option.
    - For more information, checkout the
      [git authentication guide](../../../guides/auth-private-helm-repos.md)
- `--middlewares`, `--k8s-backend-port`, `--path-prefix`,
  `--path-prefix-major-version`, and `--k8s-backend` are all used to configure
  the generated Traefik2 IngressRoutes. ie.
  ```sh
  spk service create my-example-documents-service
    --middlewares middleware \
    --k8s-backend-port 3001 \
    --k8s-backend docs-service \
    --path-prefix documents \
    --path-prefix-major-version v2
  ```
  will result in an IngressRoute that looks like:
  ```yaml
  apiVersion: traefik.containo.us/v1alpha1
  kind: IngressRoute
  metadata:
    name: my-example-documents-service-master
  spec:
    routes:
      - kind: Rule
        match: "PathPrefix(`/v2/documents`) && Headers(`Ring`, `master`)"
        middlewares:
          - name: my-example-documents-service-master
          - name: middlewareA
        services:
          - name: docs-service
            port: 3001
  ```
