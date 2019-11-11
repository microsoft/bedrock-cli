import commander from "commander";
import fs, { chmod } from "fs";
import mkdirp from "mkdirp";
import * as os from "os";
import path from "path";
import simpleGit from "simple-git/promise";
import { logger } from "../../logger";
import { copyTfTemplate } from "./scaffold";

const spkTemplatesPath = path.join(os.homedir(), ".spk/templates");
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
        const generatedDir = await createGenerated(opts.project);
        const templatePath = await parseDefinitionJson(opts.project);
        await copyTfTemplate(templatePath, generatedDir);
        await generateSpkTfvars(opts.project, generatedDir);
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
    mkdirp.sync(spkTemplatesPath);
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
 * Checks if working definition.json is present in the provided project path with validated source & version
 *
 * @param projectPath Path to the definition.json file
 */
export const validateTemplateSource = async (
  projectPath: string
): Promise<string[]> => {
  try {
    const definitionJSON = await readDefinitionJson(projectPath);
    // TO DO : Check for malformed JSON
    if (!(definitionJSON.template && definitionJSON.source)) {
      logger.info(
        `The definition.json file is invalid. There is a missing field for the definition file's sources. Template: ${definitionJSON.template} source: ${definitionJSON.source} version: ${definitionJSON.version}`
      );
      return [];
    }
    logger.info(
      `Checking for locally stored template: ${definitionJSON.template} from remote repository: ${definitionJSON.source} at version: ${definitionJSON.version}`
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
  const httpReg = /^(.*?)\.com/;
  const punctuationReg = /[^\w\s]/g;
  let sourceFolder = source.replace(httpReg, "");
  sourceFolder = sourceFolder.replace(punctuationReg, "_").toLowerCase();
  const sourcePath = path.join(spkTemplatesPath, sourceFolder);
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
      logger.info(`Remote source repo: ${source} exists.`);
      logger.info(
        `Checking if source repo: ${source} has been already cloned to: ${sourcePath}.`
      );
      // Check if .git folder exists in ${sourcePath}, if not, then clone
      // if already cloned, 'git pull'
      if (fs.existsSync(path.join(sourcePath, ".git"))) {
        await simpleGit(sourcePath).pull("origin", "master");
        logger.info(`${source} already cloned. Performing 'git pull'...`);
      } else {
        await git.clone(source, `${sourcePath}`);
        logger.info(`Cloning ${source} was successful.`);
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
export const createGenerated = async (projectPath: string): Promise<string> => {
  try {
    const newGeneratedPath = projectPath + "-generated";
    mkdirp.sync(newGeneratedPath);
    logger.info(`Created generated directory: ${newGeneratedPath}`);
    return newGeneratedPath;
  } catch (err) {
    logger.error(`There was a problem creating the generated directory`);
    return err;
  }
};

/**
 * Parses the definition.json file and copies the appropriate template
 * to "-generated" directory
 *
 * @param projectPath Path to the definition.json file
 * @param generatedPath Path to the generated directory
 */
export const parseDefinitionJson = async (projectPath: string) => {
  const definitionJSON = await readDefinitionJson(projectPath);
  const source = definitionJSON.source;
  const httpReg = /^(.*?)\.com/;
  const punctuationReg = /[^\w\s]/g;
  let sourceFolder = source.replace(httpReg, "");
  sourceFolder = sourceFolder.replace(punctuationReg, "_").toLowerCase();
  const templatePath = path.join(
    spkTemplatesPath,
    sourceFolder,
    definitionJSON.template
  );
  return templatePath;
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
 *
 */
export const generateSpkTfvars = async (
  projectPath: string,
  generatedPath: string
) => {
  try {
    // Remove existing spk.tfvars if it already exists
    if (fs.existsSync(path.join(generatedPath, "spk.tfvars"))) {
      fs.unlinkSync(path.join(generatedPath, "spk.tfvars"));
    }
    // Parse definition.json and extract "variables"
    const definitionJSON = await readDefinitionJson(projectPath);
    const variables = definitionJSON.variables;
    // Restructure the format of variables text
    const tfVariables = JSON.stringify(variables)
      .replace(/\:/g, "=")
      .replace(/\{|\}/g, "")
      .replace(/\,/g, "\n")
      .split("\n");
    // (re)Create spk.tfvars
    tfVariables.forEach(t => {
      const tfVar = t.split("=");
      if (tfVar[0].length > 0) {
        tfVar[0] = tfVar[0].replace(/\"/g, "");
      }
      const newTfVar = tfVar.join(" = ");
      fs.appendFileSync(
        path.join(generatedPath, "spk.tfvars"),
        newTfVar + "\n"
      );
    });
  } catch (err) {
    logger.error(err);
  }
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
