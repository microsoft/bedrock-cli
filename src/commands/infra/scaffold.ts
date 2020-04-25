import commander from "commander";
import fs from "fs";
import fsextra from "fs-extra";
import yaml from "js-yaml";
import path from "path";
import { Config } from "../../config";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { logger } from "../../logger";
import { ConfigYaml } from "../../types";
import { SourceInformation, validateRemoteSource } from "./generate";
import {
  BACKEND_TFVARS,
  DEFAULT_VAR_VALUE,
  DEFINITION_YAML,
  getSourceFolderNameFromURL,
  bedrockTemplatesPath,
  TERRAFORM_TFVARS,
  VARIABLES_TF,
} from "./infra_common";
import decorator from "./scaffold.decorator.json";
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";

export interface CommandOptions {
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
export const validateValues = (
  config: ConfigYaml,
  opts: CommandOptions
): void => {
  if (
    !config.azure_devops ||
    !config.azure_devops.access_token ||
    !config.azure_devops.infra_repository
  ) {
    logger.info(`The infrastructure repository containing the remote terraform \
template repo and access token was not specified in bedrock-config.yml. Checking passed arguments.`);

    if (!opts.source) {
      // since access_token and infra_repository are missing, we cannot construct source for them
      throw buildError(
        errorStatusCode.VALIDATION_ERR,
        "infra-scaffold-cmd-src-missing"
      );
    }
  }
  if (!opts.name || !opts.version || !opts.template) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "infra-scaffold-cmd-values-missing"
    );
  }
  logger.info(`All required options are configured via command line for \
scaffolding, expecting public remote repository for terraform templates \
or PAT embedded in source URL.`);
};

// Construct the source based on the the passed configurations of bedrock-config.yaml
export const constructSource = (config: ConfigYaml): string => {
  // config.azure_devops exists because validateValues function checks it
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const devops = config.azure_devops!;
  const source = `https://bedrock:${devops.access_token}@${devops.infra_repository}`;
  logger.info(
    `Infrastructure repository detected from initialized bedrock-config.yaml.`
  );
  return source;
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
): Promise<void> => {
  try {
    if (generation === true) {
      await fsextra.copy(templatePath, envName, {
        filter: (file) =>
          file.indexOf(TERRAFORM_TFVARS) === -1 &&
          file.indexOf(BACKEND_TFVARS) === -1,
      });
    } else {
      await fsextra.copy(templatePath, envName, {
        filter: (file) => file.indexOf(TERRAFORM_TFVARS) === -1,
      });
    }
    logger.info(`Terraform template files copied from ${templatePath}`);
  } catch (err) {
    throw buildError(
      errorStatusCode.ENV_SETTING_ERR,
      {
        errorKey: "infra-err-locate-tf-env",
        values: [templatePath],
      },
      err
    );
  }
};

/**
 * Checks if working variables.tf is present
 *
 * @param templatePath Path to the variables.tf file
 */
export const validateVariablesTf = (templatePath: string): void => {
  if (!fs.existsSync(templatePath)) {
    throw buildError(errorStatusCode.ENV_SETTING_ERR, {
      errorKey: "infra-err-tf-path-not-found",
      values: [VARIABLES_TF, templatePath],
    });
  }
  logger.info(
    `Terraform ${VARIABLES_TF} file found. Attempting to generate ${DEFINITION_YAML} file.`
  );
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
  const fieldSplitRegex = /"\s{0,}\{/;
  const defaultRegex = /default\s{0,}=\s{0,}(.*)/;
  blocks.forEach((b) => {
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
  const block = backendData.replace(/=/g, ":").split("\n");
  block.forEach((b) => {
    const elt = b.split(":");
    if (elt[0].length > 0) {
      backend[elt[0]] = elt[1]
        .replace(/"/g, "")
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
  values: CommandOptions,
  backendData: string,
  vartfData: string
): { [key: string]: string | { [key: string]: string } } => {
  const fields = parseVariablesTf(vartfData);
  const defaultVariables: string[] = [];
  // map of string to string or map of string to string
  const def: { [key: string]: string | { [key: string]: string } } = {
    name: values.name,
    source: values.source,
    template: values.template,
    version: values.version,
  };
  if (backendData !== "") {
    const backend = parseBackendTfvars(backendData);
    def.backend = backend;
  }
  if (Object.keys(fields).length > 0) {
    const fieldDict: { [key: string]: string } = {};
    Object.keys(fields).forEach((key) => {
      fieldDict[key] = fields[key] || DEFAULT_VAR_VALUE;
    });
    // If the value contains a default value, exclude from fieldDict
    Object.keys(fieldDict).forEach((key) => {
      if (fieldDict[key] !== DEFAULT_VAR_VALUE) {
        delete fieldDict[key];
        defaultVariables.push(key);
      }
    });
    def.variables = fieldDict;

    if (defaultVariables.length > 0) {
      logger.info(
        `Default values will be used for these variables:\n${defaultVariables.join(
          "\n"
        )}. \nCustom values can be set for these variables in the definition.yaml file.`
      );
    }
  }
  return def;
};

/**
 * Given a Bedrock template, source URL, and version, this function creates a
 * primary base definition for generating cluster definitions from.
 *
 * @param values Values from command line
 */
export const scaffold = (values: CommandOptions): void => {
  try {
    const tfVariableFile = path.join(values.name, VARIABLES_TF);
    const backendTfvarsFile = path.join(values.name, BACKEND_TFVARS);

    const backendData = validateBackendTfvars(values.name)
      ? fs.readFileSync(backendTfvarsFile, "utf8")
      : "";

    // Identify which environment the user selected
    if (fs.existsSync(tfVariableFile)) {
      logger.info(`A ${VARIABLES_TF} file found : ${tfVariableFile}`);

      const data = fs.readFileSync(tfVariableFile, "utf8");

      if (data) {
        const baseDef = generateClusterDefinition(values, backendData, data);
        // baseDef shall be always defined based on what generateClusterDefinition
        // function returns. hence we do not need to check if it is defined or not
        const definitionYaml = yaml.safeDump(baseDef);
        const confPath: string = path.format({
          base: DEFINITION_YAML,
          dir: values.name,
          root: "/ignored",
        });
        fs.writeFileSync(confPath, definitionYaml, "utf8");
      } else {
        throw buildError(errorStatusCode.ENV_SETTING_ERR, {
          errorKey: "infra-unable-read-var-file",
          values: [tfVariableFile],
        });
      }
    }
  } catch (err) {
    throw buildError(
      errorStatusCode.EXE_FLOW_ERR,
      "infra-err-create-scaffold",
      err
    );
  }
};

/**
 * Removes the Terraform environment template
 *
 * @param envPath path so the directory of Terraform templates
 */
export const removeTemplateFiles = (envPath: string): void => {
  // Remove template files after parsing
  try {
    const files = fs.readdirSync(envPath);
    files
      .filter((f) => f !== DEFINITION_YAML)
      .forEach((f) => {
        fs.unlinkSync(path.join(envPath, f));
      });
  } catch (e) {
    logger.warn(`cannot read ${envPath}`);
    // TOFIX: I guess we are ok with files not removed.
  }
};

export const execute = async (
  config: ConfigYaml,
  opts: CommandOptions,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  try {
    validateValues(config, opts);
    opts.source = opts.source || constructSource(config);

    /* scaffoldDefinition will take in a definition object with a
        null configuration. Hence, the first index is "" */
    const scaffoldDefinition: SourceInformation = {
      source: opts.source,
      template: opts.template,
      version: opts.version,
    };
    const sourceFolder = getSourceFolderNameFromURL(opts.source);
    const sourcePath = path.join(bedrockTemplatesPath, sourceFolder);
    await validateRemoteSource(scaffoldDefinition);
    await copyTfTemplate(
      path.join(sourcePath, opts.template),
      opts.name,
      false
    );
    validateVariablesTf(path.join(sourcePath, opts.template, VARIABLES_TF));
    scaffold(opts);
    removeTemplateFiles(opts.name);
    await exitFn(0);
  } catch (err) {
    logError(
      buildError(errorStatusCode.CMD_EXE_ERR, "infra-scaffold-cmd-failed", err)
    );
    await exitFn(1);
  }
};

/**
 * Adds the init command to the commander command object
 *
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: CommandOptions) => {
    const config = Config();
    await execute(config, opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
