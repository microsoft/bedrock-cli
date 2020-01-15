/**
 * Interface for a Traefik Middleware
 *
 * @see https://docs.traefik.io/routing/providers/kubernetes-crd/
 */
export interface ITraefikMiddleware {
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

export const TraefikMiddleware = (
  serviceName: string,
  ringName: string,
  prefixes: string[],
  opts: {
    forceSlash?: boolean;
    namespace?: string;
  } = {}
): ITraefikMiddleware => {
  const { forceSlash = false, namespace } = opts;
  const name = !!ringName ? `${serviceName}-${ringName}` : serviceName;

  return {
    apiVersion: "traefik.containo.us/v1alpha1",
    kind: "Middleware",
    metadata: {
      name,
      ...(() => (!!namespace ? { namespace } : {}))()
    },
    spec: {
      stripPrefix: {
        forceSlash,
        prefixes
      }
    }
  };
};
