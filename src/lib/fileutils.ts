import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import { promisify } from "util";
import { logger } from "../logger";
import { IAzurePipelinesYaml, IBedrockFile, IMaintainersFile } from "../types";

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
            `cd ${projectPath} # Need to make sure Build.DefinitionName matches directory. It's case sensitive`,
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
