import commander from "commander";
import fs from "fs";
import fsextra from "fs-extra";
import yaml from "js-yaml";
import path from "path";
import { Config } from "../../config";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { logger } from "../../logger";
import { IConfigYaml } from "../../types";
import { ISourceInformation, validateRemoteSource } from "./generate";
import * as infraCommon from "./infra_common";
import decorator from "./scaffold.decorator.json";

export const DEFINITION_YAML = "definition.yaml";
export const VARIABLES_TF = "variables.tf";
export const BACKEND_TFVARS = "backend.tfvars";

export interface ICommandOptions {
  name: string;
  source: string;
  template: string;
  version: string;
}

/**
 * Validates if the values that are passed in are good.
 *
 * @param config Configuration
 * @param opts Command Line options that are passed in
 */
export const validateValues = (config: IConfigYaml, opts: ICommandOptions) => {
  if (
    !config.azure_devops ||
    !config.azure_devops.access_token ||
    !config.azure_devops.infra_repository
  ) {
    logger.warn(`The infrastructure repository containing the remote terraform \
template repo and access token was not specified. Checking passed arguments.`);

    if (!opts.source) {
      // since access_token and infra_repository are missing, we cannot construct source for them
      throw new Error("Value for source is missing.");
    }
  }
  if (!opts.name || !opts.version || !opts.template) {
    throw new Error("Values for name, version and/or 'template are missing.");
  }
  logger.info(`All required options are configured via command line for \
scaffolding, expecting public remote repository for terraform templates \
or PAT embedded in source URL.`);
};

// Construct the source based on the the passed configurations of spk-config.yaml
export const constructSource = (config: IConfigYaml) => {
  const devops = config.azure_devops!;
  const source = `https://spk:${devops.access_token}@${devops.infra_repository}`;
  logger.info(
    `Infrastructure repository detected from initialized spk-config.yaml.`
  );
  return source;
};

export const execute = async (
  config: IConfigYaml,
  opts: ICommandOptions,
  exitFn: (status: number) => Promise<void>
) => {
  try {
    validateValues(config, opts);
    opts.source = opts.source || constructSource(config);

    /* scaffoldDefinition will take in a definition object with a
        null configuration. Hence, the first index is "" */
    const scaffoldDefinition: ISourceInformation = {
      source: opts.source,
      template: opts.template,
      version: opts.version
    };
    const sourceFolder = await infraCommon.repoCloneRegex(opts.source);
    const sourcePath = path.join(infraCommon.spkTemplatesPath, sourceFolder);
    await validateRemoteSource(scaffoldDefinition);
    await copyTfTemplate(
      path.join(sourcePath, opts.template),
      opts.name,
      false
    );
    validateVariablesTf(path.join(sourcePath, opts.template, "variables.tf"));
    await scaffold(opts);
    removeTemplateFiles(opts.name);
    await exitFn(0);
  } catch (err) {
    logger.error("Error occurred while generating scaffold");
    logger.error(err);
    await exitFn(1);
  }
};

/**
 * Adds the init command to the commander command object
 *
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: ICommandOptions) => {
    const config = Config();
    await execute(config, opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};

/**
 * Checks if working variables.tf is present
 *
 * @param templatePath Path to the variables.tf file
 */
export const validateVariablesTf = (templatePath: string) => {
  try {
    if (!fs.existsSync(templatePath)) {
      throw new Error(
        `Provided Terraform ${VARIABLES_TF} path is invalid or cannot be found: ${templatePath}`
      );
    }
    logger.info(
      `Terraform ${VARIABLES_TF} file found. Attempting to generate ${DEFINITION_YAML} file.`
    );
  } catch (_) {
    throw new Error(`Unable to validate Terraform ${VARIABLES_TF}.`);
  }
};

/**
 * Checks if backend.tfvars is present
 *
 * @param dir Path to the backend.tfvars file
 */
export const validateBackendTfvars = (dir: string): boolean => {
  const backendConfig = path.join(dir, BACKEND_TFVARS);

  if (fs.existsSync(backendConfig)) {
    logger.info(`A remote backend configuration was found : ${backendConfig}`);
    return true;
  }
  logger.info(`No remote backend configuration was found.`);
  return false;
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
) => {
  try {
    if (generation === true) {
      await fsextra.copy(templatePath, envName, {
        filter: file => {
          if (
            file.indexOf("terraform.tfvars") !== -1 ||
            file.indexOf(BACKEND_TFVARS) !== -1
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
    throw err;
  }
};

/**
 * Removes the Terraform environment template
 *
 * @param envPath path so the directory of Terraform templates
 */
export const removeTemplateFiles = (envPath: string) => {
  // Remove template files after parsing
  try {
    const files = fs.readdirSync(envPath);
    files
      .filter(f => f !== DEFINITION_YAML)
      .forEach(f => {
        fs.unlinkSync(path.join(envPath, f));
      });
  } catch (e) {
    logger.error(`cannot read ${envPath}`);
    // TOFIX: I guess we are ok with files not removed.
  }
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
export const parseVariablesTf = (data: string): { [key: string]: string } => {
  // split the input on the keyword 'variable'
  const splitRegex = /^variable/gm;
  const blocks = data.split(splitRegex);
  // iterate through each 'block' and extract the variable name and any possible
  // default value.  if no default value found, null is used in it's place
  const fields: { [key: string]: string } = {};
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
export const parseBackendTfvars = (
  backendData: string
): { [key: string]: string } => {
  const backend: { [key: string]: string | "" } = {};
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
 * @param values Values from command line
 * @param backendTfvars path to directory that contains backend.tfvars
 * @param vartfData path to the variables.tf file
 */
export const generateClusterDefinition = (
  values: ICommandOptions,
  backendData: string,
  vartfData: string
): { [key: string]: string | { [key: string]: string } } => {
  const fields = parseVariablesTf(vartfData);

  // map of string to string or map of string to string
  const def: { [key: string]: string | { [key: string]: string } } = {
    name: values.name,
    source: values.source,
    template: values.template,
    version: values.version
  };
  if (backendData !== "") {
    const backend = parseBackendTfvars(backendData);
    def.backend = backend;
  }
  if (Object.keys(fields).length > 0) {
    const fieldDict: { [key: string]: string } = {};
    Object.keys(fields).forEach(key => {
      fieldDict[key] = fields[key] || "<insert value>";
    });
    def.variables = fieldDict;
  }
  return def;
};

/**
 * Given a Bedrock template, source URL, and version, this function creates a
 * primary base definition for generating cluster definitions from.
 *
 * @param values Values from command line
 */
export const scaffold = async (values: ICommandOptions) => {
  try {
    const tfVariableFile = path.join(values.name, VARIABLES_TF);
    const backendTfvarsFile = path.join(values.name, BACKEND_TFVARS);

    const backendData = validateBackendTfvars(values.name)
      ? fs.readFileSync(backendTfvarsFile, "utf8")
      : "";

    // Identify which environment the user selected
    if (fs.existsSync(tfVariableFile)) {
      logger.info(`A ${VARIABLES_TF} file found : ${tfVariableFile}`);

      const data: string = fs.readFileSync(tfVariableFile, "utf8");

      if (data) {
        const baseDef = generateClusterDefinition(values, backendData, data);
        const definitionYaml = yaml.safeDump(baseDef);
        if (baseDef) {
          const confPath: string = path.format({
            base: DEFINITION_YAML,
            dir: values.name,
            root: "/ignored"
          });
          fs.writeFileSync(confPath, definitionYaml, "utf8");
        } else {
          logger.error(`Unable to generate cluster definition.`);
        }
      } else {
        logger.error(`Unable to read variable file: ${tfVariableFile}.`);
      }
    }
  } catch (err) {
    logger.warn("Unable to create scaffold");
    throw err;
  }
};
