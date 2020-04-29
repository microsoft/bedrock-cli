import commander from "commander";
import fs from "fs";
import fsExtra from "fs-extra";
import mkdirp from "mkdirp";
import path from "path";
import process from "process";
import git from "simple-git/promise";
import { loadConfigurationFromLocalEnv, readYaml } from "../../config";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { safeGitUrlForLogging } from "../../lib/gitutils";
import { deepClone } from "../../lib/util";
import { logger } from "../../logger";
import { InfraConfigYaml } from "../../types";
import decorator from "./generate.decorator.json";
import {
  BACKEND_TFVARS,
  DEFINITION_YAML,
  getSourceFolderNameFromURL,
  BEDROCK_TFVARS,
  bedrockTemplatesPath,
} from "./infra_common";
import { copyTfTemplate } from "./scaffold";
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";
import { exec } from "../../lib/shell";

interface CommandOptions {
  project: string | undefined;
  output: string | undefined;
}

export interface SourceInformation {
  source: string;
  template: string;
  version: string;
}

export enum DefinitionYAMLExistence {
  BOTH_EXIST,
  PARENT_ONLY,
}

const regexSource = /^\s*source\s*=\s*["'](\.\.?\/[^"']*)["']$/gm;

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
  mkdirp.sync(bedrockTemplatesPath);

  // Check for parent definition.yaml and child definition.yaml
  const parentPathExist = fs.existsSync(path.join(parentPath, DEFINITION_YAML));
  const projectPathExist = fs.existsSync(
    path.join(projectPath, DEFINITION_YAML)
  );

  if (parentPathExist) {
    if (projectPathExist) {
      logger.info(
        `${DEFINITION_YAML} was found in ${parentPath} and ${projectPath}`
      );
      return DefinitionYAMLExistence.BOTH_EXIST;
    }
    logger.warn(
      `${DEFINITION_YAML} was found in: ${parentPath}, but was not found in ${projectPath}`
    );
    return DefinitionYAMLExistence.PARENT_ONLY;
  }

  throw buildError(errorStatusCode.ENV_SETTING_ERR, {
    errorKey: "infra-defn-yaml-not-found",
    values: [DEFINITION_YAML, parentPath],
  });
};

export const getDefinitionYaml = (dir: string): InfraConfigYaml => {
  const parentData = readYaml<InfraConfigYaml>(path.join(dir, DEFINITION_YAML));
  return loadConfigurationFromLocalEnv(parentData || {});
};

/**
 * Checks if working definition.yaml(s) is present
 * with validated source, template, and version
 *
 * @param configuration combination of parent/leaf definitions
 * @param parentDir Path to the parent definition.yaml file, if it exists
 * @param projectDir Path to the leaf definition.yaml file, if it exists
 */
export const validateTemplateSources = (
  configuration: DefinitionYAMLExistence,
  parentDir: string,
  projectDir: string
): SourceInformation => {
  const sourceKeys = ["source", "template", "version"] as Array<
    keyof SourceInformation
  >;
  const source: SourceInformation = {
    source: "",
    template: "",
    version: "",
  };
  let parentInfraConfig: InfraConfigYaml;
  let leafInfraConfig: InfraConfigYaml;

  if (configuration === DefinitionYAMLExistence.PARENT_ONLY) {
    parentInfraConfig = getDefinitionYaml(parentDir);
  } else if (configuration === DefinitionYAMLExistence.BOTH_EXIST) {
    parentInfraConfig = getDefinitionYaml(parentDir);
    leafInfraConfig = getDefinitionYaml(projectDir);
  }

  // setting values into source object for source, template and version
  // taking the values from leaf if it exists, otherwise take it
  // from parent if it exists
  sourceKeys.forEach((k) => {
    if (leafInfraConfig && leafInfraConfig[k]) {
      source[k] = leafInfraConfig[k];
    } else if (parentInfraConfig && parentInfraConfig[k]) {
      source[k] = parentInfraConfig[k];
    }
  });
  if (source.source && source.template && source.version) {
    const safeLoggingUrl = safeGitUrlForLogging(source.source);
    logger.info(
      `Checking for locally stored template: ${source.template} from remote repository: ${safeLoggingUrl} at version: ${source.version}`
    );
    return source;
  }
  throw buildError(errorStatusCode.INCORRECT_DEFINITION, {
    errorKey: "infra-defn-yaml-invalid",
    values: [DEFINITION_YAML, source.template, source.source, source.version],
  });
};

/**
 * Creates "generated" directory if it does not already exists
 *
 * @param projectPath path to the project directory
 */
export const createGenerated = (projectPath: string): void => {
  mkdirp.sync(projectPath);
  logger.info(`Created generated directory: ${projectPath}`);
};

export const gitPull = async (
  sourcePath: string,
  safeLoggingUrl: string
): Promise<void> => {
  // Make sure we have the latest version of all releases cached locally
  try {
    await exec("git", ["symbolic-ref", "HEAD"], { cwd: sourcePath });
    logger.info(
      `${safeLoggingUrl} already cloned and a git branch is currently checked out. Performing 'git pull'...`
    );
    await git(sourcePath).pull();
  } catch (err) {
    logger.info(
      `A git tag is currently checked out. Skipping 'git pull' operation.`
    );
  }
};

export const gitCheckout = async (
  sourcePath: string,
  version: string
): Promise<void> => {
  // Checkout tagged version
  logger.info(`Checking out template version: ${version}`);
  await git(sourcePath).checkout(version);
};

/**
 * Performs a 'git clone...'
 *
 * @param source git url to clone
 * @param sourcePath location to clone repo to
 */
export const gitClone = async (
  git: git.SimpleGit,
  source: string,
  sourcePath: string
): Promise<void> => {
  await git.clone(source, `${sourcePath}`);
  logger.info(`Cloning source repo to .bedrock/templates was successful.`);
};

export const checkRemoteGitExist = async (
  sourcePath: string,
  source: string,
  safeLoggingUrl: string
): Promise<void> => {
  // Checking for git remote
  if (!fs.existsSync(sourcePath)) {
    throw buildError(errorStatusCode.GIT_OPS_ERR, {
      errorKey: "infra-git-source-no-exist",
      values: [sourcePath],
    });
  }

  const result = await git(sourcePath).listRemote([source]);
  if (!result) {
    logger.error(result);
    throw buildError(errorStatusCode.GIT_OPS_ERR, "infra-err-git-clone-failed");
  }

  logger.info(`Remote source repo: ${safeLoggingUrl} exists.`);
};

/**
 * Attempts to remove cloned repo in ~/.bedrock/template directory
 *
 * @param source remote URL for cloning to cache
 * @param sourcePath Path to the template folder cache
 * @param safeLoggingUrl URL with redacted authentication
 * @param version version of terraform template
 */

export const retryRemoteValidate = async (
  source: string,
  sourcePath: string,
  safeLoggingUrl: string,
  version: string
): Promise<void> => {
  // BEDROCK can assume that there is a remote that it has access to since it was able to compare commit histories. Delete cache and reset on provided remote
  fsExtra.removeSync(sourcePath);
  createGenerated(sourcePath);
  const gitCmd = git();
  await gitClone(gitCmd, source, sourcePath);
  logger.info(`Checking out template version: ${version}`);
  await gitCheckout(sourcePath, version);
  await gitPull(sourcePath, safeLoggingUrl);
  logger.info(`Successfully re-cloned repo`);
};

/**
 * Checks if provided source, template and version are valid. TODO/ Private Repo, PAT, ssh-key agent
 *
 * @param sourceConfig definition object
 */
export const validateRemoteSource = async (
  sourceConfig: SourceInformation
): Promise<void> => {
  const source = sourceConfig.source;
  const version = sourceConfig.version;

  // Converting source name to storable folder name
  const sourceFolder = getSourceFolderNameFromURL(source);
  const sourcePath = path.join(bedrockTemplatesPath, sourceFolder);
  const safeLoggingUrl = safeGitUrlForLogging(source);
  logger.info(`Converted to: ${sourceFolder}`);
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
    if (fs.existsSync(path.join(sourcePath, ".git"))) {
      logger.info(`${source} already cloned. Proceeding with 'git checkout'.`);
    } else {
      const gitCmd = git();
      await gitClone(gitCmd, source, sourcePath);
    }
    // Checkout tagged version
    await gitCheckout(sourcePath, version);
    await gitPull(sourcePath, safeLoggingUrl);
  } catch (err) {
    if (err instanceof Error) {
      let retry = false;
      // Retry logic on failed clones
      logger.warn(`FAILURE DETECTED: Checking the error`);
      try {
        // Case 1: Remote source and cached repo have conflicting histories.
        if (err.message.includes("refusing to merge unrelated histories")) {
          logger.info(
            `Detected a refusal to merge unrelated histories, attempting to reset the cached folder to the remote: ${sourcePath}`
          );
          retry = true;
        }
        // Case 2: Remote source and cached repo have conflicting PATs
        else if (err.message.includes("Authentication failed")) {
          logger.info(
            `Detected an authentication failure with existing cache, attempting to reset the cached folder to the remote: ${sourcePath}`
          );
          retry = true;
        }

        if (retry) {
          await retryRemoteValidate(
            source,
            sourcePath,
            safeLoggingUrl,
            version
          );
        } else {
          throw buildError(
            errorStatusCode.GIT_OPS_ERR,
            "infra-err-validating-remote-git-after-retry",
            err
          );
        }
      } catch (retryError) {
        throw buildError(
          errorStatusCode.GIT_OPS_ERR,
          "infra-err-retry-validating-remote-git",
          err
        );
      }
    } else {
      throw buildError(
        errorStatusCode.GIT_OPS_ERR,
        "infra-err-validating-remote-git",
        err
      );
    }
  }
};

export const getParentGeneratedFolder = (
  parentPath: string,
  outputPath: string
): string => {
  if (outputPath !== "") {
    const folderName = parentPath.replace(/^.*[\\/]/, "");
    return path.join(outputPath, folderName + "-generated");
  }
  return parentPath + "-generated";
};

/**
 * Returns an array of formatted string for a given definition object.
 * e.g.
 * {
 *   keyA: "Value1",
 *   keyB: "\"Value2"
 * }
 * results in ["keyA = "Value1"", "keyB = "\"Value2""]
 *
 * @param definition a dictionary of key, value
 */
export const generateTfvars = (
  definition: { [key: string]: string } | undefined
): string[] => {
  if (!definition) {
    return [];
  }
  return Object.keys(definition).map((k) => `${k} = "${definition[k]}"`);
};

/**
 * Checks if an bedrock.tfvars already exists
 *
 * @param generatedPath Path to the bedrock.tfvars file
 * @param tfvarsFilename Name of .tfvars file
 */
export const checkTfvars = (
  generatedPath: string,
  tfvarsFilename: string
): void => {
  // Remove existing bedrock.tfvars if it already exists
  if (fs.existsSync(path.join(generatedPath, tfvarsFilename))) {
    fs.unlinkSync(path.join(generatedPath, tfvarsFilename));
  }
};

/**
 * Reads in a tfVars object and returns a bedrock.tfvars file
 *
 * @param bedrockTfVars bedrock tfvars object in an array
 * @param generatedPath Path to write the bedrock.tfvars file to
 * @param tfvarsFileName Name of the .tfvaras file
 */
export const writeTfvarsFile = (
  bedrockTfVars: string[],
  generatedPath: string,
  tfvarsFilename: string
): void => {
  bedrockTfVars.forEach((tfvar) => {
    fs.appendFileSync(path.join(generatedPath, tfvarsFilename), tfvar + "\n");
  });
};

export const generateConfigWithParentEqProjectPath = async (
  parentDirectory: string,
  templatePath: string,
  parentInfraConfig: InfraConfigYaml
): Promise<void> => {
  createGenerated(parentDirectory);
  if (parentInfraConfig.variables) {
    const bedrockTfvarsObject = generateTfvars(parentInfraConfig.variables);
    checkTfvars(parentDirectory, BEDROCK_TFVARS);
    writeTfvarsFile(bedrockTfvarsObject, parentDirectory, BEDROCK_TFVARS);
    await copyTfTemplate(templatePath, parentDirectory, true);
  } else {
    // Consider the case where the only common configuration is just
    // backend configuration, and no common variable configuration.
    // Thus, it is not "necessary" for a parent definition.yaml to
    // have a variables block in a multi-cluster.
    logger.warn(`Variables are not defined in the definition.yaml`);
  }
  if (parentInfraConfig.backend) {
    const backendTfvarsObject = generateTfvars(parentInfraConfig.backend);
    checkTfvars(parentDirectory, BACKEND_TFVARS);
    writeTfvarsFile(backendTfvarsObject, parentDirectory, BACKEND_TFVARS);
  } else {
    // Not all templates will require a remote backend
    // (i.e Bedrock's azure-simple).
    // If a remote backend is not configured for a template,
    // it will be impossible to be able to use bedrock infra in a
    // pipeline, but this can still work locally.
    logger.warn(
      `A remote backend configuration is not defined in the definition.yaml`
    );
  }
};

/**
 * Replaces values from leaf definition in parent definition
 *
 * @param parentObject parent definition object
 * @param leafObject leaf definition object
 */
export const dirIteration = (
  parentObject: { [key: string]: string } | undefined,
  leafObject: { [key: string]: string } | undefined
): { [key: string]: string } => {
  if (!parentObject) {
    return !leafObject ? {} : deepClone(leafObject);
  }
  if (!leafObject) {
    return parentObject;
  }

  // parent take leaf's value
  Object.keys(leafObject).forEach((k) => {
    if (leafObject[k]) {
      parentObject[k] = leafObject[k];
    }
  });

  return parentObject;
};

const combineVariable = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parentVars: { [key: string]: any },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leafVars: { [key: string]: any },
  childDirectory: string,
  fileName: string
): void => {
  const merged = dirIteration(parentVars, leafVars);
  // Generate Terraform files in generated directory
  const combined = generateTfvars(merged);
  // Write variables to  `bedrock.tfvars` file
  checkTfvars(childDirectory, fileName);
  writeTfvarsFile(combined, childDirectory, fileName);
};

/**
 * Creates "generated" directory with generated Terraform files
 *
 * @param infraConfig definition object
 * @param parentDirectory Path to the parent definition.yaml file
 * @param childDirectory Path to the leaf definition.yaml file
 * @param templatePath Path to the versioned Terraform template
 */
export const singleDefinitionGeneration = async (
  infraConfig: InfraConfigYaml,
  parentDirectory: string,
  childDirectory: string,
  templatePath: string
): Promise<void> => {
  createGenerated(parentDirectory);
  createGenerated(childDirectory);
  const bedrockTfvarsObject = generateTfvars(infraConfig.variables);
  checkTfvars(childDirectory, BEDROCK_TFVARS);
  writeTfvarsFile(bedrockTfvarsObject, childDirectory, BEDROCK_TFVARS);
  if (infraConfig.backend) {
    const backendTfvarsObject = generateTfvars(infraConfig.backend);
    checkTfvars(childDirectory, BACKEND_TFVARS);
    writeTfvarsFile(backendTfvarsObject, childDirectory, BACKEND_TFVARS);
  }
  await copyTfTemplate(templatePath, childDirectory, true);
};

/**
 * Checks to see if module sources are local
 *
 * @param tfFile path to the terraform file in child directory
 */
export const checkModuleSource = (tfData: string): boolean => {
  // Check if the file string matches an instance of a module source value as a local path
  const matches = tfData.match(regexSource);
  return matches !== null;
};

export const revparse = async (sPath: string): Promise<string> => {
  return await git(sPath).revparse(["--show-prefix"]);
};

/**
 * Checks to see if module sources are local
 *
 * @param sourceConfig Array of source configuration
 */
export const moduleSourceModify = async (
  fileSource: SourceInformation,
  tfData: string
): Promise<string> => {
  try {
    let result = "";
    const sourceFolder = getSourceFolderNameFromURL(fileSource.source);
    const sourcePath = path.join(bedrockTemplatesPath, sourceFolder);

    // Split data by line and iterate
    for (let line of tfData.split(/\r?\n/)) {
      // Match line to expected module source format
      if (line.match(regexSource) !== null) {
        // Split the line into segments, the third element is the source value
        const splitLine = line.split(/\s+/);
        // Filter on module source value
        const moduleSource = new RegExp(
          splitLine[3].replace(/['"]+/g, ""),
          "g"
        );
        // Get relative path of terraform module local to the repo
        const repoModulePath = await revparse(
          path.join(
            sourcePath,
            fileSource.template,
            splitLine[3].replace(/["']/g, "")
          )
        );
        // Concatenate the Git URL with munged data using a generic git repository format
        const gitSource =
          "git::" +
          fileSource.source.concat(
            "//",
            repoModulePath,
            "?ref=",
            fileSource.version
          );
        // Replace the line
        line = line.replace(moduleSource, gitSource);
      }
      result += line + "\n";
    }
    return result;
  } catch (err) {
    throw buildError(
      errorStatusCode.EXE_FLOW_ERR,
      "infra-module-source-modify-err",
      err
    );
  }
};

/**
 * Checks to see if module sources are local
 *
 * @param sourceConfig Array of source configuration
 */
export const inspectGeneratedSources = async (
  childDirectory: string,
  sourceConfig: SourceInformation
): Promise<void> => {
  try {
    // Support for local source paths, check template directory .tf files to generate git paths for terraform modules
    const files = fsExtra.readdirSync(childDirectory, "utf-8");
    for (const file of files) {
      if (path.extname(file) === ".tf") {
        const tfData = fsExtra.readFileSync(
          path.join(childDirectory, file),
          "utf8"
        );
        const containsLocalSource = checkModuleSource(tfData);
        if (containsLocalSource) {
          logger.info(
            `Local relative paths for module source values detected in terraform file: ${file}`
          );
          const mungeData = await moduleSourceModify(sourceConfig, tfData);
          logger.info(
            `Terraform File: ${file} local module source values successfully converted to git source paths`
          );
          fsExtra.writeFileSync(
            path.join(childDirectory, file),
            mungeData,
            "utf8"
          );
        }
      }
    }
  } catch (err) {
    throw buildError(
      errorStatusCode.EXE_FLOW_ERR,
      "infra-inspect-generated-sources-err",
      err
    );
  }
};

/**
 * Creates "generated" directory if it does not already exists
 *
 * @param parentPath Path to the parent definition.yaml file
 * @param projectPath Path to the leaf definition.yaml file
 * @param definitionConfig Parent-leaf definition configuration
 * @param sourceConfig Array of source configuration
 * @param outputPath Path to outputted generated directory
 */
export const generateConfig = async (
  parentPath: string,
  projectPath: string,
  definitionConfig: DefinitionYAMLExistence,
  sourceConfig: SourceInformation,
  outputPath: string
): Promise<void> => {
  const parentDirectory = getParentGeneratedFolder(parentPath, outputPath);
  const sourceFolder = getSourceFolderNameFromURL(sourceConfig.source);
  const templatePath = path.join(
    bedrockTemplatesPath,
    sourceFolder,
    sourceConfig.template
  );
  const childDirectory =
    projectPath === parentPath
      ? parentPath
      : path.join(parentDirectory, projectPath);

  if (definitionConfig === DefinitionYAMLExistence.BOTH_EXIST) {
    const parentInfraConfig = getDefinitionYaml(parentPath);
    const leafInfraConfig = getDefinitionYaml(projectPath);

    if (projectPath === parentPath) {
      await generateConfigWithParentEqProjectPath(
        parentDirectory,
        templatePath,
        parentInfraConfig
      );
    } else {
      createGenerated(parentDirectory);
      createGenerated(childDirectory);
    }
    combineVariable(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      parentInfraConfig.variables!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      leafInfraConfig.variables!,
      childDirectory,
      BEDROCK_TFVARS
    );

    // Create a backend.tfvars for remote backend configuration
    if (parentInfraConfig.backend && leafInfraConfig.backend) {
      combineVariable(
        parentInfraConfig.backend,
        leafInfraConfig.backend,
        childDirectory,
        BACKEND_TFVARS
      );
    }
    await copyTfTemplate(templatePath, childDirectory, true);
  } else if (definitionConfig === DefinitionYAMLExistence.PARENT_ONLY) {
    const parentInfraConfig = getDefinitionYaml(parentPath);
    // there will not be a case here when parentPath === projectPath
    // here because if both are the same, we would have
    // DefinitionYAMLExistence.BOTH_EXIST and not
    // DefinitionYAMLExistence.PARENT_ONLY)
    await singleDefinitionGeneration(
      parentInfraConfig,
      parentDirectory,
      childDirectory,
      templatePath
    );
  }
  // Modify generated TF files if it contains local sources
  await inspectGeneratedSources(childDirectory, sourceConfig);
};

export const execute = async (
  opts: CommandOptions,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  const parentPath = process.cwd();
  // if the "--project" argument is not specified, then it is assumed
  // that the current working directory is the project path.
  const projectPath = opts.project || parentPath;
  const outputPath = opts.output || "";
  try {
    const definitionConfig = validateDefinition(parentPath, projectPath);
    const sourceConfig = validateTemplateSources(
      definitionConfig,
      parentPath,
      projectPath
    );
    // validateTemplateSources makes sure that
    // sourceConfig has values for source, template and version
    await validateRemoteSource(sourceConfig);
    await generateConfig(
      parentPath,
      projectPath,
      definitionConfig,
      sourceConfig,
      outputPath
    );
    await exitFn(0);
  } catch (err) {
    logError(
      buildError(errorStatusCode.CMD_EXE_ERR, "infra-generate-cmd-failed", err)
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
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
