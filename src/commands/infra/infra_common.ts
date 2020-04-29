import * as os from "os";
import path from "path";
import url from "url";

export const bedrockTemplatesPath = path.join(
  os.homedir(),
  ".bedrock",
  "templates"
);

export const DEFINITION_YAML = "definition.yaml";
export const VARIABLES_TF = "variables.tf";
export const BACKEND_TFVARS = "backend.tfvars";
export const TERRAFORM_TFVARS = "terraform.tfvars";
export const BEDROCK_TFVARS = "bedrock.tfvars";
export const DEFAULT_VAR_VALUE = "<insert value>";

/**
 * Returns a source folder name for a given git URL.
 *
 * @param source git source URL
 */
export const getSourceFolderNameFromURL = (source: string): string => {
  const punctuationReg = /[^\w\s]/g;

  const oUrl = url.parse(source); // does not throw any exception. even when source is an empty string
  if (oUrl.hostname) {
    return (oUrl.pathname || "").replace(punctuationReg, "_").toLowerCase();
  }
  // no hostname e.g. git@github.com:microsoft/bedrock.git
  const idx = source.indexOf(":");
  if (idx === -1) {
    // do not have :
    return source.replace(punctuationReg, "_").toLowerCase();
  }
  return source.substring(idx).replace(punctuationReg, "_").toLowerCase();
};
