import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import { IBedrockFile, IMaintainersFile } from "./types";

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////
/**
 * Helper function to parse a YAML file
 *
 * @throws {Error} when the file does not exist
 *
 * @param yamlFilename filename of the yaml file
 * @param parentDir the parent directory containing the yaml file
 */
const readYaml = <T>(
  yamlFilename: string,
  parentDir: string = process.cwd()
): T => {
  const filepath = path.join(parentDir, yamlFilename);
  if (fs.existsSync(filepath)) {
    const contents = fs.readFileSync(filepath, "utf8");
    return yaml.safeLoad(contents) as T;
  }
  throw new Error(`Unable to locate '${yamlFilename}' at '${filepath}'`);
};

////////////////////////////////////////////////////////////////////////////////
// Exported
////////////////////////////////////////////////////////////////////////////////
/**
 * Returns the current bedrock.yaml file for the project
 */
export const bedrock = async () => readYaml<IBedrockFile>("bedrock.yaml");

/**
 * Returns the current maintainers.yaml file for the project
 */
export const maintainers = async () =>
  readYaml<IMaintainersFile>("maintainers.yaml");

/**
 * Helper to write out a bedrock.yaml or maintainers.yaml file to the project root
 *
 * @param file config file object to serialize and write out
 */
export const write = (
  file: IBedrockFile | IMaintainersFile,
  parentDirectory = process.cwd()
) => {
  const asYaml = yaml.safeDump(file, { lineWidth: Number.MAX_SAFE_INTEGER });
  if ("rings" in file) {
    // Is bedrock.yaml
    return fs.writeFileSync(path.join(parentDirectory, "bedrock.yaml"), asYaml);
  } else {
    // Is maintainers file
    return fs.writeFileSync(
      path.join(parentDirectory, "maintainers.yaml"),
      asYaml
    );
  }
};
