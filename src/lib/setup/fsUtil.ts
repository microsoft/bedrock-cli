import fs from "fs-extra";
import { removeDir } from "../ioUtil";

/**
 * Change directory to an absolute path
 *
 * @param absPath Absolute Path
 */
export const moveToAbsPath = (absPath: string) => {
  process.chdir(absPath);
};

/**
 * Change directory to a relative path
 *
 * @param relativePath Relative Path
 */
export const moveToRelativePath = (relativePath: string) => {
  process.chdir(relativePath);
};

/**
 * Creates directory.
 *
 * @param dirName Directory Name
 * @param removeIfExist Remove the directory if it exists and then recreate.
 */
export const createDirectory = (dirName: string, removeIfExist = false) => {
  if (removeIfExist && fs.existsSync(dirName)) {
    removeDir(dirName);
  }
  fs.mkdirpSync(dirName);
};
