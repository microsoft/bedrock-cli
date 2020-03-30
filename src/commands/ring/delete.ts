import commander from "commander";
import * as bedrock from "../../lib/bedrockYaml";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { PROJECT_INIT_DEPENDENCY_ERROR_MESSAGE } from "../../lib/constants";
import { updateTriggerBranchesForServiceBuildAndUpdatePipeline } from "../../lib/fileutils";
import { hasValue } from "../../lib/validator";
import { logger } from "../../logger";
import { BedrockFileInfo } from "../../types";
import decorator from "./delete.decorator.json";

/**
 * Check the bedrock.yaml and the target ring exists
 * @param projectPath
 */
export const checkDependencies = (projectPath: string): void => {
  const fileInfo: BedrockFileInfo = bedrock.fileInfo(projectPath);
  if (fileInfo.exist === false) {
    throw Error(PROJECT_INIT_DEPENDENCY_ERROR_MESSAGE);
  }
};

/**
 * Executes the command.
 *
 * @param ringName
 * @param projectPath
 */
export const execute = async (
  ringName: string,
  projectPath: string,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  if (!hasValue(ringName)) {
    await exitFn(1);
    return;
  }

  try {
    logger.info(`Project path: ${projectPath}`);

    // Check if bedrock config exists, if not, warn and exit
    checkDependencies(projectPath);

    // Remove the ring
    const bedrockConfig = bedrock.read(projectPath);
    const bedrockWithoutRing = bedrock.removeRing(bedrockConfig, ringName);

    // Write out the updated bedrock.yaml
    bedrock.create(projectPath, bedrockWithoutRing);

    // Delete ring from all linked service build pipelines' branch triggers
    const ringBranches = Object.keys(bedrockWithoutRing.rings);
    for (const servicePath of Object.keys(bedrockConfig.services)) {
      updateTriggerBranchesForServiceBuildAndUpdatePipeline(
        ringBranches,
        servicePath
      );
    }

    logger.info(`Successfully deleted ring: ${ringName} from this project!`);
    await exitFn(0);
  } catch (err) {
    logger.error(`Error occurred while deleting ring: ${ringName}`);
    logger.error(err);
    await exitFn(1);
  }
};

export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (ringName: string) => {
    await execute(ringName, process.cwd(), async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
