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
        const sourceConfiguration = await validateDefinition(
          process.cwd(),
          opts.project
        );
        const sourceConfig = await validateTemplateSources(
          sourceConfiguration,
          path.join(process.cwd(), `definition.yaml`),
          path.join(opts.project, `definition.yaml`)
        );
        await validateRemoteSource(sourceConfig);
        await generateConfig(process.cwd(), opts.project, sourceConfig);
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
 *  @param parentPath Path to the parent definition.yaml file
 *  @param projectPath Path to the leaf definition.yaml file
 */
export const validateDefinition = async (
  parentPath: string,
  projectPath: string
): Promise<string> => {
  try {
    // If templates folder does not exist, create cache templates directory
    mkdirp.sync(infraCommon.spkTemplatesPath);
    // Check for parent definition.yaml and child definition.yaml
    if (
      fs.existsSync(path.join(parentPath, "definition.yaml")) &&
      fs.existsSync(path.join(projectPath, "definition.yaml"))
    ) {
      logger.warn(
        `A definition.yaml was found in: ${parentPath}, and was found in ${projectPath}`
      );
      return "A";
    } else if (
      fs.existsSync(path.join(parentPath, "definition.yaml")) &&
      !fs.existsSync(path.join(projectPath, "definition.yaml"))
    ) {
      logger.warn(
        `A definition.yaml was found in: ${parentPath}, but was not found in ${projectPath}`
      );
      return "B";
    }
    return "";
  } catch (err) {
    logger.error(`Unable to validate project folder path: ${err}`);
    return err;
  }
};

/**
 * Checks if working definition.yaml(s) is present
 * with validated source, template, and version
 *
 * @param configuration combination of parent/leaf definitions
 * @param parentPath Path to the parent definition.yaml file, if it exists
 * @param projectPath Path to the leaf definition.yaml file, if it exists
 */
export const validateTemplateSources = async (
  configuration: string,
  parentPath: string,
  projectPath: string
): Promise<string[]> => {
  try {
    const sourceVals = ["source", "template", "version"];
    const sources = [configuration];
    /* Configuration A indicates that there is a parent definition.yaml
       and a leaf definition.yaml */
    if (configuration === "A") {
      const parentData = readYaml<IInfraConfigYaml>(parentPath);
      const leafData = readYaml<IInfraConfigYaml>(projectPath);
      const parentInfraConfig = loadConfigurationFromLocalEnv(parentData || {});
      const leafInfraConfig = loadConfigurationFromLocalEnv(leafData || {});
      // Logic for which source data takes precedence
      if (parentInfraConfig && leafInfraConfig) {
        if (
          (parentInfraConfig.source && leafInfraConfig.source) ||
          (!parentInfraConfig.source && leafInfraConfig.source)
        ) {
          sources.push(leafInfraConfig.source);
        } else if (parentInfraConfig.source && !leafInfraConfig.source) {
          sources.push(parentInfraConfig.source);
        }
        if (
          (parentInfraConfig.template && leafInfraConfig.template) ||
          (!parentInfraConfig.template && leafInfraConfig.template)
        ) {
          sources.push(leafInfraConfig.template);
        } else if (parentInfraConfig.template && !leafInfraConfig.template) {
          sources.push(parentInfraConfig.template);
        }
        if (
          (parentInfraConfig.version && leafInfraConfig.version) ||
          (!parentInfraConfig.version && leafInfraConfig.version)
        ) {
          sources.push(leafInfraConfig.version);
        } else if (parentInfraConfig.version && !leafInfraConfig.version) {
          sources.push(parentInfraConfig.version);
        }
      }
      // Configuration B indicates that there is only a parent definition.yaml
    } else if (configuration === "B") {
      const parentData = readYaml<IInfraConfigYaml>(parentPath);
      const parentInfraConfig: any = loadConfigurationFromLocalEnv(
        parentData || {}
      );
      sourceVals.forEach((element: string) => {
        if (parentInfraConfig[element]) {
          sources.push(parentInfraConfig[element]);
        }
      });
    }
    const safeLoggingUrl = safeGitUrlForLogging(sources[1]);
    if (!(sources[2] && sources[1])) {
      logger.info(
        `The definition.yaml file is invalid. There is a missing field for the definition file's sources. Template: ${sources[2]} source: ${safeLoggingUrl} version: ${sources[3]}`
      );
    }
    logger.info(
      `Checking for locally stored template: ${sources[2]} from remote repository: ${safeLoggingUrl} at version: ${sources[3]}`
    );
    return sources;
  } catch (err) {
    return err;
  }
};

/**
 * Checks if provided source, template and version are valid. TODO/ Private Repo, PAT, ssh-key agent
 *
 * @param definitionJSON definition object in JSON format
 */
export const validateRemoteSource = async (
  definitionJSON: string[]
): Promise<boolean> => {
  const [configuration, source, template, version] = definitionJSON;
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
      await createGenerated(sourcePath);
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
        await gitClone(source, sourcePath);
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
 * Performs a 'git clone...'
 *
 * @param source git url to clone
 * @param sourcePath location to clone repo to
 */
export const gitClone = async (
  source: string,
  sourcePath: string
): Promise<void> => {
  await git.clone(source, `${sourcePath}`);
  logger.info(`Cloning source repo to .spk/templates was successful.`);
};

/**
 * Creates "generated" directory if it does not already exists
 *
 * @param parentPath Path to the parent definition.yaml file
 * @param projectPath Path to the leaf definition.yaml file
 * @param sources Array of source configuration
 */
export const generateConfig = async (
  parentPath: string,
  projectPath: string,
  sources: string[]
): Promise<void> => {
  try {
    const configuration = sources[0];
    const source = sources[1];
    const sourceFolder = await infraCommon.repoCloneRegex(source);
    const templatePath = path.join(
      infraCommon.spkTemplatesPath,
      sourceFolder,
      sources[2]
    );
    // const cwdPath = process.cwd();
    const parentDirectory = parentPath + "-generated";
    const childDirectory = path.join(parentDirectory, projectPath);
    if (configuration === "A") {
      /* First, search for definition.yaml in current working directory.
         If there exists a definition.yaml, then read file. */
      const parentData = readYaml<IInfraConfigYaml>(
        path.join(parentPath, "definition.yaml")
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

      /* if the "--project" argument is not specified, then it is assumed
       that the current working directory is the project path. */
      if (projectPath === parentPath) {
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
        // "--project" argument IS specified and is different than cwd
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
          /* If there is not a variables block in the parent definition.yaml,
           then assume the variables are taken from leaf definitions */
          const spkTfvarsObject = await generateTfvars(
            leafInfraConfig.variables
          );
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
    } else if (configuration === "B") {
      const parentData = readYaml<IInfraConfigYaml>(
        path.join(parentPath, "definition.yaml")
      );
      const parentInfraConfig = loadConfigurationFromLocalEnv(parentData || {});
      if (projectPath === parentPath) {
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
        await singleDefinitionGeneration(
          parentInfraConfig,
          parentDirectory,
          childDirectory,
          templatePath
        );
      }
    }
  } catch (err) {
    return err;
  }
};

/**
 * Creates "generated" directory if it does not already exists
 *
 * @param infraConfig definition object
 * @param parentDirectory Path to the parent definition.yaml file
 * @param childDirectory Path to the leaf definition.yaml file
 * @param templatePath Path to the versioned Terraform template
 */
export const singleDefinitionGeneration = async (
  infraConfig: any,
  parentDirectory: string,
  childDirectory: string,
  templatePath: string
): Promise<void> => {
  try {
    await createGenerated(parentDirectory);
    await createGenerated(childDirectory);
    const spkTfvarsObject = await generateTfvars(infraConfig.variables);
    await checkTfvars(childDirectory, "spk.tfvars");
    await writeTfvarsFile(spkTfvarsObject, childDirectory, "spk.tfvars");
    if (infraConfig.backend) {
      const backendTfvarsObject = await generateTfvars(infraConfig.backend);
      await checkTfvars(childDirectory, "backend.tfvars");
      await writeTfvarsFile(
        backendTfvarsObject,
        childDirectory,
        "backend.tfvars"
      );
    }
    await copyTfTemplate(templatePath, childDirectory, true);
  } catch (err) {
    return err;
  }
};

/**
 * Replaces values from leaf definition in parent definition
 *
 * @param parentObject parent definition object
 * @param leafObject leaf definition object
 */
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
 * Checks if an spk.tfvars already exists
 *
 * @param generatedPath Path to the spk.tfvars file
 * @param tfvarsFilename Name of .tfvars file
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

/**
 *
 * Takes in the "variables" block from definitio.yaml file and returns
 * a spk.tfvars file.
 *
 * @param definition definition object to manipulate with regex
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
 * @param tfvarsFileName Name of the .tfvaras file
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
