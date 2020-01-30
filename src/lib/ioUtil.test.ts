import fs from "fs";
import path from "path";
import {
  createTempDir,
  getMissingFilenames,
  isDirEmpty,
  removeDir
} from "./ioUtil";

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

    files.forEach(f => {
      fs.writeFileSync(path.join(dir, `${f}.txt`), f);
    });

    const missing = getMissingFilenames(
      dir,
      files.map(f => `${f}.txt`)
    );
    expect(missing.length).toBe(0);
  });
  it("none of files exists", () => {
    const dir = createTempDir();
    const files = ["hello", "world"];

    const missing = getMissingFilenames(
      dir,
      files.map(f => `${f}.txt`)
    );
    expect(missing.length).toBe(2);
  });
  it("some of files exists", () => {
    const dir = createTempDir();
    const files = ["hello", "world", "again"];

    files
      .filter(f => f !== "again")
      .forEach(f => {
        fs.writeFileSync(path.join(dir, `${f}.txt`), f);
      });

    const missing = getMissingFilenames(
      dir,
      files.map(f => `${f}.txt`)
    );
    expect(missing.length).toBe(1);
  });
});
