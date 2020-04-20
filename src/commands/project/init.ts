import commander from "commander";
import fs from "fs";
import path from "path";
import { Bedrock, write } from "../../config";
import * as bedrockYaml from "../../lib/bedrockYaml";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import {
  generateGitIgnoreFile,
  generateHldLifecyclePipelineYaml,
  getVersion,
} from "../../lib/fileutils";
import { exec } from "../../lib/shell";
import { logger } from "../../logger";
import { BedrockFile, MaintainersFile } from "../../types";
import decorator from "./init.decorator.json";
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";
import { CLI_LOG_FILENAME } from "../../lib/constants";

// values that we need to pull out from command operator
interface CommandOptions {
  defaultRing: string;
}

/**
 * Writes out a default bedrock.yaml
 *
 * @param targetPath Path to generate the the bedrock.yaml file in
 */
const generateBedrockFile = (
  projectPath: string,
  defaultRings: string[] = []
): void => {
  const absProjectPath = path.resolve(projectPath);
  logger.info(`Generating bedrock.yaml file in ${absProjectPath}`);

  const baseBedrockFile: BedrockFile = {
    rings: defaultRings.reduce<{ [ring: string]: { isDefault: boolean } }>(
      (defaults, ring) => {
        defaults[ring] = { isDefault: true };
        return defaults;
      },
      {}
    ),
    services: [],
    version: getVersion(),
  };

  // Check if a bedrock.yaml already exists; skip write if present
  const bedrockFilePath = path.join(absProjectPath, "bedrock.yaml");
  if (fs.existsSync(bedrockFilePath)) {
    logger.warn(
      `Existing bedrock.yaml found at ${bedrockFilePath}, skipping generation`
    );
  } else {
    // Write out
    bedrockYaml.create(absProjectPath, baseBedrockFile);
  }
};

/**
 * Writes out a default maintainers.yaml file
 *
 * @param projectPath Path to generate the maintainers.yaml file
 */
const generateMaintainersFile = async (
  projectPath: string,
  packagePaths: string[]
): Promise<void> => {
  const absProjectPath = path.resolve(projectPath);
  const absPackagePaths = packagePaths.map((p) => path.resolve(p));
  logger.info(`Generating maintainers.yaml file in ${absProjectPath}`);

  // Get default name/email from git host
  const [gitName, gitEmail] = await Promise.all(
    ["name", "email"].map(async (field) => {
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
  const maintainersFile: MaintainersFile = absPackagePaths.reduce<
    MaintainersFile
  >(
    (file, absPackagePath) => {
      const relPathToPackageFromRoot = path.relative(
        absProjectPath,
        absPackagePath
      );
      // Root should use the value from reduce init
      if (relPathToPackageFromRoot !== "") {
        file.services["./" + relPathToPackageFromRoot] = {
          maintainers: [{ email: "", name: "" }],
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
              name: gitName,
            },
          ],
        },
      },
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
 * Initializes the `rootProject` with a bedrock.yaml, maintainers.yaml, and
 * .gitignore
 * If opts.monoRepo == true, the root directly will be initialized as a mono-repo
 * If opts.monoRepo == true, all direct subdirectories under opts.packagesDir will be initialized as individual projects
 *
 * @param rootProjectPath Project root directory which will get initialized
 * @param opts Extra options to pass to initialize
 */
export const initialize = async (
  rootProjectPath: string,
  opts?: CommandOptions
): Promise<void> => {
  const absProjectRoot = path.resolve(rootProjectPath);
  logger.info(`Initializing project Bedrock project ${absProjectRoot}`);

  const defaultRing = opts ? [opts.defaultRing] : [];
  generateBedrockFile(absProjectRoot, defaultRing);
  await generateMaintainersFile(absProjectRoot, []);
  await generateHldLifecyclePipelineYaml(absProjectRoot);
  generateGitIgnoreFile(absProjectRoot, [CLI_LOG_FILENAME]);

  logger.info(`Project initialization complete!`);
};

export const execute = async (
  opts: CommandOptions,
  projectPath: string,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  // defaultRing shall always have value (not undefined nor null)
  // because it has default value as "master"
  const defaultRing = opts.defaultRing;

  try {
    Bedrock(); // TOFIX: Is this to check if Bedrock config exist?
  } catch (err) {
    logger.info(err);
  }

  try {
    await initialize(projectPath, { defaultRing });
    await exitFn(0);
  } catch (err) {
    logError(
      buildError(errorStatusCode.EXE_FLOW_ERR, "project-init-cmd-failed", err)
    );
    await exitFn(1);
  }
};

export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: CommandOptions) => {
    await execute(opts, process.cwd(), async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
