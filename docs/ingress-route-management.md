# Ingress Route Management

Manage your Traefik `IngressRoute`s

## Commands

### create

A command to create Kubernetes Traefik `IngressRoute`s.

The primary usage of this command is to be used via pipelines to modifying your
HLD with the appropriate manifests for ring based routing.

```sh
Usage: ingress-route create|c [options] <service> <port>

Create a Traefik IngressRoute for a target <service>:<port>

Options:
  -r, --ring <ring>             the ring to deploy this service to, if provided the generated IngressRoute will target service `<service>-<ring>` (default: "")
  --entry-point <entry-point>   the Traefik IngressRoute entryPoint; can be either 'web' or 'web-secure'; defaults to allowing all traffic if left blank (default: "")
  --namespace <namespace>       a namespace to inject into the outputted Kubernetes manifest (default: "")
  -o, --output-file <filepath>  filepath to output the IngressRoute YAML to; defaults to outputting to stdout (default: "")
  -h, --help                    output usage information
```

#### Examples:

**Outputting to stdout (useful if you need to pipe the output):**

```sh
$ spk ingress-route create my-service 80 --ring production --entry-point web --namespace my-fancy-ns
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRoute
metadata:
  name: my-service-production
  namespace: my-fancy-ns
spec:
  entryPoints:
    - web
  routes:
    - kind: Rule
      match: 'PathPrefix(`/my-service`) && Headers(`Ring`, `production`)'
      services:
        - name: my-service-production
          port: 80
```

**Outputting to to a file:**

Note: the directory specified via `--output-file` will be automatically created
if it does not exist.

```sh
$ spk ingress-route create my-service 80 --ring production --entry-point web --namespace my-fancy-ns --output-file ~/my/k8s/manifests/ingress.yaml
info:    Writing IngressRule YAML to /Users/User/my/k8s/manifests/ingress.yaml
info:    Successfully wrote IngressRule YAML to /Users/User/my/k8s/manifests/ingress.yaml
$ cat ~/my/k8s/manifests/ingress.yaml
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRoute
metadata:
  name: my-service-production
  namespace: my-fancy-ns
spec:
  entryPoints:
    - web
  routes:
    - kind: Rule
      match: 'PathPrefix(`/my-service`) && Headers(`Ring`, `production`)'
      services:
        - name: my-service-production
          port: 80
```
