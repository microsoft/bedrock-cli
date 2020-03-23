import { create } from "./ingress-route";

describe("TraefikIngressRoute - Unit Tests", () => {
  type PartialIngressRoute = Partial<ReturnType<typeof create>>;
  const tests: {
    name: string;
    actual: () => unknown;
    expected: unknown;
    effects?: (() => void)[];
  }[] = [
    {
      name:
        "correct object metadata.name, service name/port, namespace is created: no ring",
      actual: (): unknown =>
        create("my-service", "", 80, "/version/and/Path", {
          namespace: "my-namespace",
        }),
      expected: expect.objectContaining<PartialIngressRoute>({
        metadata: { name: "my-service", namespace: "my-namespace" },
        spec: {
          routes: expect.arrayContaining([
            expect.objectContaining({
              services: [{ name: "my-service", port: 80 }],
            }),
          ]),
        },
      }),
    },

    {
      name:
        "correct object metadata.name, service name/port, namespace is created: with ring",
      actual: (): unknown =>
        create("my-service", "prod", 1337, "/version/and/Path", {
          namespace: "my-namespace",
        }),
      expected: expect.objectContaining<PartialIngressRoute>({
        metadata: { name: "my-service-prod", namespace: "my-namespace" },
        spec: {
          routes: expect.arrayContaining([
            expect.objectContaining({
              services: [{ name: "my-service-prod", port: 1337 }],
            }),
          ]),
        },
      }),
    },

    {
      name: "service backend maps to service name and port",
      actual: (): unknown =>
        create("my-service", "master", 80, "/version/and/path", {
          k8sBackend: "my-k8s-svc",
        }),
      expected: expect.objectContaining<PartialIngressRoute>({
        spec: {
          routes: expect.arrayContaining([
            expect.objectContaining({
              services: [{ name: "my-k8s-svc-master", port: 80 }],
            }),
          ]),
        },
      }),
    },

    {
      name: "middleware are added",
      actual: (): unknown =>
        create("foo", "bar", 80, "/version/and/Path", {
          middlewares: ["mw1", "mw2", "mw3"],
        }),
      expected: expect.objectContaining<PartialIngressRoute>({
        spec: {
          routes: expect.arrayContaining([
            expect.objectContaining({
              middlewares: [{ name: "mw1" }, { name: "mw2" }, { name: "mw3" }],
            }),
          ]),
        },
      }),
    },

    {
      name: "endpoints are injected properly: no entry-points",
      actual: (): unknown => create("foo", "bar", 80, "/version/and/Path"),
      expected: expect.objectContaining<PartialIngressRoute>({
        spec: expect.not.objectContaining({ entryPoints: expect.anything() }),
      }),
    },

    {
      name: "endpoints are injected properly: web",
      actual: (): unknown =>
        create("foo", "bar", 80, "/version/and/Path", {
          entryPoints: ["web"],
        }),
      expected: expect.objectContaining<PartialIngressRoute>({
        spec: expect.objectContaining({ entryPoints: ["web"] }),
      }),
    },

    {
      name: "endpoints are injected properly: web-secure",
      actual: (): unknown =>
        create("foo", "bar", 80, "/version/and/Path", {
          entryPoints: ["web-secure"],
        }),
      expected: expect.objectContaining<PartialIngressRoute>({
        spec: expect.objectContaining({ entryPoints: ["web-secure"] }),
      }),
    },

    {
      name: "endpoints are injected properly: [web,web-secure]",
      actual: (): unknown =>
        create("foo", "bar", 80, "/version/and/Path", {
          entryPoints: ["web", "web-secure"],
        }),
      expected: expect.objectContaining<PartialIngressRoute>({
        spec: expect.objectContaining({ entryPoints: ["web", "web-secure"] }),
      }),
    },

    {
      name: "path prefix and ring headers are created: no ring",
      actual: (): unknown => create("my-service", "", 80, "/version/and/Path"),
      expected: expect.objectContaining<PartialIngressRoute>({
        metadata: { name: "my-service" },
        spec: {
          routes: expect.arrayContaining([
            expect.objectContaining({
              match: "PathPrefix(`/version/and/Path`)",
              services: expect.arrayContaining([
                expect.objectContaining({ name: "my-service" }),
              ]),
            }),
          ]),
        },
      }),
    },

    {
      name: "path prefix and ring headers are created: with ring",
      actual: (): unknown =>
        create("my-service", "prod", 80, "/version/and/Path"),
      expected: expect.objectContaining<PartialIngressRoute>({
        metadata: { name: "my-service-prod" },
        spec: {
          routes: expect.arrayContaining([
            expect.objectContaining({
              match:
                "PathPrefix(`/version/and/Path`) && Headers(`Ring`, `prod`)",
              services: expect.arrayContaining([
                expect.objectContaining({ name: "my-service-prod" }),
              ]),
            }),
          ]),
        },
      }),
    },

    {
      name: "configured correctly when isDefault === false",
      actual: (): unknown =>
        create("my-service", "master", 80, "/version/and/path", {
          k8sBackend: "my-k8s-svc",
          isDefault: false,
        }),
      expected: expect.objectContaining<PartialIngressRoute>({
        metadata: { name: "my-service-master" },
        spec: {
          routes: expect.arrayContaining([
            expect.objectContaining({
              match: expect.stringMatching(/.*ring.*master/i),
              services: expect.arrayContaining([
                expect.objectContaining({
                  name: expect.stringContaining("master"),
                }),
              ]),
            }),
          ]),
        },
      }),
    },

    {
      name: "configured correctly when isDefault === true",
      actual: (): unknown =>
        create("my-service", "master", 80, "/version/and/path", {
          k8sBackend: "my-k8s-svc",
          isDefault: true,
        }),
      expected: expect.objectContaining<PartialIngressRoute>({
        metadata: { name: "my-service" },
        spec: {
          routes: expect.arrayContaining([
            expect.objectContaining({
              match: expect.not.stringMatching(/.*ring.*master/i),
              services: expect.arrayContaining([
                expect.objectContaining({
                  name: expect.stringContaining("master"),
                }),
              ]),
            }),
          ]),
        },
      }),
    },
  ];

  for (const { name, actual, expected, effects } of tests) {
    test(name, () => {
      expect(actual()).toStrictEqual(expected);
    });
    for (const effect of effects ?? []) {
      effect();
    }
  }
});

describe("TraefikIngressRoute - Throwable", () => {
  const testsThatThrow: {
    name: string;
    actual: () => unknown;
    throws: boolean;
  }[] = [
    {
      name: "throws when meta.name is invalid: dash (-) prefix",
      actual: (): unknown =>
        create("-invalid-serivce&name", "valid-ring", 80, "v1"),
      throws: true,
    },

    {
      name: "throws when meta.name is invalid: invalid characters",
      actual: (): unknown =>
        create("valid-service-name", "invalid-ring-!@#", 80, "v1"),
      throws: true,
    },

    {
      name:
        "throws when spec.routes[].services[].name is invalid: dash (-) prefix in service name",
      actual: (): unknown => create("-invalid-service", "valid-ring", 80, "v1"),
      throws: true,
    },

    {
      name:
        "throws when spec.routes[].services[].name is invalid: dash (-) prefix in k8sBackend",
      actual: (): unknown =>
        create("valid-service", "valid-ring", 80, "v1", {
          k8sBackend: "-invalid",
        }),
      throws: true,
    },

    {
      name:
        "does not throw when meta.name and spec.routes[].services[].name is valid: no k8sBackend",
      actual: (): unknown => create("valid-service", "valid-ring", 80, "v1"),
      throws: false,
    },

    {
      name:
        "does not throw when meta.name and spec.routes[].services[].name is valid: with k8sBackend",
      actual: (): unknown =>
        create("valid-service", "valid-ring", 80, "v1", {
          k8sBackend: "my.valid.service",
        }),
      throws: false,
    },
  ];

  for (const { name, actual, throws } of testsThatThrow) {
    test(name, () => {
      if (throws) {
        expect(() => actual()).toThrow();
      } else {
        expect(() => actual()).not.toThrow();
      }
    });
  }
});
