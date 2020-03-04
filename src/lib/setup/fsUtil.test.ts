import * as fs from "fs-extra";
import os from "os";
import path from "path";
import uuid from "uuid/v4";
import { createTempDir } from "../ioUtil";
import * as ioUtil from "../ioUtil";
import { createDirectory, moveToAbsPath, moveToRelativePath } from "./fsUtil";

describe("test moveToAbsPath function", () => {
  it("move to tmp directory", () => {
    const cur = process.cwd();
    const dir = path.join(createTempDir());
    moveToAbsPath(dir);
    expect(process.cwd()).toBe(fs.realpathSync(dir));
    process.chdir(cur);
  });
});

describe("test moveToRelativePath function", () => {
  it("move to tmp directory", () => {
    const cur = process.cwd();
    const tmpDir = os.tmpdir();
    const folder = uuid();
    const randomTmpDir = path.join(tmpDir, folder);
    fs.mkdirSync(randomTmpDir);

    process.chdir(tmpDir);
    moveToRelativePath(folder);

    expect(process.cwd()).toBe(fs.realpathSync(randomTmpDir));
    process.chdir(cur);
  });
});

describe("test createDirectory function", () => {
  it("directory already exists", () => {
    jest.spyOn(fs, "existsSync").mockReturnValueOnce(true);
    const fnRemoveDir = jest.spyOn(ioUtil, "removeDir");
    fnRemoveDir.mockReturnValueOnce();
    createDirectory(createTempDir(), true);
  });
});
