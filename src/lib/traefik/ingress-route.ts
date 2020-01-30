type TraefikEntryPoints = Array<"web" | "web-secure">; // web === 80; web-secure === 443;

/**
 * Interface for a Traefik IngressRoute
 *
 * @see https://docs.traefik.io/routing/providers/kubernetes-crd/
 */
interface ITraefikIngressRoute {
  apiVersion: "traefik.containo.us/v1alpha1";
  kind: "IngressRoute";
  metadata: {
    name: string;
    namespace?: string;
  };
  spec: {
    entryPoints?: TraefikEntryPoints; // defaults to allowing all traffic if not defined
    routes: Array<{
      match: string;
      kind: "Rule";
      priority?: number;
      middlewares?: Array<{ name: string }>;
      services: Array<{
        name: string;
        port: number;
        healthCheck?: {
          path: string;
          host: string;
          intervalSeconds: number;
          timeoutSeconds: number;
        };
        weight?: number;
        passHostHeader?: boolean;
        responseForwarding?: {
          flushInterval: string; // eg '100ms'
        };
        strategy?: "RoundRobin";
      }>;
    }>;
  };
}

/**
 * Factory to create a minimal Traefik IngressRoute with route rules
 * corresponding to a PathPrefix matching `/<serviceName>` and a header match
 * rule matching a `Ring` header to `<ringName>`.
 *
 * If `ringName` is an empty string, the header match rule is not included.
 *
 * @param serviceName name of the service to create the IngressRoute for
 * @param ringName name of the ring to which the service belongs
 * @param opts options to specify the manifest namespace, IngressRoute entryPoints, pathPrefix, backend service, and version
 */
export const TraefikIngressRoute = (
  serviceName: string,
  ringName: string,
  servicePort: number,
  opts?: {
    entryPoints?: TraefikEntryPoints;
    k8sBackend?: string;
    middlewares?: string[];
    namespace?: string;
    pathPrefix?: string;
    pathPrefixMajorVersion?: string;
  }
): ITraefikIngressRoute => {
  const {
    entryPoints,
    k8sBackend,
    middlewares = [],
    namespace,
    pathPrefix,
    pathPrefixMajorVersion
  } = opts ?? {};
  const name = !!ringName ? `${serviceName}-${ringName}` : serviceName;

  const versionPath = pathPrefixMajorVersion
    ? `/${pathPrefixMajorVersion}`
    : "";
  const path = pathPrefix ?? serviceName;

  const routeMatchPathPrefix = `PathPrefix(\`${versionPath}/${path}\`)`;
  const routeMatchHeaders = ringName && `Headers(\`Ring\`, \`${ringName}\`)`; // no 'X-' prefix for header: https://tools.ietf.org/html/rfc6648
  const routeMatch = [routeMatchPathPrefix, routeMatchHeaders]
    .filter(matchRule => !!matchRule)
    .join(" && ");

  const backendService = k8sBackend ?? name;

  return {
    apiVersion: "traefik.containo.us/v1alpha1",
    kind: "IngressRoute",
    metadata: {
      name,
      ...(!!namespace ? { namespace } : {})
    },
    spec: {
      ...((entryPoints ?? []).length > 0 ? { entryPoints } : {}),
      routes: [
        {
          kind: "Rule",
          match: routeMatch,
          middlewares: middlewares.map(middlewareName => ({
            name: middlewareName
          })),
          services: [
            {
              name: backendService,
              port: servicePort
            }
          ]
        }
      ]
    }
  };
};
