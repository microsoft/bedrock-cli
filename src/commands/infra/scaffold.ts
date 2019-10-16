import commander from "commander";
import fs, { chmod } from "fs";
import path from "path";
import { promisify } from "util";
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
    .action(async opts => {
      try {
        if (opts.name && opts.source && opts.template) {
          logger.info("All required options are configured for scaffolding.");
        } else {
          logger.warn(
            "You must specify each of the variables 'name', 'source', 'version', 'template' in order to scaffold out a deployment."
          );
        }
        await validateVariablesTf(opts.template);
        await scaffoldInit(opts.name, opts.source, opts.version, opts.template);
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
  } catch (_) {
    logger.error(`Unable to Validate Infra Init.`);
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
  const fields: { [name: string]: string | null } = {};
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
        fields[elt[0]] = null;
      }
    }
  });
  return fields;
};

export const generateClusterDefinition = (
  name: string,
  source: string,
  version: string,
  vartfData: string
) => {
  const fields: { [name: string]: string | null } = parseVariablesTf(vartfData);
  const def: { [name: string]: string | null | any } = {
    name,
    source,
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
export const scaffoldInit = async (
  name: string,
  bedrockSource: string,
  bedrockVersion: string,
  tfVariableFile: string
): Promise<boolean> => {
  try {
    // Identify which environment the user selected
    if (fs.existsSync(tfVariableFile)) {
      logger.info(`variable.tf file found : ${tfVariableFile}`);
      const data: string = fs.readFileSync(tfVariableFile, "utf8");
      if (data) {
        const baseDef: {
          [name: string]: string | null | any;
        } = generateClusterDefinition(
          name,
          bedrockSource,
          bedrockVersion,
          data
        );
        if (baseDef) {
          fs.mkdir(name, (e: any) => {
            if (e) {
              logger.error(`Unable to create directory: ${name}`);
              return false;
            } else {
              const confPath: string = path.format({
                base: "definition.json",
                dir: name,
                root: "/ignored"
              });
              fs.writeFileSync(confPath, JSON.stringify(baseDef, null, 2));
              return true;
            }
          });
        } else {
          logger.error("Unable to generate cluster definition");
        }
      } else {
        logger.error(`Unable to read variable file: ${tfVariableFile}`);
      }
    }
  } catch (_) {
    logger.warn("Unable to create scaffold");
  }
  return false;
};
