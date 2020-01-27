import fs from "fs";
import path from "path";
import { createTempDir, getMissingFilenames } from "./ioUtil";

describe("test createTempDir function", () => {
  it("create and existence check", () => {
    const name = createTempDir();
    expect(fs.existsSync(name)).toBe(true);
    fs.rmdirSync(name);
    expect(fs.existsSync(name)).toBe(false);
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
