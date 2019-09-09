import commander from "commander";
import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import shell from "shelljs";
import { promisify } from "util";
import { logger } from "../logger";
import { IBedrockFile, IMaintainersFile } from "../types";

/**
 * Adds the init command to the commander command object
 *
 * @param command Commander command object to decorate
 */
export const initCommand = (command: commander.Command): void => {
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
    .action(async opts => {
      const { monoRepo = false, packagesDir = "packages" } = opts;
      const projectPath = process.cwd();
      try {
        // Type check all parsed command line args here.
        if (typeof monoRepo !== "boolean") {
          throw new Error(
            `monoRepo must be of type boolean, ${typeof monoRepo} given.`
          );
        }
        if (typeof packagesDir !== "string") {
          throw new Error(
            `packagesDir must be of type 'string', ${typeof packagesDir} given.`
          );
        }
        await initialize(projectPath, { monoRepo, packagesDir });
      } catch (err) {
        logger.error(
          `Error occurred while initializing project ${projectPath}`
        );
        logger.error(err);
      }
    });
};

/**
 * Initializes the `rootProject` with a bedrock.yaml, maintainers.yaml, and azure-pipelines.yaml file
 * If opts.monoRepo == true, the root directly will be initialized as a mono-repo
 * If opts.monoRepo == true, all direct subdirectories under opts.packagesDir will be initialized as individual projects
 *
 * @param rootProject Project root directory which will get initialized
 * @param opts Extra options to pass to initialize
 */
export const initialize = async (
  rootProject: string,
  opts?: { monoRepo: boolean; packagesDir?: string }
) => {
  const { monoRepo = false, packagesDir = "packages" } = opts || {};
  logger.info(
    `Initializing project ${rootProject}${monoRepo ? " as a mono-repo" : ""}`
  );

  // Get a list of the target paths to initialize
  let projectPaths = [path.resolve(rootProject)];
  if (monoRepo) {
    const packages = path.join(rootProject, packagesDir);
    const lsRet = shell.ls(packages);
    if (lsRet.code !== 0) {
      throw new Error(`Error parsing listing files in ${packages}`);
    }

    projectPaths = lsRet
      .map(p => path.join(rootProject, packagesDir, p))
      .filter(out => typeof out === "string" && fs.statSync(out).isDirectory());
  }

  // Initialize all paths
  for (const projectPath of projectPaths) {
    await Promise.all([
      generateBedrockFile(projectPath),
      generateMaintainersFile(projectPath),
      generateAzurePipelinesYaml(projectPath)
    ]);
  }

  logger.info(`Project initialization complete!`);
};

/**
 * Writes out a default maintainers.yaml file
 *
 * @param targetPath Path to generate the maintainers.yaml file
 */
const generateMaintainersFile = async (targetPath: string = "") => {
  const absPath = path.resolve(targetPath);
  logger.info(`Generating maintainers.yaml file in ${absPath}`);

  // Get default name/email from git host
  const [gitName, gitEmail] = await Promise.all(
    ["name", "email"].map(field => {
      return new Promise<string>(resolve => {
        shell.exec(
          `git config user.${field}`,
          { silent: true },
          (code, stdout) => {
            if (code === 0) {
              return resolve(stdout.trim());
            }
            logger.warn(
              `Unable to parse git.${field} from host. Leaving blank value in maintainers.yaml file`
            );
            return resolve("");
          }
        );
      });
    })
  );

  // Populate maintainers file
  const maintainersFile: IMaintainersFile = {
    maintainers: [
      {
        email: gitEmail,
        name: gitName
      }
    ]
  };

  // Check if a maintainer.yaml already exists; skip write if present
  const maintainersFilePath = path.join(absPath, "maintainers.yaml");
  logger.debug(`Writing maintainers.yaml file to ${maintainersFilePath}`);
  if (fs.existsSync(maintainersFilePath)) {
    logger.warn(
      `Existing maintainers.yaml found at ${maintainersFilePath}, skipping generation`
    );
  } else {
    // Write out
    await promisify(fs.writeFile)(
      maintainersFilePath,
      yaml.safeDump(maintainersFile),
      "utf8"
    );
  }
};

/**
 * Writes out a default bedrock.yaml
 *
 * @param targetPath Path to generate the the bedrock.yaml file in
 */
const generateBedrockFile = async (targetPath: string = "") => {
  const absPath = path.resolve(targetPath);
  logger.info(`Generating bedrock.yaml file in ${absPath}`);

  // Populate bedrock file
  const bedrockFile: IBedrockFile = {
    helm: { chart: { git: "", branch: "", path: "" } }
  };

  // Check if a bedrock.yaml already exists; skip write if present
  const bedrockFilePath = path.join(absPath, "bedrock.yaml");
  logger.debug(`Writing bedrock.yaml file to ${bedrockFilePath}`);
  if (fs.existsSync(bedrockFilePath)) {
    logger.warn(
      `Existing bedrock.yaml found at ${bedrockFilePath}, skipping generation`
    );
  } else {
    // Write out
    await promisify(fs.writeFile)(
      bedrockFilePath,
      yaml.safeDump(bedrockFile),
      "utf8"
    );
  }
};

/**
 * Writes out the starter azure-pipelines.yaml file to `targetPath`
 *
 * @param targetPath Path to write the azure-pipelines.yaml file to
 */
const generateAzurePipelinesYaml = async (targetPath: string = "") => {
  const absTargetPath = path.resolve(targetPath);
  logger.info(`Generating starter azure-pipelines.yaml in ${absTargetPath}`);

  // Check if azure-pipelines.yaml already exists; if it does, skip generation
  const azurePipelinesYamlPath = path.join(
    absTargetPath,
    "azure-pipelines.yaml"
  );
  logger.debug(
    `Writing azure-pipelines.yaml file to ${azurePipelinesYamlPath}`
  );
  if (fs.existsSync(azurePipelinesYamlPath)) {
    logger.warn(
      `Existing azure-pipelines.yaml found at ${azurePipelinesYamlPath}, skipping generation`
    );
  } else {
    const starterYaml = await starterAzurePipelines({
      relProjectPaths: [path.relative(process.cwd(), absTargetPath)]
    });
    // Write
    await promisify(fs.writeFile)(azurePipelinesYamlPath, starterYaml, "utf8");
  }
};

/**
 * Returns a starter azure-pipelines.yaml string
 * Starter azure-pipelines.yaml based on: https://github.com/andrebriggs/monorepo-example/blob/master/service-A/azure-pipelines.yml
 *
 * @param opts Template options to pass to the the starter yaml
 */
const starterAzurePipelines = async (opts: {
  relProjectPaths?: string[];
  vmImage?: string;
  branches?: string[];
  varGroups?: string[];
}) => {
  const {
    relProjectPaths = ["."],
    vmImage = "ubuntu-latest",
    branches = ["master"],
    varGroups = []
  } = opts;

  // Helper to concat list of script commands to a multi line string
  const generateYamlScript = (lines: string[]): string => lines.join("\n");

  // Ensure any blank paths are turned into "./"
  const cleanedPaths = relProjectPaths.map(p => (p === "" ? "./" : p));

  // based on https://github.com/andrebriggs/monorepo-example/blob/master/service-A/azure-pipelines.yml
  const starter = {
    trigger: {
      branches: { include: branches },
      paths: { include: cleanedPaths }
    },
    variables: {
      group: varGroups
    },
    pool: {
      vmImage
    },
    steps: [
      {
        displayName: "Run a multi-line script",
        script: generateYamlScript([
          `printenv | sort`,
          `pwd`,
          `ls -la`,
          `echo "The name of this service is: $(BUILD.BUILDNUMBER)"`
        ])
      },
      {
        displayName: "Azure Login",
        script: generateYamlScript([
          `echo "az login --service-principal --username $(SP_APP_ID) --password $(SP_PASS) --tenant $(SP_TENANT)"`,
          `az login --service-principal --username "$(SP_APP_ID)" --password "$(SP_PASS)" --tenant "$(SP_TENANT)"`
        ])
      },
      ...cleanedPaths.map(projectPath => {
        return {
          displayName: "ACR Build and Publish",
          script: generateYamlScript([
            `cd ${projectPath} #Hardcoded path. Need to make sure Build.DefinitionName matches directory. It's case sensitive`,
            `echo "az acr build -r $(ACR_NAME) --image $(Build.DefinitionName):$(build.SourceBranchName)-$(build.BuildId) ."`,
            `az acr build -r $(ACR_NAME) --image $(Build.DefinitionName):$(build.SourceBranchName)-$(build.BuildId) .`
          ])
        };
      }),
      {
        displayName: "Run a one-line script",
        script: generateYamlScript([`echo Hello, world!`])
      }
    ]
  };

  return yaml.safeDump(starter, { lineWidth: Number.MAX_SAFE_INTEGER });
};
