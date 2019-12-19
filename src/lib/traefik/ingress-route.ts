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
 * @param opts options to specify the manifest namespace and IngressRoute entryPoints
 */
export const TraefikIngressRoute = (
  serviceName: string,
  ringName: string,
  servicePort: number,
  opts: {
    middlewares?: string[];
    namespace?: string;
    entryPoints?: TraefikEntryPoints;
  } = {}
): ITraefikIngressRoute => {
  const { entryPoints, middlewares = [], namespace } = opts;
  const name = !!ringName ? `${serviceName}-${ringName}` : serviceName;
  const routeMatchPathPrefix = `PathPrefix(\`/${serviceName}\`)`;
  const routeMatchHeaders = ringName && `Headers(\`Ring\`, \`${ringName}\`)`; // no 'X-' prefix for header: https://tools.ietf.org/html/rfc6648
  const routeMatch = [routeMatchPathPrefix, routeMatchHeaders]
    .filter(matchRule => !!matchRule)
    .join(" && ");

  return {
    apiVersion: "traefik.containo.us/v1alpha1",
    kind: "IngressRoute",
    metadata: {
      name,
      ...(() => (!!namespace ? { namespace } : {}))()
    },
    spec: {
      ...(() =>
        !!entryPoints && entryPoints.length > 0 ? { entryPoints } : {})(),
      routes: [
        {
          kind: "Rule",
          match: routeMatch,
          middlewares: [
            ...middlewares.map(middlewareName => ({ name: middlewareName }))
          ],
          services: [
            {
              name,
              port: servicePort
            }
          ]
        }
      ]
    }
  };
};
