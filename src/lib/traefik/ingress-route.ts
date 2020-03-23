import * as dns from "../net/dns";

type TraefikEntryPoints = Array<"web" | "web-secure">; // web === 80; web-secure === 443;

/**
 * Interface for a Traefik IngressRoute
 *
 * @see https://docs.traefik.io/routing/providers/kubernetes-crd/
 */
interface TraefikIngressRoute {
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
 * @throws {Error} when meta.name or any spec.routes[].service[].name are not
 *                 RFC1123 compliant
 *
 * @param serviceName name of the service to create the IngressRoute for
 * @param ringName name of the ring to which the service belongs
 * @param opts options to specify the manifest namespace, IngressRoute
 *             entryPoints, pathPrefix, backend service, and version
 */
export const create = (
  serviceName: string,
  ringName: string,
  servicePort: number,
  versionAndPath: string,
  opts?: {
    entryPoints?: TraefikEntryPoints;
    k8sBackend?: string;
    middlewares?: string[];
    namespace?: string;
    isDefault?: boolean;
  }
): TraefikIngressRoute => {
  const { entryPoints, k8sBackend, middlewares = [], namespace, isDefault } =
    opts ?? {};
  const name =
    ringName && !isDefault ? `${serviceName}-${ringName}` : serviceName;

  const routeMatchPathPrefix = `PathPrefix(\`${versionAndPath}\`)`;
  const routeMatchHeaders = isDefault
    ? undefined
    : ringName && `Headers(\`Ring\`, \`${ringName}\`)`; // no 'X-' prefix for header: https://tools.ietf.org/html/rfc6648
  const routeMatch = [routeMatchPathPrefix, routeMatchHeaders]
    .filter((rule): rule is NonNullable<typeof rule> => !!rule)
    .join(" && ");

  const backendService =
    k8sBackend && ringName ? `${k8sBackend}-${ringName}` : name;

  // validate fields
  dns.assertIsValid("metadata.name", name);
  dns.assertIsValid("spec.routes[].services[].name", backendService);

  return {
    apiVersion: "traefik.containo.us/v1alpha1",
    kind: "IngressRoute",
    metadata: {
      name,
      ...(namespace ? { namespace } : {}),
    },
    spec: {
      ...((entryPoints ?? []).length > 0 ? { entryPoints } : {}),
      routes: [
        {
          kind: "Rule",
          match: routeMatch,
          middlewares: middlewares.map((middlewareName) => ({
            name: middlewareName,
          })),
          services: [
            {
              name: backendService,
              port: servicePort,
            },
          ],
        },
      ],
    },
  };
};
