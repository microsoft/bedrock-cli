import commander from "commander";
import fs, { chmod } from "fs";
import fsextra, { readdir } from "fs-extra";
import path from "path";
import { logger } from "../../logger";

/**
 * Adds the init command to the commander command object
 *
 * @param command Commander command object to decorate
 */
export const scaffoldCommandDecorator = (command: commander.Command): void => {
  command
    .command("scaffold")
    .alias("s")
    .description("Create initial scaffolding for cluster deployment.")
    .option("-n, --name <name>", "Cluster name for scaffolding")
    .option(
      "-s, --source <cluster definition github repo>",
      "Source URL for the repository containing the terraform deployment"
    )
    .option(
      "-v, --version <repository version>",
      "Version or tag for the repository so a fixed version is referenced"
    )
    .option(
      "-t, --template <path to variables.tf> ",
      "Location of the variables.tf for the terraform deployment"
    )
    .option("--hcl", "Generates cluster definition HCL file")
    .action(async opts => {
      try {
        if (opts.name && opts.source && opts.version && opts.template) {
          logger.info("All required options are configured for scaffolding.");
        } else {
          logger.warn(
            "You must specify each of the variables 'name', 'source', 'version', 'template' in order to scaffold out a deployment."
          );
        }
        await copyTfTemplate(opts.template, opts.name);
        await validateVariablesTf(path.join(opts.template, "variables.tf"));
        await renameTfvars(opts.name);
        if (opts.hcl) {
          logger.info("Generating HCL cluster definition file.");
          await scaffoldHcl(
            opts.name,
            path.join(opts.template, "variables.tf")
          );
        } else {
          await scaffoldJson(
            opts.name,
            opts.source,
            opts.version,
            opts.template
          );
        }
      } catch (err) {
        logger.error("Error occurred while generating scaffold");
        logger.error(err);
      }
    });
};

/**
 * Checks if working variables.tf is present
 *
 * @param templatePath Path the variables.tf file
 */
export const validateVariablesTf = async (
  templatePath: string
): Promise<boolean> => {
  try {
    if (!fs.existsSync(templatePath)) {
      logger.error(
        `Provided Terraform variables.tf path is invalid or can not be found: ${templatePath}`
      );
      return false;
    }
    logger.info(
      `Terraform variables.tf file found. Attempting to generate definition JSON/HCL file...`
    );
  } catch (_) {
    logger.error(`Unable to validate Terraform variables.tf.`);
    return false;
  }
  return true;
};

/**
 * Rename any .tfvars file by appending ".backup"
 *
 * @param dir path to template directory
 */
export const renameTfvars = async (dir: string): Promise<void> => {
  try {
    const tfFiles = fs.readdirSync(dir);
    tfFiles.forEach(file => {
      if (file.indexOf(".tfvars") !== -1) {
        fs.renameSync(path.join(dir, file), path.join(dir, file + ".backup"));
      }
    });
  } catch (err) {
    logger.error(`Unable to rename .tfvars files.`);
    logger.error(err);
  }
};

/**
 * Copies the Terraform environment template
 *
 * @param templatePath path so the directory of Terraform templates
 * @param envName name of destination directory
 */
export const copyTfTemplate = async (
  templatePath: string,
  envName: string
): Promise<boolean> => {
  try {
    await fsextra.copy(templatePath, envName);
    logger.info(`Terraform template files copied.`);
  } catch (err) {
    logger.error(
      `Unable to find Terraform environment. Please check template path.`
    );
    logger.error(err);
    return false;
  }
  return true;
};

/**
 * Takes in the contents of a Terraform 'variables.tf' file and returns
 * an array of key:value pairs which are "variable name" and "default value"/
 * In the case where there is no default value, the entry is null.
 *
 * The variable.tf file has a format resembling:
 *
 * variable "foo" {
 * }
 *
 * variable "bar" {
 *     default = "1234"
 * }
 *
 * Thus, this function would return an array with two elements resembling:
 *
 * [ ["foo", null], ["bar", "1234"] ]
 *
 * @param {string} data string containing the contents of a variable.tf file
 */
export const parseVariablesTf = (data: string) => {
  // split the input on the keyword 'variable'
  const splitRegex = /^variable/gm;
  const blocks = data.split(splitRegex);
  // iterate through each 'block' and extract the variable name and any possible
  // default value.  if no default value found, null is used in it's place
  const fields: { [name: string]: string | "" } = {};
  const fieldSplitRegex = /\"\s{0,}\{/;
  const defaultRegex = /default\s{0,}=\s{0,}(.*)/;
  blocks.forEach((b, idx) => {
    b = b.trim();
    const elt = b.split(fieldSplitRegex);
    elt[0] = elt[0].trim().replace('"', "");
    if (elt[0].length > 0) {
      const match = elt[1].trim().match(defaultRegex);
      if (match) {
        let value = match[1];
        if (
          value.substr(0, 1) === '"' &&
          value.substr(value.length - 1, 1) === '"'
        ) {
          value = value.substr(1, value.length - 2);
        }
        fields[elt[0]] = value;
      } else {
        fields[elt[0]] = "";
      }
    }
  });
  return fields;
};

export const generateClusterDefinition = (
  name: string,
  source: string,
  template: string,
  version: string,
  vartfData: string
) => {
  const fields: { [name: string]: string | null } = parseVariablesTf(vartfData);
  const def: { [name: string]: string | null | any } = {
    name,
    source,
    template,
    version
  };
  if (Object.keys(fields).length > 0) {
    const fieldDict: { [name: string]: string | null } = {};
    Object.keys(fields).forEach(key => {
      fieldDict[key] = fields[key] ? fields[key] : "<insert value>";
    });
    def.variables = fieldDict;
  }
  return def;
};

/**
 * Given a Bedrock template, source URL, and version, this function creates a
 * primary base json definition for generating cluster definitions from.
 *
 * @param name Name of the cluster definition
 * @param bedrockSource The source repo for the bedrock definition
 * @param bedrockVersion The version of the repo used
 * @param tfVariableFile Path to the variable file to parse
 */
export const scaffoldJson = async (
  name: string,
  bedrockSource: string,
  bedrockVersion: string,
  template: string
): Promise<boolean> => {
  try {
    const tfVariableFile = path.join(name, "variables.tf");
    // Identify which environment the user selected
    if (fs.existsSync(tfVariableFile)) {
      logger.info(`variables.tf file found : ${tfVariableFile}`);
      const data: string = fs.readFileSync(tfVariableFile, "utf8");
      if (data) {
        const baseDef: {
          [name: string]: string | null | any;
        } = generateClusterDefinition(
          name,
          bedrockSource,
          template,
          bedrockVersion,
          data
        );
        if (baseDef) {
          fs.mkdir(name, (e: any) => {
            const confPath: string = path.format({
              base: "definition.json",
              dir: name,
              root: "/ignored"
            });
            fs.writeFileSync(confPath, JSON.stringify(baseDef, null, 2));
            return true;
          });
        } else {
          logger.error(`Unable to generate cluster definition.`);
        }
      } else {
        logger.error(`Unable to read variable file: ${tfVariableFile}.`);
      }
    }
  } catch (_) {
    logger.warn("Unable to create scaffold");
  }
  return false;
};

export const generateHclClusterDefinition = (vartfData: string) => {
  const data: string = fs.readFileSync(vartfData, "utf8");
  const fields: { [name: string]: string | "" | any } = parseVariablesTf(data);
  const def: { [name: string]: string | "" | any } = {};
  def.inputs = fields;
  return def;
};

/**
 * This function creates a primary base Terragrunt HCL definition for
 * generating cluster definitions from.
 *
 * @param name Name of the cluster definition
 * @param vartfData Path to the variable.tf file to parse
 */
export const scaffoldHcl = async (
  dirName: string,
  vartfData: string
): Promise<boolean> => {
  try {
    const def = generateHclClusterDefinition(vartfData);
    const confPath: string = path.format({
      base: "terragrunt.hcl",
      dir: dirName,
      root: "/ignored"
    });
    const hcl = JSON.stringify(def, null, 2)
      .replace(/\"([^(\")"]+)\":/g, "$1:")
      .replace(new RegExp(":", "g"), " =")
      .replace(new RegExp(",", "g"), " ")
      .replace("{", "")
      .replace(/\}([^}]*)$/, "$1")
      .replace(/(^[ \t]*\n)/gm, "")
      .trim();
    fs.writeFileSync(confPath, hcl);
  } catch (err) {
    logger.error("Failed to create HCL file.");
    logger.error(err);
    return false;
  }
  return true;
};
