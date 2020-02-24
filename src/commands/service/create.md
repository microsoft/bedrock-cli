## Descripton

Add a new service into this initialized spk project repository.

## Note

- `--helm-chart-*` and `--helm-config-*` settings are exclusive. **You may only
  use one.**
- `--middlewares`, `--k8s-backend-port`, `--path-prefix`,
  `--path-prefix-major-version`, and `--k8s-backend` are all used to configure
  the generated Traefik2 IngressRoutes. ie.
  `spk service create my-example-documents-service --middlewares middlewareA --k8s-backend-port 3001 --k8s-backend docs-service --path-prefix documents --path-prefix-major-version v2`
  will result in an IngressRoute that looks like:
  ```
  apiVersion: traefik.containo.us/v1alpha1
  kind: IngressRoute
  metadata:
    name: my-example-documents-service-master
  spec:
    routes:
      - kind: Rule
        match: 'PathPrefix(`/v2/documents`) && Headers(`Ring`, `master`)'
        middlewares:
          - name: my-example-documents-service-master
          - name: middlewareA
        services:
          - name: docs-service
            port: 3001
  ```
