import commander from "commander";
import fs, { chmod } from "fs";
import mkdirp from "mkdirp";
import * as os from "os";
import path from "path";
import simpleGit from "simple-git/promise";
import {
  getCurrentBranch,
  getOriginUrl,
  safeGitUrlForLogging
} from "../../lib/gitutils";
import { logger } from "../../logger";
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
      "Location of the definition.json file that will be generated"
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
        const jsonSource = await validateTemplateSource(opts.project);
        await validateRemoteSource(jsonSource);
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
 * Checks if definition.json is present locally to provided project path
 *
 * @param projectPath Path to the definition.json file
 */
export const validateDefinition = async (
  projectPath: string
): Promise<boolean> => {
  try {
    // If templates folder does not exist, create cache templates directory
    mkdirp.sync(infraCommon.spkTemplatesPath);
    if (!fs.existsSync(path.join(projectPath, "definition.json"))) {
      logger.error(
        `Provided project path for generate is invalid or definition.json cannot be found: ${projectPath}`
      );
      return false;
    }
    logger.info(
      `Project folder found. Extracting information from definition.json files.`
    );
  } catch (err) {
    logger.error(`Unable to validate project folder path: ${err}`);
    return false;
  }
  return true;
};

/**
 * Checks if working definition.json is present in the provided
 * project path with validated source & version
 *
 * @param projectPath Path to the definition.json file
 */
export const validateTemplateSource = async (
  projectPath: string
): Promise<string[]> => {
  try {
    const definitionJSON = await readDefinitionJson(projectPath);
    const safeLoggingUrl = safeGitUrlForLogging(definitionJSON.source);
    // TO DO : Check for malformed JSON
    if (!(definitionJSON.template && definitionJSON.source)) {
      logger.info(
        `The definition.json file is invalid. There is a missing field for the definition file's sources. Template: ${definitionJSON.template} source: ${safeLoggingUrl} version: ${definitionJSON.version}`
      );
      return [];
    }
    logger.info(
      `Checking for locally stored template: ${definitionJSON.template} from remote repository: ${safeLoggingUrl} at version: ${definitionJSON.version}`
    );
    const sources = [
      definitionJSON.source,
      definitionJSON.template,
      definitionJSON.version
    ];
    return sources;
  } catch (_) {
    logger.error(
      `Unable to validate project folder definition.json file. Is it malformed?`
    );
    return [];
  }
};

/**
 * Checks if provided source, template and version are valid. TODO/ Private Repo, PAT, ssh-key agent
 *
 * @param projectPath Path to the definition.json file
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
 * @param projectPath Path to the definition.json file
 */
export const generateConfig = async (projectPath: string): Promise<void> => {
  try {
    // First, search for definition.json in current working directory
    const templatePath = await parseDefinitionJson(projectPath);
    const cwdPath = process.cwd();
    if (fs.existsSync(path.join(cwdPath, "definition.json"))) {
      // If there exists a definition.json, then read file
      logger.info(`A definition.json was found in the parent directory.`);
      const parentDefinitionJSON = await readDefinitionJson(cwdPath);
      const leafDefinitionJSON = await readDefinitionJson(projectPath);
      /* Iterate through parent and leaf JSON objects to find matches
        If there is a match, then replace parent key-value
        If there is no match between the parent and leaf,
        then append leaf key-value parent key-value JSON */
      for (const parentKey in parentDefinitionJSON.variables) {
        if (parentKey) {
          for (const leafKey in leafDefinitionJSON.variables) {
            if (parentKey === leafKey) {
              let parentVal = parentDefinitionJSON.variables[parentKey];
              parentVal = leafDefinitionJSON.variables[leafKey];
            } else {
              // Append to parent variables block
              const leafVal = leafDefinitionJSON.variables[leafKey];
              parentDefinitionJSON.variables[leafKey] = leafVal;
            }
          }
        }
      }
      // Create a generated parent directory
      const parentDirectory = await createGenerated(cwdPath + "-generated");
      // Then, create generated child directory
      const childDirectory = await createGenerated(
        path.join(parentDirectory, projectPath)
      );
      // Generate Terraform files in generated directory
      const spkTfvarsObject = await generateSpkTfvars(
        parentDefinitionJSON.variables
      );
      await checkSpkTfvars(childDirectory);
      await writeToSpkTfvarsFile(spkTfvarsObject, childDirectory);
      // const templatePath = await parseDefinitionJson(projectPath);
      await copyTfTemplate(templatePath, childDirectory);
    } else {
      // If there is not a definition.json in current working directory,
      // then proceed with reading definition.json in project path
      // await createGenerated(projectPath)
      // logger.info(`A definition.json was not found in the parent directory.`)
      const definitionJSON = await readDefinitionJson(projectPath);
      // Create a generated directory
      const generatedDirectory = await createGenerated(
        projectPath + "-generated"
      );
      // Generate Terraform files in generated directory
      const spkTfvarsObject = await generateSpkTfvars(definitionJSON.variables);
      await checkSpkTfvars(generatedDirectory);
      await writeToSpkTfvarsFile(spkTfvarsObject, generatedDirectory);
      await copyTfTemplate(templatePath, generatedDirectory);
    }
  } catch (err) {
    return err;
  }
};

/**
 * Creates "generated" directory if it does not already exists
 *
 * @param projectPath Path to the definition.json file
 */
export const createGenerated = async (projectPath: string): Promise<string> => {
  try {
    const newGeneratedPath = projectPath;
    mkdirp.sync(newGeneratedPath);
    logger.info(`Created generated directory: ${newGeneratedPath}`);
    return newGeneratedPath;
  } catch (err) {
    logger.error(`There was a problem creating the generated directory`);
    return err;
  }
};

/**
 * Parses the definition.json file and returns the appropriate template path
 *
 * @param projectPath Path to the definition.json file
 * @param generatedPath Path to the generated directory
 */
export const parseDefinitionJson = async (projectPath: string) => {
  const definitionJSON = await readDefinitionJson(projectPath);
  const source = definitionJSON.source;
  const sourceFolder = await infraCommon.repoCloneRegex(source);
  const templatePath = path.join(
    infraCommon.spkTemplatesPath,
    sourceFolder,
    definitionJSON.template
  );
  return templatePath;
};

/**
 * Checks if an spk.tfvars
 *
 * @param projectPath Path to the spk.tfvars file
 */
export const checkSpkTfvars = async (generatedPath: string): Promise<void> => {
  try {
    // Remove existing spk.tfvars if it already exists
    if (fs.existsSync(path.join(generatedPath, "spk.tfvars"))) {
      fs.unlinkSync(path.join(generatedPath, "spk.tfvars"));
    }
  } catch (err) {
    return err;
  }
};

/**
 *
 * Takes in the "variables" block from definition.json file and returns
 * a spk.tfvars file.
 *
 * @param projectPath Path to the definition.json file
 * @param generatedPath Path to the generated directory
 *
 * Regex will replace ":" with "=", and remove double quotes around
 * each key to resemble:
 *
 * key = "value"
 *
 */
export const generateSpkTfvars = async (definitionJSON: string[]) => {
  try {
    const tfVars: string[] = [];
    // Parse definition.json "variables" block
    const variables = definitionJSON;
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
export const writeToSpkTfvarsFile = async (
  spkTfVars: string[],
  generatedPath: string
) => {
  spkTfVars.forEach(tfvar => {
    fs.appendFileSync(path.join(generatedPath, "spk.tfvars"), tfvar + "\n");
  });
};

/**
 * Reads a definition.json and returns a JSON object
 *
 * @param projectPath Path to the definition.json file
 */
export const readDefinitionJson = async (projectPath: string) => {
  const rootDef = path.join(projectPath, "definition.json");
  const data: string = fs.readFileSync(rootDef, "utf8");
  const definitionJSON = JSON.parse(data);
  return definitionJSON;
};
