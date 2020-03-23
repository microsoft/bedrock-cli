import * as fs from "fs";
import * as mocks from "../../test/mockFactory";
import { BedrockFile } from "../../types";
import * as reconcile from "./reconcile";

jest.mock("fs");

beforeEach(() => {
  jest.resetAllMocks();
});

describe("createMiddlewareForRing", () => {
  const tests: {
    name: string;
    actual: () => unknown;
    expected: unknown;
    effects?: (() => void)[];
  }[] = [
    {
      name: "isDefault === false; creates one (1) middleware",
      actual: (): unknown =>
        reconcile.createMiddlewareForRing(
          "path-to-ring",
          "my-service",
          "my-ring",
          "v1",
          false
        ),
      expected: { ringed: expect.anything(), default: undefined },
      effects: [
        (): void => {
          expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
          expect(fs.writeFileSync).toHaveBeenCalledWith(
            expect.anything(),
            expect.not.stringContaining("\n---\n")
          );
        },
      ],
    },

    {
      name: "isDefault === true; creates two (2) middleware",
      actual: (): unknown =>
        reconcile.createMiddlewareForRing(
          "path-to-ring",
          "my-service",
          "my-ring",
          "v1",
          true
        ),
      expected: {
        ringed: expect.objectContaining({
          metadata: { name: "my-service-my-ring" },
        }),
        default: expect.objectContaining({ metadata: { name: "my-service" } }),
      },
      effects: [
        (): void => {
          expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
          expect(fs.writeFileSync).toHaveBeenCalledWith(
            expect.anything(),
            expect.stringContaining("\n---\n")
          );
        },
      ],
    },
  ];

  for (const { name, actual, expected, effects } of tests) {
    it(name, () => {
      expect(actual()).toStrictEqual(expected);
      for (const effect of effects ?? []) {
        effect();
      }
    });
  }
});

describe("createIngressRouteForRing", () => {
  const { services } = mocks.createTestBedrockYaml(false) as BedrockFile;
  const tests: {
    name: string;
    actual: () => unknown;
    expected: unknown;
    effects?: (() => void)[];
  }[] = [
    {
      name: "isDefault === false; creates one (1) IngressRoute",
      actual: (): unknown =>
        reconcile.createIngressRouteForRing(
          "path-to-ring",
          "my-service",
          Object.values(services)[0],
          { ringed: { metadata: { name: "my-service-my-ring" } } },
          "my-ring",
          "version-path",
          false
        ),
      expected: [
        expect.objectContaining({ metadata: { name: "my-service-my-ring" } }),
      ],
      effects: [
        (): void => {
          // Should write out one yaml document (no "---")
          expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
          expect(fs.writeFileSync).toHaveBeenCalledWith(
            expect.anything(),
            expect.not.stringContaining("\n---\n")
          );
        },
      ],
    },

    {
      name: "isDefault === true; creates two (2) IngressRoute",
      actual: (): unknown =>
        reconcile.createIngressRouteForRing(
          "foo",
          "my-service",
          Object.values(services)[0],
          { ringed: { metadata: { name: "my-service-my-ring" } } },
          "my-ring",
          "version-path",
          true
        ),
      expected: [
        expect.objectContaining({ metadata: { name: "my-service-my-ring" } }),
        expect.objectContaining({ metadata: { name: "my-service" } }),
      ],
      effects: [
        (): void => {
          // Should write out two yaml documents (with "---")
          expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
          expect(fs.writeFileSync).toHaveBeenCalledWith(
            expect.anything(),
            expect.stringContaining("\n---\n")
          );
        },
      ],
    },
  ];

  for (const { name, actual, expected, effects } of tests) {
    it(name, () => {
      expect(actual()).toStrictEqual(expected);
      for (const effect of effects ?? []) {
        effect();
      }
    });
  }
});
