import fs from "fs";
import os from "os";
import path from "path";
import uuid from "uuid/v4";
import { logger } from "../logger";

/**
 * Creates a random directory in tmp directory.
 *
 * @param parent Parent directory. Directory will be created
 *        in os temp dir if this value is not provided
 * @return full path of the new directory.
 */
export const createTempDir = (parent?: string): string => {
  parent = parent || os.tmpdir();

  const randomTmpDir = path.join(parent, uuid());
  fs.mkdirSync(randomTmpDir);
  return randomTmpDir;
};

/**
 * Removes directory, including all sub directory and files
 * @param dir Directory name
 */
export const removeDir = (dir: string): void => {
  const folder = path.resolve(dir);
  if (fs.existsSync(folder)) {
    fs.readdirSync(folder).forEach((item) => {
      const curPath = path.join(folder, item);
      if (fs.statSync(curPath).isDirectory()) {
        removeDir(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folder);
  }
};

/**
 * Returns true if directory is empty.
 *
 * @param dir Directory to be inspected.
 * @return true if directory is empty.
 */
export const isDirEmpty = (dir: string): boolean => {
  return fs.readdirSync(dir).length === 0;
};

/**
 * Returns a list of missing file names.
 * This is to check if files exist in a directory.
 *
 * @param dir Directory where files resides
 * @param fileNames Name of files that are supposed to exist in the dir.
 * @return a list of missing file names.
 */
export const getMissingFilenames = (
  dir: string,
  fileNames: string[]
): string[] => {
  return fileNames
    .map(
      (f) => path.join(dir, f) // form full path
    )
    .filter(
      (f) => !fs.existsSync(f) // keep those files that do not exist
    )
    .map((f) => path.basename(f));
};

/**
 * Returns all files/filepaths in this directory and subdirectories.
 *
 * @param dir directory to search
 * @param files list of files
 * @returns list of files in given directory and subdirectories.
 */
export const getAllFilesInDirectory = (
  dir: string,
  files: string[] = []
): string[] => {
  const filesInDir = fs.readdirSync(dir);

  filesInDir.forEach(function (file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      files = getAllFilesInDirectory(path.join(dir, file), files);
    } else {
      files.push(path.join(dir, file));
    }
  });

  return files;
};
