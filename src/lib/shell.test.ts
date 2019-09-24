import { disableVerboseLogging, enableVerboseLogging } from "../logger";
import { exec } from "./shell";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("Shelling out to executables that exist on system", () => {
  test("ls", async () => {
    let out: string | undefined;
    try {
      out = await exec("ls");
    } catch (_) {
      out = undefined;
    }
    expect(out).not.toBeUndefined();
  });
});

describe("Shelling out to executables not found on PATH", () => {
  test("An executable that does not exist", async () => {
    let out: string | undefined;
    try {
      out = await exec("someRandomExecutableThatDoesNotExist");
    } catch (_) {
      out = undefined;
    }
    expect(out).toBeUndefined();
  });
});
