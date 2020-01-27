import fs from "fs";
import os from "os";
import path from "path";
import uuid from "uuid/v4";

/**
 * Creates a random directory in tmp directory.
 *
 * @return full path of the new directory.
 */
export const createTempDir = (): string => {
  const randomTmpDir = path.join(os.tmpdir(), uuid());
  fs.mkdirSync(randomTmpDir);
  return randomTmpDir;
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
      f => path.join(dir, f) // form full path
    )
    .filter(
      f => !fs.existsSync(f) // keep those files that do not exist
    );
};
