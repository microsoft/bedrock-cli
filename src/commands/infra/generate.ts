import commander from "commander";
import fs from "fs";
import fsExtra from "fs-extra";
import mkdirp from "mkdirp";
import path from "path";
import process from "process";
import simpleGit from "simple-git/promise";
import { loadConfigurationFromLocalEnv, readYaml } from "../../config";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { safeGitUrlForLogging } from "../../lib/gitutils";
import { deepClone } from "../../lib/util";
import { logger } from "../../logger";
import { IInfraConfigYaml } from "../../types";
import decorator from "./generate.decorator.json";
import * as infraCommon from "./infra_common";
import { copyTfTemplate } from "./scaffold";

const DEF_YAML = "definition.yaml";

interface ICommandOptions {
  project: string | undefined;
}

export interface ISourceInformation {
  source?: string;
  template?: string;
  version?: string;
}

export enum DefinitionYAMLExistence {
  BOTH_EXIST,
  PARENT_ONLY
}

export const fetchValues = (opts: ICommandOptions): string => {
  if (opts.project) {
    logger.info(`spk will generate the following project: ${opts.project}`);
    return opts.project;
  }
  logger.warn(
    `No project folder was provided, spk will generate the current folder as a project`
  );
  return process.cwd();
};

export const execute = async (
  opts: ICommandOptions,
  exitFn: (status: number) => Promise<void>
) => {
  const projectPath = fetchValues(opts);
  const parentPath = process.cwd();

  try {
    const definitionConfig = validateDefinition(parentPath, projectPath);
    const sourceConfig = validateTemplateSources(
      definitionConfig,
      parentPath,
      projectPath
    );
    await validateRemoteSource(sourceConfig);
    await generateConfig(
      parentPath,
      projectPath,
      definitionConfig,
      sourceConfig
    );
    await exitFn(0);
  } catch (err) {
    logger.error("Error occurred while generating project deployment files");
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
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};

/**
 * Checks if definition.yaml is present locally to provided project path
 *
 *  @param parentPath Path to the parent definition.yaml file
 *  @param projectPath Path to the leaf definition.yaml file
 */
export const validateDefinition = (
  parentPath: string,
  projectPath: string
): DefinitionYAMLExistence => {
  // If templates folder does not exist, create cache templates directory
  mkdirp.sync(infraCommon.spkTemplatesPath);

  // Check for parent definition.yaml and child definition.yaml
  const parentPathExist = fs.existsSync(path.join(parentPath, DEF_YAML));
  const projectPathExist = fs.existsSync(path.join(projectPath, DEF_YAML));

  if (parentPathExist) {
    if (projectPathExist) {
      logger.info(`${DEF_YAML} was found in ${parentPath} and ${projectPath}`);
      return DefinitionYAMLExistence.BOTH_EXIST;
    }
    logger.warn(
      `${DEF_YAML} was found in: ${parentPath}, but was not found in ${projectPath}`
    );
    return DefinitionYAMLExistence.PARENT_ONLY;
  }

  throw new Error(`${DEF_YAML} was not found in ${parentPath}`);
};

export const getDefinitionYaml = (dir: string): IInfraConfigYaml => {
  const parentData = readYaml<IInfraConfigYaml>(path.join(dir, DEF_YAML));
  return loadConfigurationFromLocalEnv(parentData || {});
};

/**
 * Checks if working definition.yaml(s) is present
 * with validated source, template, and version
 *
 * @param configuration combination of parent/leaf definitions
 * @param parentPath Path to the parent definition.yaml file, if it exists
 * @param projectPath Path to the leaf definition.yaml file, if it exists
 */
export const validateTemplateSources = (
  configuration: DefinitionYAMLExistence,
  parentDir: string,
  projectDir: string
): ISourceInformation => {
  const sourceKeys = ["source", "template", "version"] as Array<
    keyof ISourceInformation
  >;
  const source: ISourceInformation = {};
  let parentInfraConfig: IInfraConfigYaml;
  let leafInfraConfig: IInfraConfigYaml;

  if (configuration === DefinitionYAMLExistence.PARENT_ONLY) {
    parentInfraConfig = getDefinitionYaml(parentDir);
  } else if (configuration === DefinitionYAMLExistence.BOTH_EXIST) {
    parentInfraConfig = getDefinitionYaml(parentDir);
    leafInfraConfig = getDefinitionYaml(projectDir);
  }

  // setting values into source object for source, template and version
  // taking the values from leaf if it exists, otherwise take it
  // from parent if it exists
  sourceKeys.forEach(k => {
    if (leafInfraConfig && leafInfraConfig[k]) {
      source[k] = leafInfraConfig[k];
    } else if (parentInfraConfig && parentInfraConfig[k]) {
      source[k] = parentInfraConfig[k];
    }
  });
  if (!source.source || !source.template || !source.version) {
    logger.info(
      `The ${DEF_YAML} file is invalid. \
There is a missing field for it's sources. \
Template: ${source.template} source: ${source.source} version: ${source.version}`
    );
  }
  const safeLoggingUrl = safeGitUrlForLogging(source.source!);
  logger.info(
    `Checking for locally stored template: ${source.template} from remote repository: ${safeLoggingUrl} at version: ${source.version}`
  );
  return source;
};

export const checkRemoteGitExist = async (
  sourcePath: string,
  source: string,
  safeLoggingUrl: string
) => {
  // Checking for git remote
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`${sourcePath} does not exist`);
  }
  const result = await simpleGit(sourcePath).listRemote([source]);
  if (!result) {
    logger.error(result);
    throw new Error(
      `Unable to clone the source remote repository. \
The remote repo may not exist or you do not have the rights to access it`
    );
  }

  logger.info(`Remote source repo: ${safeLoggingUrl} exists.`);
};

export const gitFetchPull = async (
  sourcePath: string,
  safeLoggingUrl: string
) => {
  try {
    // Make sure we have the latest version of all releases cached locally
    await simpleGit(sourcePath).fetch("all");
    await simpleGit(sourcePath).pull("origin", "master");
    logger.info(`${safeLoggingUrl} already cloned. Performing 'git pull'...`);
  } catch (error) {
    throw error;
  }
};

export const gitCheckout = async (sourcePath: string, version: string) => {
  // Checkout tagged version
  logger.info(`Checking out template version: ${version}`);
  await simpleGit(sourcePath).checkout(version);
};

/**
 * Checks if provided source, template and version are valid. TODO/ Private Repo, PAT, ssh-key agent
 *
 * @param definitionJSON definition object in JSON format
 */
export const validateRemoteSource = async (
  sourceConfig: ISourceInformation
) => {
  const source = sourceConfig.source!;
  const version = sourceConfig.version!;

  // Converting source name to storable folder name
  const sourceFolder = await infraCommon.repoCloneRegex(source);
  const sourcePath = path.join(infraCommon.spkTemplatesPath, sourceFolder);
  const safeLoggingUrl = safeGitUrlForLogging(source);
  logger.warn(`Converted to: ${sourceFolder}`);
  logger.info(`Checking if source: ${sourcePath} is stored locally.`);

  if (!fs.existsSync(sourcePath)) {
    logger.warn(
      `Provided source in template directory was not found, attempting to clone the template source repo locally.`
    );
    createGenerated(sourcePath);
  } else {
    logger.info(
      `Source template folder found. Validating existence of repository.`
    );
  }

  await checkRemoteGitExist(sourcePath, source, safeLoggingUrl);
  logger.info(
    `Checking if source repo: ${safeLoggingUrl} has been already cloned to: ${sourcePath}.`
  );
  try {
    // Check if .git folder exists in ${sourcePath}, if not, then clone
    // if already cloned, 'git pull'
    if (fs.existsSync(path.join(sourcePath, ".git"))) {
      await gitFetchPull(sourcePath, safeLoggingUrl);
    } else {
      const git = simpleGit();
      await gitClone(git, source, sourcePath);
    }
    // Checkout tagged version
    await gitCheckout(sourcePath, version);
  } catch (err) {
    if (err instanceof Error) {
      // Retry logic on failed clones
      logger.warn(`FAILURE DETECTED: Checking the error`);
      try {
        // Case 1: Remote source and cached repo have conflicting histories.
        if (err.message.includes("refusing to merge unrelated histories")) {
          logger.info(
            `Detected a refusal to merge unrelated histories, attempting to reset the cached folder to the remote: ${sourcePath}`
          );
          await retryRemoteValidate(
            source,
            sourcePath,
            safeLoggingUrl,
            version
          );
        }
        // Case 2: Remote source and cached repo have conflicting PATs
        else if (err.message.includes("Authentication failed")) {
          logger.info(
            `Detected an authentication failure with existing cache, attempting to reset the cached folder to the remote: ${sourcePath}`
          );
          await retryRemoteValidate(
            source,
            sourcePath,
            safeLoggingUrl,
            version
          );
        } else {
          throw new Error(
            `Unable to determine error from supported retry cases ${err.message}`
          );
        }
      } catch (retryError) {
        throw new Error(`Failure error thrown during retry ${retryError}`);
      }
    }
  }
};

/**
 * Performs a 'git clone...'
 *
 * @param source git url to clone
 * @param sourcePath location to clone repo to
 */
export const gitClone = async (
  git: simpleGit.SimpleGit,
  source: string,
  sourcePath: string
): Promise<void> => {
  try {
    await git.clone(source, `${sourcePath}`);
    logger.info(`Cloning source repo to .spk/templates was successful.`);
  } catch (error) {
    throw error;
  }
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
  definitionConfig: DefinitionYAMLExistence,
  sourceConfig: ISourceInformation
): Promise<void> => {
  try {
    const source = sourceConfig.source!;
    const sourceFolder = await infraCommon.repoCloneRegex(source);
    const templatePath = path.join(
      infraCommon.spkTemplatesPath,
      sourceFolder,
      sourceConfig.template!
    );
    // const cwdPath = process.cwd();
    const parentDirectory = parentPath + "-generated";
    const childDirectory = path.join(parentDirectory, projectPath);
    if (definitionConfig === DefinitionYAMLExistence.BOTH_EXIST) {
      /* First, search for definition.yaml in current working directory.
         If there exists a definition.yaml, then read file. */
      const parentInfraConfig = getDefinitionYaml(parentPath);
      const leafInfraConfig = getDefinitionYaml(projectPath);

      /* Iterate through parent and leaf JSON objects to find matches
      If there is a match, then replace parent key-value
      If there is no match between the parent and leaf,
      then append leaf key-value parent key-value JSON */

      /* if the "--project" argument is not specified, then it is assumed
       that the current working directory is the project path. */
      if (projectPath === parentPath) {
        createGenerated(parentDirectory);
        if (parentInfraConfig.variables) {
          const spkTfvarsObject = generateTfvars(parentInfraConfig.variables);
          checkTfvars(parentDirectory, "spk.tfvars");
          writeTfvarsFile(spkTfvarsObject, parentDirectory, "spk.tfvars");
          await copyTfTemplate(templatePath, parentDirectory, true);
        } else {
          logger.warning(`Variables are not defined in the definition.yaml`);
        }
        if (parentInfraConfig.backend) {
          const backendTfvarsObject = generateTfvars(parentInfraConfig.backend);
          checkTfvars(parentDirectory, "backend.tfvars");
          writeTfvarsFile(
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
        createGenerated(parentDirectory);
        // Then, create generated child directory
        createGenerated(childDirectory);
      }
      if (typeof parentInfraConfig !== "undefined") {
        if (leafInfraConfig) {
          const finalDefinition = dirIteration(
            parentInfraConfig.variables,
            leafInfraConfig.variables
          );
          // Generate Terraform files in generated directory
          const combinedSpkTfvarsObject = generateTfvars(finalDefinition);
          // Write variables to  `spk.tfvars` file
          checkTfvars(childDirectory, "spk.tfvars");
          writeTfvarsFile(
            combinedSpkTfvarsObject,
            childDirectory,
            "spk.tfvars"
          );

          // Create a backend.tfvars for remote backend configuration
          if (parentInfraConfig.backend && leafInfraConfig.backend) {
            const finalBackendDefinition = dirIteration(
              parentInfraConfig.backend,
              leafInfraConfig.backend
            );
            const backendTfvarsObject = generateTfvars(finalBackendDefinition);
            checkTfvars(childDirectory, "backend.tfvars");
            writeTfvarsFile(
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
          const spkTfvarsObject = generateTfvars(leafInfraConfig.variables);
          // Write variables to  `spk.tfvars` file
          checkTfvars(childDirectory, "spk.tfvars");
          writeTfvarsFile(spkTfvarsObject, childDirectory, "spk.tfvars");
          await copyTfTemplate(templatePath, childDirectory, true);
        } else {
          logger.warning(`Variables are not defined in the definition.yaml`);
        }
        // If there is no backend block specified in the parent definition.yaml,
        // then create a backend based on the leaf definition.yaml
        if (leafInfraConfig.backend) {
          const backendTfvarsObject = generateTfvars(leafInfraConfig.backend);
          checkTfvars(childDirectory, "backend.tfvars");
          writeTfvarsFile(
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
    } else if (definitionConfig === DefinitionYAMLExistence.PARENT_ONLY) {
      const parentInfraConfig = getDefinitionYaml(parentPath);
      if (projectPath === parentPath) {
        createGenerated(parentDirectory);
        if (parentInfraConfig.variables) {
          const spkTfvarsObject = generateTfvars(parentInfraConfig.variables);
          checkTfvars(parentDirectory, "spk.tfvars");
          writeTfvarsFile(spkTfvarsObject, parentDirectory, "spk.tfvars");
          await copyTfTemplate(templatePath, parentDirectory, true);
        } else {
          logger.warning(`Variables are not defined in the ${DEF_YAML}`);
        }
        if (parentInfraConfig.backend) {
          const backendTfvarsObject = generateTfvars(parentInfraConfig.backend);
          checkTfvars(parentDirectory, "backend.tfvars");
          writeTfvarsFile(
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
    // TODO: handle definitionConfig === DefinitionYAMLExistence.LEAF_ONLY
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
    createGenerated(parentDirectory);
    createGenerated(childDirectory);
    const spkTfvarsObject = generateTfvars(infraConfig.variables);
    checkTfvars(childDirectory, "spk.tfvars");
    writeTfvarsFile(spkTfvarsObject, childDirectory, "spk.tfvars");
    if (infraConfig.backend) {
      const backendTfvarsObject = generateTfvars(infraConfig.backend);
      checkTfvars(childDirectory, "backend.tfvars");
      writeTfvarsFile(backendTfvarsObject, childDirectory, "backend.tfvars");
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
export const dirIteration = (
  parentObject: { [key: string]: any } | undefined,
  leafObject: { [key: string]: any } | undefined
): { [key: string]: any } => {
  if (!parentObject) {
    return !leafObject ? {} : deepClone(leafObject);
  }
  if (!leafObject) {
    return parentObject;
  }

  // parent take leaf's value
  Object.keys(leafObject).forEach(k => {
    if (leafObject[k]) {
      parentObject[k] = leafObject[k];
    }
  });

  return parentObject;
};

/**
 * Creates "generated" directory if it does not already exists
 *
 * @param source remote URL for cloning to cache
 * @param sourcePath Path to the template folder cache
 * @param safeLoggingUrl URL with redacted authentication
 * @param version version of terraform template
 */
export const createGenerated = (projectPath: string) => {
  mkdirp.sync(projectPath);
  logger.info(`Created generated directory: ${projectPath}`);
};

export const retryRemoteValidate = async (
  source: string,
  sourcePath: string,
  safeLoggingUrl: string,
  version: string
) => {
  try {
    // SPK can assume that there is a remote that it has access to since it was able to compare commit histories. Delete cache and reset on provided remote
    fsExtra.removeSync(sourcePath);
    createGenerated(sourcePath);
    const git = simpleGit();
    await gitClone(git, source, sourcePath);
    await gitFetchPull(sourcePath, safeLoggingUrl);
    logger.info(`Checking out template version: ${version}`);
    await gitCheckout(sourcePath, version);
    logger.info(`Successfully re-cloned repo`);
  } catch (error) {
    throw error;
  }
};

/**
 * Checks if an spk.tfvars already exists
 *
 * @param generatedPath Path to the spk.tfvars file
 * @param tfvarsFilename Name of .tfvars file
 */
export const checkTfvars = (generatedPath: string, tfvarsFilename: string) => {
  // Remove existing spk.tfvars if it already exists
  if (fs.existsSync(path.join(generatedPath, tfvarsFilename))) {
    fs.unlinkSync(path.join(generatedPath, tfvarsFilename));
  }
};

/**
 * Returns an array of formatted string for an given JSON object.
 * e.g.
 * {
 *   keyA: "Value1",
 *   keyB: "\"Value2"
 * }
 * results in  ["keyA = "Value1"", "keyB = "\"Value2""]
 *
 * @param definition
 */
export const generateTfvars = (
  definition: { [key: string]: string } | undefined
): string[] => {
  if (!definition) {
    return [];
  }
  return Object.keys(definition).map(k => `${k} = "${definition[k]}"`);
};

/**
 * Reads in a tfVars object and returns a spk.tfvars file
 *
 * @param spkTfVars spk tfvars object in an array
 * @param generatedPath Path to write the spk.tfvars file to
 * @param tfvarsFileName Name of the .tfvaras file
 */
export const writeTfvarsFile = (
  spkTfVars: string[],
  generatedPath: string,
  tfvarsFilename: string
) => {
  spkTfVars.forEach(tfvar => {
    fs.appendFileSync(path.join(generatedPath, tfvarsFilename), tfvar + "\n");
  });
};
