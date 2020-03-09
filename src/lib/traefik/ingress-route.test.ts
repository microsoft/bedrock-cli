import uuid = require("uuid/v4");
import { TraefikIngressRoute } from "./ingress-route";

describe("TraefikIngressRoute", () => {
  test("the right object name and service name is created", () => {
    const routeWithoutRing = TraefikIngressRoute(
      "my-service",
      "",
      80,
      "/version/and/Path"
    );
    expect(routeWithoutRing.metadata.name).toBe("my-service");
    expect(routeWithoutRing.spec.routes[0].services[0].name).toBe("my-service");
    const routeWithRing = TraefikIngressRoute(
      "my-service",
      "prod",
      80,
      "/version/and/Path"
    );
    expect(routeWithRing.metadata.name).toBe("my-service-prod");
    expect(routeWithRing.spec.routes[0].services[0].name).toBe(
      "my-service-prod"
    );
  });

  test("service backend maps to service name and port", () => {
    const routeWithK8sBackendAndRing = TraefikIngressRoute(
      "my-service",
      "master",
      80,
      "/version/and/path",
      {
        k8sBackend: "my-k8s-svc"
      }
    );

    expect(routeWithK8sBackendAndRing.spec.routes[0].services[0].name).toBe(
      "my-k8s-svc-master"
    );
  });

  test("manifest namespace gets injected properly", () => {
    const randomNamespaces = Array.from({ length: 10 }, () => uuid());
    for (const namespace of randomNamespaces) {
      const withoutNamespace = TraefikIngressRoute(
        "foo",
        "bar",
        80,
        "/version/and/Path",
        {
          namespace
        }
      );
      expect(withoutNamespace.metadata.namespace).toBe(namespace);
    }
  });

  test("the service port gets properly injected", () => {
    const randomPorts = Array.from({ length: 10 }, () =>
      Math.floor(Math.random() * 1000)
    );
    for (const servicePort of randomPorts) {
      const route = TraefikIngressRoute(
        "foo",
        "",
        servicePort,
        "/version/and/Path"
      );
      expect(route.spec.routes[0].services[0].port).toBe(servicePort);
    }
  });

  test("entryPoints gets injected properly", () => {
    const withoutEntryPoints = TraefikIngressRoute(
      "foo",
      "bar",
      80,
      "/version/and/Path"
    );
    expect(typeof withoutEntryPoints.spec.entryPoints).toBe("undefined");
    const withJustWeb = TraefikIngressRoute(
      "foo",
      "bar",
      80,
      "/version/and/Path",
      {
        entryPoints: ["web"]
      }
    );
    expect(withJustWeb.spec.entryPoints).toStrictEqual(["web"]);
    const withJustWebSecure = TraefikIngressRoute(
      "foo",
      "bar",
      80,
      "/version/and/Path",
      {
        entryPoints: ["web-secure"]
      }
    );
    expect(withJustWebSecure.spec.entryPoints).toStrictEqual(["web-secure"]);
    const withBoth = TraefikIngressRoute(
      "foo",
      "bar",
      80,
      "/version/and/Path",
      {
        entryPoints: ["web", "web-secure"]
      }
    );
    expect(withBoth.spec.entryPoints).toStrictEqual(["web", "web-secure"]);
  });

  test("middleware gets added properly", () => {
    const middlewares = Array.from({ length: 10 }, () => "/" + uuid());
    const middlewaresNameArray = [
      ...middlewares.map(middlewareName => ({ name: middlewareName }))
    ];

    const withMiddlewares = TraefikIngressRoute(
      "foo",
      "bar",
      80,
      "/version/and/Path",
      {
        middlewares
      }
    );

    const middlewaresValues = withMiddlewares.spec.routes[0].middlewares;
    expect(middlewaresValues && middlewaresValues.length).toBe(
      middlewares.length
    );
    expect(middlewaresValues).toMatchObject(middlewaresNameArray);
  });

  test("the path prefix and ring headers are created.", () => {
    const routeWithoutRing = TraefikIngressRoute(
      "my-service",
      "",
      80,
      "/version/and/Path"
    );
    expect(routeWithoutRing.metadata.name).toBe("my-service");
    expect(routeWithoutRing.spec.routes[0].services[0].name).toBe("my-service");
    expect(routeWithoutRing.spec.routes[0].match).toBe(
      "PathPrefix(`/version/and/Path`)"
    );
    const routeWithRing = TraefikIngressRoute(
      "my-service",
      "prod",
      80,
      "/version/and/Path"
    );
    expect(routeWithRing.metadata.name).toBe("my-service-prod");
    expect(routeWithRing.spec.routes[0].services[0].name).toBe(
      "my-service-prod"
    );
    expect(routeWithRing.spec.routes[0].match).toBe(
      "PathPrefix(`/version/and/Path`) && Headers(`Ring`, `prod`)"
    );
  });

  test("does not throw when meta.name and spec.routes[].services[].name is valid", () => {
    expect(() =>
      TraefikIngressRoute("valid-service", "valid-ring", 80, "v1")
    ).not.toThrow();
    expect(() =>
      TraefikIngressRoute("valid-service", "valid-ring", 80, "v1", {
        k8sBackend: "my.valid.service"
      })
    ).not.toThrow();
  });

  test("throws when meta.name is invalid", () => {
    expect(() =>
      TraefikIngressRoute("-invalid-serivce&name", "valid-ring", 80, "v1")
    ).toThrow();
    expect(() =>
      TraefikIngressRoute("valid-service-name", "invalid-ring-!@#", 80, "v1")
    ).toThrow();
  });

  test("throws when spec.routes[].services[].name is invalid", () => {
    expect(() =>
      TraefikIngressRoute("-invalid-service", "valid-ring", 80, "v1")
    ).toThrow();
    expect(() =>
      TraefikIngressRoute("valid-service", "valid-ring", 80, "v1", {
        k8sBackend: "-invalid"
      })
    ).toThrow();
  });
});
