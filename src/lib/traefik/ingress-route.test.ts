import uuid from "uuid/v4";
import { logger } from "../../logger";
import { TraefikIngressRoute } from "./ingress-route";

describe("TraefikIngressRoute", () => {
  test("the right object name and service name is created", () => {
    const routeWithoutRing = TraefikIngressRoute("my-service", "", 80);
    expect(routeWithoutRing.metadata.name).toBe("my-service");
    expect(routeWithoutRing.spec.routes[0].services[0].name).toBe("my-service");
    const routeWithRing = TraefikIngressRoute("my-service", "prod", 80);
    expect(routeWithRing.metadata.name).toBe("my-service-prod");
    expect(routeWithRing.spec.routes[0].services[0].name).toBe(
      "my-service-prod"
    );
  });

  test("manifest namespace gets injected properly", () => {
    const randomNamespaces = Array.from({ length: 10 }, () => uuid());
    for (const namespace of randomNamespaces) {
      const withoutNamespace = TraefikIngressRoute("foo", "bar", 80, {
        namespace
      });
      expect(withoutNamespace.metadata.namespace).toBe(namespace);
    }
  });

  test("the service port gets properly injected", () => {
    const randomPorts = Array.from({ length: 10 }, () =>
      Math.floor(Math.random() * 1000)
    );
    for (const servicePort of randomPorts) {
      const route = TraefikIngressRoute("foo", "", servicePort);
      expect(route.spec.routes[0].services[0].port).toBe(servicePort);
    }
  });

  test("entryPoints gets injected properly", () => {
    const withoutEntryPoints = TraefikIngressRoute("foo", "bar", 80);
    expect(typeof withoutEntryPoints.spec.entryPoints).toBe("undefined");
    const withJustWeb = TraefikIngressRoute("foo", "bar", 80, {
      entryPoints: ["web"]
    });
    expect(withJustWeb.spec.entryPoints).toStrictEqual(["web"]);
    const withJustWebSecure = TraefikIngressRoute("foo", "bar", 80, {
      entryPoints: ["web-secure"]
    });
    expect(withJustWebSecure.spec.entryPoints).toStrictEqual(["web-secure"]);
    const withBoth = TraefikIngressRoute("foo", "bar", 80, {
      entryPoints: ["web", "web-secure"]
    });
    expect(withBoth.spec.entryPoints).toStrictEqual(["web", "web-secure"]);
  });

  test("middleware gets added properly", () => {
    const middlewares = Array.from({ length: 10 }, () => "/" + uuid());
    const middlewaresNameArray = [
      ...middlewares.map(middlewareName => ({ name: middlewareName }))
    ];

    const withMiddlewares = TraefikIngressRoute("foo", "bar", 80, {
      middlewares
    });

    const middlewaresValues = withMiddlewares.spec.routes[0].middlewares;
    expect(middlewaresValues && middlewaresValues.length).toBe(
      middlewares.length
    );
    expect(middlewaresValues).toMatchObject(middlewaresNameArray);
  });
});
