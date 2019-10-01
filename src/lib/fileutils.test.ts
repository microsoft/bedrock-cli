import fs from "fs";
import os from "os";
import path from "path";
import uuid from "uuid/v4";
import yaml from "js-yaml";
import { promisify } from "util";

import cpFile from "cp-file";

import { IMaintainersFile, IUser } from "../types";
import { disableVerboseLogging, enableVerboseLogging, logger } from "../logger";
import { addNewServiceToMaintainersFile } from "./fileutils";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("Adding a new maintainer to existing maintainers file", () => {
  test("Existing maintainer, existing service", async () => {
    // Create random directory to initialize
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    fs.mkdirSync(randomTmpDir);

    const maintainerFilePath = path.join(randomTmpDir, "maintainers.yaml");
    console.log(maintainerFilePath);
    // TODO: figure out this path for the file...
    // await cpFile(
    //   process.cwd() + "/src/lib/maintainers.yaml",
    //   maintainerFilePath
    // );
    // logger.info("File copied");

    // Create starting existing maintainers file.
    await writeSampleMaintainersFileToDir(maintainerFilePath);

    const newUser = {
      email: "hello@example.com",
      name: "testUser"
    } as IUser;

    await addNewServiceToMaintainersFile(
      maintainerFilePath,
      "./packages/my-new-service",
      [newUser]
    );

    const actualUpdatedMaintainersFile = yaml.safeLoad(
      fs.readFileSync(maintainerFilePath, "utf8")
    ) as IMaintainersFile;

    const expected = await yaml.safeLoad(`
      services:
        ./:
          maintainers:
            - email: somegithubemailg@users.noreply.github.com
              name: my name
        ./packages/service1:
          maintainers:
            - email: ""
              name: ""
        ./packages/my-new-service:
          maintainers:
            - email: hello@example.com
              name: testUser
  `);

    expect(actualUpdatedMaintainersFile).toEqual(expected);

    // assert that this file is now updated with the new service..
    // 1. write to file
    // 1. read it back, yaml parse then compare to expected content
  });
});

const writeSampleMaintainersFileToDir = async (maintainersFilePath: string) => {
  await promisify(fs.writeFile)(
    maintainersFilePath,
    yaml.safeDump(
      yaml.safeLoad(`
      services:
        ./:
          maintainers:
          - email: somegithubemailg@users.noreply.github.com
            name: my name
        ./packages/service1:
          maintainers:
          - email: ""
            name: ""
    `)
    ),
    "utf8"
  );
};
