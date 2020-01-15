import commander from "commander";
import fs from "fs";
import fsextra from "fs-extra";
import yaml from "js-yaml";
import path from "path";
import { Config } from "../../config";
import { logger } from "../../logger";
import { validateRemoteSource } from "./generate";
import * as infraCommon from "./infra_common";

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
        const config = Config();
        if (
          !config.azure_devops ||
          !config.azure_devops.access_token ||
          !config.azure_devops.infra_repository
        ) {
          logger.warn(
            "The infrastructure repository containing the remote terraform template repo and access token was not specified. Checking passed arguments."
          );
          if (opts.name && opts.source && opts.version && opts.template) {
            logger.info(
              "All required options are configured via command line for scaffolding, expecting public remote repository for terraform templates or PAT embedded in source URL."
            );
          } else {
            logger.error(
              "You must specify each of the variables 'name', 'source', 'version', 'template' in order to scaffold out a deployment."
            );
          }
        } else {
          if (!opts.source) {
            // Construct the source based on the the passed configurations of spk-config.yaml
            opts.source =
              "https://spk:" +
              config.azure_devops.access_token +
              "@" +
              config.azure_devops.infra_repository;
            logger.info(
              `Infrastructure repository detected from initialized spk-config.yaml.`
            );
          }
        }
        /* scaffoldDefinition will take in a definition object with a
           null configuration. Hence, the first index is "" */
        const scaffoldDefinition = [
          "",
          opts.source,
          opts.template,
          opts.version
        ];
        const sourceFolder = await infraCommon.repoCloneRegex(opts.source);
        const sourcePath = path.join(
          infraCommon.spkTemplatesPath,
          sourceFolder
        );
        await validateRemoteSource(scaffoldDefinition);
        await copyTfTemplate(
          path.join(sourcePath, opts.template),
          opts.name,
          false
        );
        await validateVariablesTf(
          path.join(sourcePath, opts.template, "variables.tf")
        );
        await scaffold(opts.name, opts.source, opts.version, opts.template);
        await removeTemplateFiles(opts.name);
      } catch (err) {
        logger.error("Error occurred while generating scaffold");
        logger.error(err);
      }
    });
};

/**
 * Checks if working variables.tf is present
 *
 * @param templatePath Path to the variables.tf file
 */
export const validateVariablesTf = async (
  templatePath: string
): Promise<boolean> => {
  try {
    if (!fs.existsSync(templatePath)) {
      logger.error(
        `Provided Terraform variables.tf path is invalid or cannot be found: ${templatePath}`
      );
      return false;
    }
    logger.info(
      `Terraform variables.tf file found. Attempting to generate definition.yaml file.`
    );
  } catch (_) {
    logger.error(`Unable to validate Terraform variables.tf.`);
    return false;
  }
  return true;
};

/**
 * Checks if backend.tfvars is present
 *
 * @param dir Path to the backend.tfvars file
 */
export const validateBackendTfvars = async (name: string): Promise<boolean> => {
  const backendConfig = path.join(name, "backend.tfvars");
  logger.info(backendConfig);
  if (fs.existsSync(backendConfig)) {
    logger.info(`A remote backend configuration was found : ${backendConfig}`);
    return true;
  } else {
    logger.info(`No remote backend configuration was found.`);
    return false;
  }
};

/**
 * Renames any .tfvars file by appending ".backup"
 *
 * @param dir path to template directory
 */
export const renameTfvars = async (dir: string): Promise<void> => {
  try {
    const tfFiles = fs.readdirSync(dir);
    tfFiles.forEach(file => {
      if (file === "terraform.tfvars") {
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
  envName: string,
  generation: boolean
): Promise<boolean> => {
  try {
    if (generation === true) {
      await fsextra.copy(templatePath, envName, {
        filter: file => {
          if (
            file.indexOf("terraform.tfvars") !== -1 ||
            file.indexOf("backend.tfvars") !== -1
          ) {
            return false;
          }
          return true;
        }
      });
    } else {
      await fsextra.copy(templatePath, envName, {
        filter: file => {
          // return !(file.indexOf("terraform.tfvars") > -1);
          if (file.indexOf("terraform.tfvars") !== -1) {
            return false;
          }
          return true;
        }
      });
    }
    logger.info(`Terraform template files copied from ${templatePath}`);
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
 * Removes the Terraform environment template
 *
 * @param envPath path so the directory of Terraform templates
 */
export const removeTemplateFiles = async (envPath: string): Promise<void> => {
  // Remove template files after parsing
  fs.readdir(envPath, (err, files) => {
    if (err) {
      throw err;
    }
    for (const file of files) {
      if (file !== "definition.yaml") {
        fs.unlinkSync(path.join(envPath, file));
      }
    }
  });
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
  blocks.forEach(b => {
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

/**
 * Parses and reformats a backend object
 *
 * @param backendTfvarData path to the directory of backend.tfvars
 */
export const parseBackendTfvars = (backendData: string) => {
  const backend: { [name: string]: string | "" } = {};
  const block = backendData.replace(/\=/g, ":").split("\n");
  block.forEach(b => {
    const elt = b.split(":");
    if (elt[0].length > 0) {
      backend[elt[0]] = elt[1]
        .replace(/\"/g, "")
        .replace(/(?:\\[rn]|[\r\n]+)+/g, "");
    }
  });
  return backend;
};

/**
 * Generates cluster definition as definition object
 *
 * @param name name of destination directory
 * @param source git url of source repo
 * @param template name of Terraform environment
 * @param version a tag/branch/release of source repo
 * @param backendTfvars path to directory that contains backend.tfvars
 * @param vartfData path to the variables.tf file
 */
export const generateClusterDefinition = async (
  name: string,
  source: string,
  template: string,
  version: string,
  backendData: string,
  vartfData: string
) => {
  const fields: { [name: string]: string | null } = parseVariablesTf(vartfData);
  const def: { [name: string]: string | null | any } = {
    name,
    source,
    template,
    version
  };
  if (backendData !== "") {
    const backend = parseBackendTfvars(backendData);
    def.backend = backend;
  }
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
 * primary base definition for generating cluster definitions from.
 *
 * @param name Name of the cluster definition
 * @param bedrockSource The source repo for the bedrock definition
 * @param bedrockVersion The version of the repo used
 * @param tfVariableFile Path to the variable file to parse
 */
export const scaffold = async (
  name: string,
  bedrockSource: string,
  bedrockVersion: string,
  template: string
): Promise<boolean> => {
  try {
    const tfVariableFile = path.join(name, "variables.tf");
    const backendTfvarsFile = path.join(name, "backend.tfvars");
    const backendBool = await validateBackendTfvars(name);
    let backendData = "";
    if (backendBool === true) {
      backendData = fs.readFileSync(backendTfvarsFile, "utf8");
    }
    // Identify which environment the user selected
    if (fs.existsSync(tfVariableFile)) {
      logger.info(`A variables.tf file found : ${tfVariableFile}`);
      const data: string = fs.readFileSync(tfVariableFile, "utf8");
      if (data) {
        const baseDef: {
          [name: string]: string | null | any;
        } = await generateClusterDefinition(
          name,
          bedrockSource,
          template,
          bedrockVersion,
          backendData,
          data
        );
        const definitionYaml = yaml.safeDump(baseDef);
        if (baseDef) {
          fs.mkdir(name, (e: any) => {
            const confPath: string = path.format({
              base: "definition.yaml",
              dir: name,
              root: "/ignored"
            });
            fs.writeFileSync(confPath, definitionYaml, "utf8");
            return true;
          });
        } else {
          logger.error(`Unable to generate cluster definition.`);
        }
      } else {
        logger.error(`Unable to read variable file: ${tfVariableFile}.`);
      }
    }
  } catch (err) {
    logger.warn("Unable to create scaffold");
    logger.error(err);
  }
  return false;
};
