import * as os from "os";
import path from "path";

export const spkTemplatesPath = path.join(os.homedir(), ".spk/templates");

export const repoCloneRegex = async (source: string): Promise<string> => {
  const httpReg = /^(.*?)\.com/;
  const punctuationReg = /[^\w\s]/g;
  const sourceFolder = source
    .replace(httpReg, "")
    .replace(punctuationReg, "_")
    .toLowerCase();
  return sourceFolder;
};
