import fs from "fs";
import mockFs from "mock-fs";

import yaml from "js-yaml";
import { MockFactory } from "../test/mockFactory";

import { disableVerboseLogging, enableVerboseLogging, logger } from "../logger";
import { IMaintainersFile, IUser } from "../types";
import { addNewServiceToMaintainersFile } from "./fileutils";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("Adding a new service", () => {
  beforeAll(() => {
    mockFs({
      "maintainers.yml": MockFactory.createTestMaintainersYaml() as any
    });
  });

  afterAll(() => {
    mockFs.restore();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should update existing maintainers.yml with new service maintainers", async () => {
    const maintainersFilePath = "maintainers.yml";

    const servicePath = "packages/my-new-service";
    const newUser = {
      email: "hello@example.com",
      name: "testUser"
    };

    const writeSpy = jest.spyOn(fs, "writeFileSync");
    await addNewServiceToMaintainersFile(maintainersFilePath, servicePath, [
      newUser
    ]);

    const defaultMaintainersFileObject = MockFactory.createTestMaintainersYaml(
      false
    );

    const expected: IMaintainersFile = {
      services: {
        ...((defaultMaintainersFileObject as any) as IMaintainersFile).services,
        ["./" + servicePath]: {
          maintainers: [newUser]
        }
      }
    };

    expect(writeSpy).toBeCalledWith(
      maintainersFilePath,
      yaml.safeDump(expected),
      "utf8"
    );
  });
});
