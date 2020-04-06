import fs from "fs";
import path from "path";
import uuid from "uuid/v4";
import {
  createTempDir,
  getAllFilesInDirectory,
  getMissingFilenames,
  isDirEmpty,
  removeDir,
} from "./ioUtil";
import mockFs from "mock-fs";
import { disableVerboseLogging, enableVerboseLogging, logger } from "../logger";

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("test createTempDir function", () => {
  it("create and existence check", () => {
    const name = createTempDir();
    expect(fs.existsSync(name)).toBe(true);
    fs.rmdirSync(name);
    expect(fs.existsSync(name)).toBe(false);
  });
  it("create in a target folder and existence check", () => {
    const parent = createTempDir();
    expect(fs.existsSync(parent)).toBe(true);
    const sub = createTempDir(parent);
    expect(fs.existsSync(sub)).toBe(true);
    fs.rmdirSync(sub);
    fs.rmdirSync(parent);
    expect(fs.existsSync(parent)).toBe(false);
  });
});

describe("test removeDir", () => {
  it("non exist directory", () => {
    removeDir(uuid()); // no exception thrown
  });
  it("empty directory", () => {
    const name = createTempDir();
    removeDir(name);
    expect(fs.existsSync(name)).toBe(false);
  });
  it("directory with files", () => {
    const name = createTempDir();
    fs.writeFileSync(path.join(name, "file1"), "test");
    fs.writeFileSync(path.join(name, "file2"), "test");
    removeDir(name);
    expect(fs.existsSync(name)).toBe(false);
  });
  it("directory with files and directory", () => {
    const parent = createTempDir();
    fs.writeFileSync(path.join(parent, "file1"), "test");
    fs.writeFileSync(path.join(parent, "file2"), "test");

    const sub = createTempDir(parent);
    fs.writeFileSync(path.join(sub, "file1"), "test");
    fs.writeFileSync(path.join(sub, "file2"), "test");

    removeDir(parent);
    expect(fs.existsSync(parent)).toBe(false);
  });
});

describe("test isDirEmpty function", () => {
  it("positive test", () => {
    const name = createTempDir();
    expect(isDirEmpty(name)).toBe(true);
  });
  it("negative test", () => {
    const name = createTempDir();
    fs.writeFileSync(path.join(name, "test.txt"), "hello world");
    expect(isDirEmpty(name)).toBe(false);
  });
});

describe("test doFilesExist function", () => {
  it("all files exists", () => {
    const dir = createTempDir();
    const files = ["hello", "world"];

    files.forEach((f) => {
      fs.writeFileSync(path.join(dir, `${f}.txt`), f);
    });

    const missing = getMissingFilenames(
      dir,
      files.map((f) => `${f}.txt`)
    );
    expect(missing.length).toBe(0);
  });
  it("none of files exists", () => {
    const dir = createTempDir();
    const files = ["hello", "world"];

    const missing = getMissingFilenames(
      dir,
      files.map((f) => `${f}.txt`)
    );
    expect(missing.length).toBe(2);
  });
  it("some of files exists", () => {
    const dir = createTempDir();
    const files = ["hello", "world", "again"];

    files
      .filter((f) => f !== "again")
      .forEach((f) => {
        fs.writeFileSync(path.join(dir, `${f}.txt`), f);
      });

    const missing = getMissingFilenames(
      dir,
      files.map((f) => `${f}.txt`)
    );
    expect(missing.length).toBe(1);
  });
});

describe("test getAllFilesInDirectory function", () => {
  beforeEach(() => {
    mockFs({
      "hld-repo": {
        config: {
          "common.yaml": "someconfigfile",
        },
        "bedrock-project-repo": {
          "access.yaml": "someaccessfile",
          config: {
            "common.yaml": "someconfigfile",
          },
          serviceA: {
            config: {
              "common.yaml": "someconfigfile",
            },
            master: {
              config: {
                "common.yaml": "someconfigfile",
                "prod.yaml": "someconfigfile",
                "stage.yaml": "someconfigfile",
              },
              static: {
                "ingressroute.yaml": "ingressroutefile",
                "middlewares.yaml": "middlewaresfile",
              },
              "component.yaml": "somecomponentfile",
            },
            "component.yaml": "somecomponentfile",
          },
          "component.yaml": "somecomponentfile",
        },
        "component.yaml": "somecomponentfile",
      },
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it("gets all files in a populated directory", () => {
    const fileList = getAllFilesInDirectory("hld-repo");
    expect(fileList).toHaveLength(13);
    expect(fileList).toContain(
      "hld-repo/bedrock-project-repo/serviceA/master/static/middlewares.yaml"
    );

    const filesToDelete = fileList.filter(
      (filePath) =>
        !filePath.match(/access\.yaml$/) && !filePath.match(/config\/.*\.yaml$/)
    );
    logger.info("filestoDelete.length: " + filesToDelete.length);
    logger.info(filesToDelete);
  });

  it("returns an empty list when there's no files directory", () => {
    mockFs({
      emptyDirectory: {},
    });

    const fileList = getAllFilesInDirectory("emptyDirectory");
    expect(fileList).toHaveLength(0);
  });
});
