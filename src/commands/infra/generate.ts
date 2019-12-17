import commander from "commander";
import fs from "fs";
import mkdirp from "mkdirp";
import path from "path";
import process from "process";
import simpleGit from "simple-git/promise";
import { loadConfigurationFromLocalEnv, readYaml } from "../../config";
import { safeGitUrlForLogging } from "../../lib/gitutils";
import { logger } from "../../logger";
import { IInfraConfigYaml } from "../../types";
import * as infraCommon from "./infra_common";
import { copyTfTemplate } from "./scaffold";

const git = simpleGit();

/**
 * Adds the init command to the commander command object
 *
 * @param command Commander command object to decorate
 */
export const generateCommandDecorator = (command: commander.Command): void => {
  command
    .command("generate")
    .alias("g")
    .description("Generate scaffold for terraform cluster deployment.")
    .option(
      "-p, --project <path to project folder to generate> ",
      "Location of the definition.yaml file that will be generated"
    )
    .action(async opts => {
      try {
        if (opts.project) {
          logger.info(
            `spk will generate the following project: ${opts.project}`
          );
        } else {
          opts.project = process.cwd();
          logger.warn(
            `No project folder was provided, spk will generate the current folder as a project`
          );
        }
        await validateDefinition(opts.project);
        const yamlSource = await validateTemplateSource(
          path.join(opts.project, "definition.yaml")
        );
        await validateRemoteSource(yamlSource);
        await generateConfig(opts.project);
      } catch (err) {
        logger.error(
          "Error occurred while generating project deployment files"
        );
        logger.error(err);
      }
    });
};

/**
 * Checks if definition.yaml is present locally to provided project path
 *
 * @param projectPath Path to the definition.yaml file
 */
export const validateDefinition = async (
  projectPath: string
): Promise<boolean> => {
  try {
    // If templates folder does not exist, create cache templates directory
    mkdirp.sync(infraCommon.spkTemplatesPath);
    if (!fs.existsSync(path.join(projectPath, "definition.yaml"))) {
      logger.error(
        `Provided project path for generate is invalid or definition.yaml cannot be found: ${projectPath}`
      );
      return false;
    }
    logger.info(
      `Project folder found. Extracting information from definition.yaml files.`
    );
  } catch (err) {
    logger.error(`Unable to validate project folder path: ${err}`);
    return false;
  }
  return true;
};

/**
 * Checks if working definition.yaml is present in the provided
 * project path with validated source & version
 *
 * @param projectPath Path to the definition.yaml file
 */
export const validateTemplateSource = async (
  projectPath: string
): Promise<string[]> => {
  try {
    const data = readYaml<IInfraConfigYaml>(projectPath);
    const infraConfig = loadConfigurationFromLocalEnv(data || {});
    const safeLoggingUrl = safeGitUrlForLogging(infraConfig.source);
    // TO DO : Check for malformed JSON
    if (!(infraConfig.template && infraConfig.source)) {
      logger.info(
        `The definition.yaml file is invalid. There is a missing field for the definition file's sources. Template: ${infraConfig.template} source: ${safeLoggingUrl} version: ${infraConfig.version}`
      );
      return [];
    }
    logger.info(
      `Checking for locally stored template: ${infraConfig.template} from remote repository: ${safeLoggingUrl} at version: ${infraConfig.version}`
    );
    const sources = [
      infraConfig.source,
      infraConfig.template,
      infraConfig.version
    ];
    return sources;
  } catch (_) {
    logger.error(
      `Unable to validate project folder definition.yaml file. Is it malformed?`
    );
    return [];
  }
};

/**
 * Checks if provided source, template and version are valid. TODO/ Private Repo, PAT, ssh-key agent
 *
 * @param projectPath Path to the definition.yaml file
 */
export const validateRemoteSource = async (
  definitionJSON: string[]
): Promise<boolean> => {
  const [source, template, version] = definitionJSON;
  // Converting source name to storable folder name
  const sourceFolder = await infraCommon.repoCloneRegex(source);
  const sourcePath = path.join(infraCommon.spkTemplatesPath, sourceFolder);
  const safeLoggingUrl = safeGitUrlForLogging(source);
  logger.warn(`Converted to: ${sourceFolder}`);
  logger.info(`Checking if source: ${sourcePath} is stored locally.`);
  try {
    if (!fs.existsSync(sourcePath)) {
      logger.warn(
        `Provided source in template directory was not found, attempting to clone the template source repo locally.`
      );
      mkdirp.sync(sourcePath);
    } else {
      logger.info(
        `Source template folder found. Validating existence of repository.`
      );
    }
    // Checking for git remote
    const result = await simpleGit(sourcePath).listRemote([source]);
    if (!result) {
      logger.error(
        `Unable to clone the source remote repository. Does the remote repo exist? Do you have the rights to access it? ${result}`
      );
      return false;
    } else {
      logger.info(`Remote source repo: ${safeLoggingUrl} exists.`);
      logger.info(
        `Checking if source repo: ${safeLoggingUrl} has been already cloned to: ${sourcePath}.`
      );
      // Check if .git folder exists in ${sourcePath}, if not, then clone
      // if already cloned, 'git pull'
      if (fs.existsSync(path.join(sourcePath, ".git"))) {
        // Make sure we have the latest version of all releases cached locally
        await simpleGit(sourcePath).fetch("all");
        await simpleGit(sourcePath).pull("origin", "master");
        logger.info(
          `${safeLoggingUrl} already cloned. Performing 'git pull'...`
        );
      } else {
        await git.clone(source, `${sourcePath}`);
        logger.info(`Cloning ${safeLoggingUrl} was successful.`);
      }
      // Checkout tagged version
      logger.info(`Checking out template version: ${version}`);
      await simpleGit(sourcePath).checkout(version);
    }
  } catch (err) {
    logger.error(
      `There was an error checking the remote source repository: ${err}`
    );
    return false;
  }
  return true;
};

/**
 * Creates "generated" directory if it does not already exists
 *
 * @param projectPath Path to the definition.yaml file
 */
export const generateConfig = async (projectPath: string): Promise<void> => {
  try {
    // First, search for definition.yaml in current working directory
    const templatePath = await parseDefinitionYaml(projectPath);
    const cwdPath = process.cwd();

    // If there exists a definition.yaml, then read file
    // const parentDefinitionJSON = await readDefinitionJson(cwdPath);
    // const leafDefinitionJSON = await readDefinitionJson(projectPath);

    const parentData = readYaml<IInfraConfigYaml>(
      path.join(cwdPath, "definition.yaml")
    );
    const parentInfraConfig = loadConfigurationFromLocalEnv(parentData || {});
    const leafData = readYaml<IInfraConfigYaml>(
      path.join(projectPath, "definition.yaml")
    );
    const leafInfraConfig = loadConfigurationFromLocalEnv(leafData || {});
    /* Iterate through parent and leaf JSON objects to find matches
      If there is a match, then replace parent key-value
      If there is no match between the parent and leaf,
      then append leaf key-value parent key-value JSON */
    // Create a generated parent directory
    const parentDirectory = cwdPath + "-generated";
    const childDirectory = path.join(parentDirectory, projectPath);
    if (projectPath === cwdPath) {
      await createGenerated(parentDirectory);
      if (parentInfraConfig.variables) {
        const spkTfvarsObject = await generateTfvars(
          parentInfraConfig.variables
        );
        await checkTfvars(parentDirectory, "spk.tfvars");
        await writeTfvarsFile(spkTfvarsObject, parentDirectory, "spk.tfvars");
        await copyTfTemplate(templatePath, parentDirectory, true);
      } else {
        logger.warning(`Variables are not defined in the definition.yaml`);
      }
      if (parentInfraConfig.backend) {
        const backendTfvarsObject = await generateTfvars(
          parentInfraConfig.backend
        );
        await checkTfvars(parentDirectory, "backend.tfvars");
        await writeTfvarsFile(
          backendTfvarsObject,
          parentDirectory,
          "backend.tfvars"
        );
      } else {
        logger.warning(
          `A remote backend configuration is not defined in the definition.yaml`
        );
      }
    } else {
      await createGenerated(parentDirectory);
      // Then, create generated child directory
      await createGenerated(childDirectory);
    }
    if (typeof parentInfraConfig !== "undefined") {
      if (leafInfraConfig) {
        const finalDefinition = await dirIteration(
          parentInfraConfig.variables,
          leafInfraConfig.variables
        );
        // Generate Terraform files in generated directory
        const combinedSpkTfvarsObject = await generateTfvars(finalDefinition);
        // Write variables to  `spk.tfvars` file
        await checkTfvars(childDirectory, "spk.tfvars");
        await writeTfvarsFile(
          combinedSpkTfvarsObject,
          childDirectory,
          "spk.tfvars"
        );

        // Create a backend.tfvars for remote backend configuration
        if (parentInfraConfig.backend && leafInfraConfig.backend) {
          const finalBackendDefinition = await dirIteration(
            parentInfraConfig.backend,
            leafInfraConfig.backend
          );
          const backendTfvarsObject = await generateTfvars(
            finalBackendDefinition
          );
          await checkTfvars(childDirectory, "backend.tfvars");
          await writeTfvarsFile(
            backendTfvarsObject,
            childDirectory,
            "backend.tfvars"
          );
        }
      }
    } else {
      if (leafInfraConfig.variables) {
        // If there is not a variables block in the parent or root definition.yaml
        // Then assume the variables are taken from leaf definitions
        const spkTfvarsObject = await generateTfvars(leafInfraConfig.variables);
        // Write variables to  `spk.tfvars` file
        await checkTfvars(childDirectory, "spk.tfvars");
        await writeTfvarsFile(spkTfvarsObject, childDirectory, "spk.tfvars");
        await copyTfTemplate(templatePath, childDirectory, true);
      } else {
        logger.warning(`Variables are not defined in the definition.yaml`);
      }
      // If there is no backend block specified in the parent definition.yaml,
      // then create a backend based on the leaf definition.yaml
      if (leafInfraConfig.backend) {
        const backendTfvarsObject = await generateTfvars(
          leafInfraConfig.backend
        );
        await checkTfvars(childDirectory, "backend.tfvars");
        await writeTfvarsFile(
          backendTfvarsObject,
          childDirectory,
          "backend.tfvars"
        );
      } else {
        logger.warning(
          `A remote backend configuration is not defined in the definition.yaml`
        );
      }
    }
    await copyTfTemplate(templatePath, childDirectory, true);
  } catch (err) {
    return err;
  }
};

export const dirIteration = async (
  parentObject: any,
  leafObject: any
): Promise<string[]> => {
  for (const parentKey in parentObject) {
    if (parentKey) {
      for (const leafKey in leafObject) {
        if (parentKey === leafKey) {
          let parentVal = parentObject[parentKey];
          parentVal = leafObject[leafKey];
        } else {
          // Append to parent variables block
          const leafVal = leafObject[leafKey];
          parentObject[leafKey] = leafVal;
        }
      }
    }
  }
  return parentObject;
};

/**
 * Creates "generated" directory if it does not already exists
 *
 * @param projectPath Path to the definition.yaml file
 */
export const createGenerated = async (projectPath: string): Promise<string> => {
  try {
    mkdirp.sync(projectPath);
    logger.info(`Created generated directory: ${projectPath}`);
    return projectPath;
  } catch (err) {
    logger.error(`There was a problem creating the generated directory`);
    return err;
  }
};

/**
 * Parses the definition.yaml file and returns the appropriate template path
 *
 * @param projectPath Path to the definition.yaml file
 * @param generatedPath Path to the generated directory
 */
export const parseDefinitionYaml = async (projectPath: string) => {
  const data = readYaml<IInfraConfigYaml>(
    path.join(projectPath, `definition.yaml`)
  );
  const infraConfig = loadConfigurationFromLocalEnv(data || {});
  const source = infraConfig.source;
  const sourceFolder = await infraCommon.repoCloneRegex(source);
  const templatePath = path.join(
    infraCommon.spkTemplatesPath,
    sourceFolder,
    infraConfig.template
  );
  return templatePath;
};

/**
 * Checks if an spk.tfvars already exists
 *
 * @param projectPath Path to the spk.tfvars file
 */
export const checkTfvars = async (
  generatedPath: string,
  tfvarsFilename: string
): Promise<void> => {
  try {
    // Remove existing spk.tfvars if it already exists
    if (fs.existsSync(path.join(generatedPath, tfvarsFilename))) {
      fs.unlinkSync(path.join(generatedPath, tfvarsFilename));
    }
  } catch (err) {
    return err;
  }
};

export const generateBackendTfvars = async (definitionJSON: string[]) => {
  try {
    const backendTfvars: string[] = [];
    const backendConfig = definitionJSON;
  } catch (err) {
    logger.error(err);
  }
};

/**
 *
 * Takes in the "variables" block from definitio.yaml file and returns
 * a spk.tfvars file.
 *
 * @param projectPath Path to the definition.yaml file
 * @param generatedPath Path to the generated directory
 *
 * Regex will replace ":" with "=", and remove double quotes around
 * each key to resemble:
 *
 * key = "value"
 *
 */
export const generateTfvars = async (definition: any) => {
  try {
    const tfVars: string[] = [];
    // Parse definition.yaml "variables" block
    const variables = definition;
    // Restructure the format of variables text
    const tfVariables = JSON.stringify(variables)
      .replace(/\{|\}/g, "")
      .replace(/\,/g, "\n")
      .split("\n");
    // (re)Create spk.tfvars
    tfVariables.forEach(t => {
      const tfVar = t.split(":");
      const result = tfVar.slice(0, 1);
      result.push(tfVar.slice(1).join(":"));
      if (result[0].length > 0) {
        result[0] = result[0].replace(/\"/g, "");
      }
      const newTfVar = result.join(" = ");
      tfVars.push(newTfVar);
    });
    return tfVars;
  } catch (err) {
    logger.error(`There was an error with generating the spk tfvars object.`);
    return err;
  }
};

/**
 * Reads in a tfVars object and returns a spk.tfvars file
 *
 * @param spkTfVars spk tfvars object in an array
 * @param generatedPath Path to write the spk.tfvars file to
 */
export const writeTfvarsFile = async (
  spkTfVars: string[],
  generatedPath: string,
  tfvarsFilename: string
) => {
  spkTfVars.forEach(tfvar => {
    fs.appendFileSync(path.join(generatedPath, tfvarsFilename), tfvar + "\n");
  });
};

/**
 * Reads a definition.yaml and returns a JSON object
 *
 * @param projectPath Path to the definition.yaml file
 */
/* export const readDefinitionJson = async (projectPath: string) => {
  const rootDef = path.join(projectPath, "definition.yaml");
  const data: string = fs.readFileSync(rootDef, "utf8");
  const definitionJSON = JSON.parse(data);
  return definitionJSON;
};*/
