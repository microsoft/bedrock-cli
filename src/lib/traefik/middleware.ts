/**
 * Interface for a Traefik Middleware
 *
 * @see https://docs.traefik.io/routing/providers/kubernetes-crd/
 */
export interface TraefikMiddleware {
  apiVersion: "traefik.containo.us/v1alpha1";
  kind: "Middleware";
  metadata: {
    name: string;
    namespace?: string;
  };
  spec: {
    stripPrefix: {
      forceSlash: boolean;
      prefixes: string[];
    };
  };
}

export const create = (
  serviceName: string,
  ringName: string,
  prefixes: string[],
  opts: {
    forceSlash?: boolean;
    namespace?: string;
  } = {}
): TraefikMiddleware => {
  const { forceSlash = false, namespace } = opts;
  const name = ringName ? `${serviceName}-${ringName}` : serviceName;

  return {
    apiVersion: "traefik.containo.us/v1alpha1",
    kind: "Middleware",
    metadata: {
      name,
      ...(namespace ? { namespace } : {}),
    },
    spec: {
      stripPrefix: {
        forceSlash,
        prefixes,
      },
    },
  };
};
