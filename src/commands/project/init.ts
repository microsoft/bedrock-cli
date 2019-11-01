import commander from "commander";
import fs from "fs";
import path from "path";
import shelljs, { cat } from "shelljs";
import { Bedrock, write } from "../../config";
import {
  generateDockerfile,
  generateGitIgnoreFile,
  generateHldLifecyclePipelineYaml,
  generateStarterAzurePipelinesYaml
} from "../../lib/fileutils";
import { exec } from "../../lib/shell";
import { logger } from "../../logger";
import { IBedrockFile, IHelmConfig, IMaintainersFile } from "../../types";

/**
 * Adds the init command to the commander command object
 *
 * @param command Commander command object to decorate
 */
export const initCommandDecorator = (command: commander.Command): void => {
  command
    .command("init")
    .alias("i")
    .description(
      "Initialize your spk repository. Will add starter bedrock, maintainers, and azure-pipelines YAML files to your project."
    )
    .option(
      "-m, --mono-repo",
      "Initialize this repository as a mono-repo. All directories under `packages` (modifiable with `-d` flag) will be initialized as packages.",
      false
    )
    .option(
      "-d, --packages-dir <dir>",
      "The directory containing the mono-repo packages. This is a noop if `-m` not set.",
      "packages"
    )
    .option(
      "-r, --default-ring <branch-name>",
      "Specify a default ring; this corresponds to a default branch which you wish to push initial revisions to",
      "master"
    )
    .option(
      "--variable-group-name <variable-group-name>",
      "The Azure DevOps Variable Group."
    )
    .action(async opts => {
      const { monoRepo, packagesDir, defaultRing } = opts;
      const projectPath = process.cwd();

      try {
        // fall back to bedrock.yaml when <variable-group-name> argument is not specified
        let bedrockFile: IBedrockFile | undefined;
        try {
          bedrockFile = Bedrock();
        } catch (err) {
          logger.info(err);
        }

        const {
          variableGroupName = bedrockFile &&
            bedrockFile.variableGroups &&
            bedrockFile.variableGroups![0]
        } = opts;

        logger.info(`variable name: ${variableGroupName}`);

        // Type check all parsed command line args here.
        if (typeof monoRepo !== "boolean") {
          throw new Error(
            `--mono-repo must be of type boolean, ${typeof monoRepo} given`
          );
        }
        if (typeof packagesDir !== "string") {
          throw new Error(
            `--packages-dir must be of type 'string', ${typeof packagesDir} given`
          );
        }
        if (typeof defaultRing !== "string") {
          throw new Error(
            `--default-ring must be of type 'string', '${defaultRing}' of type '${typeof defaultRing}' given`
          );
        }

        if (
          variableGroupName !== null &&
          variableGroupName !== undefined &&
          typeof variableGroupName !== "string"
        ) {
          throw new Error(
            `variableGroupName must be of type 'string', ${typeof variableGroupName} given.`
          );
        }

        await initialize(projectPath, {
          defaultRing,
          monoRepo,
          packagesDir,
          variableGroups:
            variableGroupName === undefined || variableGroupName === null
              ? []
              : [variableGroupName]
        });
      } catch (err) {
        logger.error(
          `Error occurred while initializing project ${projectPath}`
        );
        logger.error(err);
      }
    });
};

/**
 * Initializes the `rootProject` with a bedrock.yaml, maintainers.yaml
 * If opts.monoRepo == true, the root directly will be initialized as a mono-repo
 * If opts.monoRepo == true, all direct subdirectories under opts.packagesDir will be initialized as individual projects
 *
 * @param rootProjectPath Project root directory which will get initialized
 * @param opts Extra options to pass to initialize
 */
export const initialize = async (
  rootProjectPath: string,
  opts?: {
    monoRepo: boolean;
    packagesDir?: string;
    defaultRing?: string;
    variableGroups?: string[];
  }
) => {
  const {
    monoRepo = false,
    packagesDir = "packages",
    defaultRing,
    variableGroups = []
  } = opts || {};
  const absProjectRoot = path.resolve(rootProjectPath);
  logger.info(
    `Initializing project ${absProjectRoot} as a ${
      monoRepo ? "mono-repository" : "standard service repository"
    }`
  );

  // Get a list of the target paths to initialize
  let absPackagePaths = [absProjectRoot];
  if (monoRepo) {
    const absPackagesDir = path.join(absProjectRoot, packagesDir);
    const filesAndFolders = await ls(absPackagesDir);
    absPackagePaths = filesAndFolders
      .map(fileOrFolder =>
        path.resolve(path.join(absPackagesDir, fileOrFolder))
      )
      .filter(f => fs.statSync(f).isDirectory());
  }

  // Initialize all paths
  await generateBedrockFile(
    absProjectRoot,
    absPackagePaths,
    defaultRing ? [defaultRing] : []
  );
  await generateMaintainersFile(absProjectRoot, absPackagePaths);
  await generateHldLifecyclePipelineYaml(absProjectRoot);

  const gitIgnoreFileContent = "spk.log";

  for (const absPackagePath of absPackagePaths) {
    await generateStarterAzurePipelinesYaml(absProjectRoot, absPackagePath, {
      variableGroups
    });
    generateGitIgnoreFile(absPackagePath, gitIgnoreFileContent);
    generateDockerfile(absPackagePath);
  }

  logger.info(`Project initialization complete!`);
};

/**
 * Helper function for listing files/dirs in a path
 *
 * @param dir path-like string; what you would pass to ls in bash
 */
const ls = async (dir: string): Promise<string[]> => {
  const lsRet = shelljs.ls(dir);
  if (lsRet.code !== 0) {
    logger.error(lsRet.stderr);
    throw new Error(
      `Error listing files in ${dir}; Ensure this directory exists or specify a different one with the --packages-dir option.`
    );
  }

  // Returned object includes piping functions as well; strings represent the actual output of the function
  const filesAndDirectories = lsRet.filter(out => typeof out === "string");

  return filesAndDirectories;
};

/**
 * Writes out a default maintainers.yaml file
 *
 * @param projectPath Path to generate the maintainers.yaml file
 */
const generateMaintainersFile = async (
  projectPath: string,
  packagePaths: string[]
) => {
  const absProjectPath = path.resolve(projectPath);
  const absPackagePaths = packagePaths.map(p => path.resolve(p));
  logger.info(`Generating maintainers.yaml file in ${absProjectPath}`);

  // Get default name/email from git host
  const [gitName, gitEmail] = await Promise.all(
    ["name", "email"].map(async field => {
      try {
        const gitField = await exec("git", ["config", `user.${field}`]);
        return gitField;
      } catch (_) {
        logger.warn(
          `Unable to parse git.${field} from host. Leaving blank value in maintainers.yaml file`
        );
        return "";
      }
    })
  );

  // Populate maintainers file
  const maintainersFile: IMaintainersFile = absPackagePaths.reduce<
    IMaintainersFile
  >(
    (file, absPackagePath) => {
      const relPathToPackageFromRoot = path.relative(
        absProjectPath,
        absPackagePath
      );
      // Root should use the value from reduce init
      if (relPathToPackageFromRoot !== "") {
        file.services["./" + relPathToPackageFromRoot] = {
          maintainers: [{ email: "", name: "" }]
        };
      }

      return file;
    },
    {
      services: {
        // initialize with the root containing the credentials of the caller
        "./": {
          maintainers: [
            {
              email: gitEmail,
              name: gitName
            }
          ]
        }
      }
    }
  );

  // Check if a maintainer.yaml already exists; skip write if present
  const maintainersFilePath = path.join(absProjectPath, "maintainers.yaml");
  logger.debug(`Writing maintainers.yaml file to ${maintainersFilePath}`);
  if (fs.existsSync(maintainersFilePath)) {
    logger.warn(
      `Existing maintainers.yaml found at ${maintainersFilePath}, skipping generation`
    );
  } else {
    // Write out
    write(maintainersFile, absProjectPath);
  }
};

/**
 * Writes out a default bedrock.yaml
 *
 * @param targetPath Path to generate the the bedrock.yaml file in
 */
const generateBedrockFile = async (
  projectPath: string,
  packagePaths: string[],
  defaultRings: string[] = []
) => {
  const absProjectPath = path.resolve(projectPath);
  const absPackagePaths = packagePaths.map(p => path.resolve(p));
  logger.info(`Generating bedrock.yaml file in ${absProjectPath}`);

  // Populate bedrock file
  const bedrockFile: IBedrockFile = absPackagePaths.reduce<IBedrockFile>(
    (file, absPackagePath) => {
      const relPathToPackageFromRoot = path.relative(
        absProjectPath,
        absPackagePath
      );

      const helm: IHelmConfig = {
        chart: {
          branch: "",
          git: "",
          method: "git",
          path: ""
        }
      };

      file.services["./" + relPathToPackageFromRoot] = {
        helm
      };
      return file;
    },
    {
      rings: defaultRings.reduce<{ [ring: string]: { isDefault: boolean } }>(
        (defaults, ring) => {
          defaults[ring] = { isDefault: true };
          return defaults;
        },
        {}
      ),
      services: {}
    }
  );

  // Check if a bedrock.yaml already exists; skip write if present
  const bedrockFilePath = path.join(absProjectPath, "bedrock.yaml");

  try {
    logger.debug(
      `Existing bedrock.yaml found at ${bedrockFilePath}, updating with generated services and rings`
    );
    // File might have been created by `project create-variable-group` command to store variable group names for the project
    const existingFile = Bedrock();
    if (existingFile.variableGroups) {
      bedrockFile.variableGroups = existingFile.variableGroups;
    }
  } catch (err) {
    logger.debug(`Writing bedrock.yaml file to ${bedrockFilePath}`);
  }

  // Write out
  write(bedrockFile, absProjectPath);
};
