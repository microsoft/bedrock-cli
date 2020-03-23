import { create } from "./middleware";

describe("TraefikIngressRoute", () => {
  test("the right name with service name is created", () => {
    const middlewareWithoutRing = create("my-service", "", [
      "/home",
      "/info",
      "/data",
    ]);
    expect(middlewareWithoutRing.metadata.name).toBe("my-service");
    expect(middlewareWithoutRing.metadata.namespace).toBe(undefined);
    expect(middlewareWithoutRing.spec.stripPrefix.forceSlash).toBe(false);
    expect(middlewareWithoutRing.spec.stripPrefix.prefixes.length).toBe(3);
    expect(middlewareWithoutRing.spec.stripPrefix.prefixes[0]).toBe("/home");
    expect(middlewareWithoutRing.spec.stripPrefix.prefixes[1]).toBe("/info");
    expect(middlewareWithoutRing.spec.stripPrefix.prefixes[2]).toBe("/data");

    const middlewareWithRing = create("my-service", "prod", ["/home"]);
    expect(middlewareWithRing.metadata.name).toBe("my-service-prod");
    expect(middlewareWithRing.spec.stripPrefix.prefixes.length).toBe(1);
    expect(middlewareWithRing.spec.stripPrefix.prefixes[0]).toBe("/home");
  });

  test("optional parameters", () => {
    const middlewareWithRing = create(
      "my-service",
      "prod",
      ["/home", "/away"],
      { forceSlash: true, namespace: "prod-ring" }
    );
    expect(middlewareWithRing.metadata.name).toBe("my-service-prod");
    expect(middlewareWithRing.metadata.namespace).toBe("prod-ring");
    expect(middlewareWithRing.spec.stripPrefix.forceSlash).toBe(true);
    expect(middlewareWithRing.spec.stripPrefix.prefixes.length).toBe(2);
    expect(middlewareWithRing.spec.stripPrefix.prefixes[0]).toBe("/home");
    expect(middlewareWithRing.spec.stripPrefix.prefixes[1]).toBe("/away");
  });
});
