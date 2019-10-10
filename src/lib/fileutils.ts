import fs from "fs";
import yaml from "js-yaml";

import path from "path";
import { promisify } from "util";
import { logger } from "../logger";
import {
  IAzurePipelinesYaml,
  IBedrockFile,
  IHelmConfig,
  IMaintainersFile,
  IUser
} from "../types";

/**
 * Writes out the starter azure-pipelines.yaml file to `targetPath`
 *
 * @param targetPath Path to write the azure-pipelines.yaml file to
 */
export const generateAzurePipelinesYaml = async (
  projectRoot: string,
  packagePath: string
) => {
  const absProjectRoot = path.resolve(projectRoot);
  const absPackagePath = path.resolve(packagePath);

  logger.info(`Generating starter azure-pipelines.yaml in ${absPackagePath}`);

  // Check if azure-pipelines.yaml already exists; if it does, skip generation
  const azurePipelinesYamlPath = path.join(
    absPackagePath,
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
      relProjectPaths: [path.relative(absProjectRoot, absPackagePath)]
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
  const cleanedPaths = relProjectPaths
    .map(p => (p === "" ? "./" : p))
    .map(p => (p.startsWith("./") === false ? "./" + p : p));

  // based on https://github.com/andrebriggs/monorepo-example/blob/master/service-A/azure-pipelines.yml
  // tslint:disable: object-literal-sort-keys
  const starter: IAzurePipelinesYaml = {
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
        script: generateYamlScript([
          `printenv | sort`,
          `pwd`,
          `ls -la`,
          `echo "The name of this service is: $(BUILD.BUILDNUMBER)"`
        ]),
        displayName: "Run a multi-line script"
      },
      {
        script: generateYamlScript([
          `echo "az login --service-principal --username $(SP_APP_ID) --password $(SP_PASS) --tenant $(SP_TENANT)"`,
          `az login --service-principal --username "$(SP_APP_ID)" --password "$(SP_PASS)" --tenant "$(SP_TENANT)"`
        ]),
        displayName: "Azure Login"
      },
      ...cleanedPaths.map(projectPath => {
        return {
          script: generateYamlScript([
            `cd ${projectPath} # Need to make sure Build.DefinitionName matches directory. It's case sensitive`,
            `echo "az acr build -r $(ACR_NAME) --image $(Build.DefinitionName):$(build.SourceBranchName)-$(build.BuildId) ."`,
            `az acr build -r $(ACR_NAME) --image $(Build.DefinitionName):$(build.SourceBranchName)-$(build.BuildId) .`
          ]),
          displayName: "ACR Build and Publish"
        };
      }),
      {
        script: generateYamlScript([`echo Hello, world!`]),
        displayName: "Run a one-line script"
      }
    ]
  };
  // tslint:enable: object-literal-sort-keys

  return yaml.safeDump(starter, { lineWidth: Number.MAX_SAFE_INTEGER });
};

/**
 * Update maintainers.yml with new service
 *
 * TODO: support for contributors(?)
 *
 * @param maintainersFilePath
 * @param newServicePath
 * @param serviceMaintainers
 */
export const addNewServiceToMaintainersFile = (
  maintainersFilePath: string,
  newServicePath: string,
  serviceMaintainers: IUser[]
) => {
  const maintainersFile = yaml.safeLoad(
    fs.readFileSync(maintainersFilePath, "utf8")
  ) as IMaintainersFile;

  maintainersFile.services["./" + newServicePath] = {
    maintainers: serviceMaintainers
  };

  logger.info("Updating maintainers.yaml");
  fs.writeFileSync(maintainersFilePath, yaml.safeDump(maintainersFile), "utf8");
};

/**
 * Writes out a default .gitignore file if one doesn't exist
 *
 * @param targetDirectory directory to generate the .gitignore file
 * @param content content of file
 */
export const generateGitIgnoreFile = (
  targetDirectory: string,
  content: string
) => {
  const absTargetPath = path.resolve(targetDirectory);
  logger.info(`Generating starter .gitignore in ${absTargetPath}`);

  const gitIgnoreFilePath = path.join(absTargetPath, ".gitignore");

  if (fs.existsSync(gitIgnoreFilePath)) {
    logger.warn(
      `Existing .gitignore found at ${gitIgnoreFilePath}, skipping generation`
    );

    return;
  }

  logger.info(`Writing .gitignore file to ${gitIgnoreFilePath}`);
  fs.writeFileSync(gitIgnoreFilePath, content, "utf8");
};

/**
 * Update bedrock.yml with new service
 *
 * @param bedrockFilePath
 * @param newServicePath
 */
export const addNewServiceToBedrockFile = (
  bedrockFilePath: string,
  newServicePath: string,
  helmConfig: IHelmConfig
) => {
  const bedrockFile = yaml.safeLoad(
    fs.readFileSync(bedrockFilePath, "utf8")
  ) as IBedrockFile;

  bedrockFile.services["./" + newServicePath] = {
    helm: helmConfig
  };

  logger.info("Updating bedrock.yaml");
  fs.writeFileSync(bedrockFilePath, yaml.safeDump(bedrockFile), "utf8");
};
