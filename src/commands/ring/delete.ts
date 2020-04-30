import commander from "commander";
import * as bedrock from "../../lib/bedrockYaml";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { updateTriggerBranchesForServiceBuildAndUpdatePipeline } from "../../lib/fileutils";
import { hasValue } from "../../lib/validator";
import { logger } from "../../logger";
import { BedrockFileInfo } from "../../types";
import decorator from "./delete.decorator.json";
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";

/**
 * Check the bedrock.yaml and the target ring exists
 * @param projectPath
 */
export const checkDependencies = (projectPath: string): void => {
  const fileInfo: BedrockFileInfo = bedrock.fileInfo(projectPath);
  if (fileInfo.exist === false) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "ring-delete-cmd-err-dependency"
    );
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
  try {
    if (!hasValue(ringName)) {
      throw buildError(
        errorStatusCode.VALIDATION_ERR,
        "ring-delete-cmd-err-name-missing"
      );
    }

    logger.info(`Project path: ${projectPath}`);

    // Check if bedrock config exists, if not, warn and exit
    checkDependencies(projectPath);

    // Remove the ring
    const bedrockConfig = bedrock.read(projectPath);
    const bedrockWithoutRing = bedrock.removeRing(bedrockConfig, ringName);

    // Write out the updated bedrock.yaml
    bedrock.create(projectPath, bedrockWithoutRing);

    // Delete ring from all linked service build pipelines' branch triggers
    const ringBranches = Object.entries(bedrockConfig.rings).map(
      ([ring, config]) => config.targetBranch || ring
    );
    for (const { path: servicePath } of bedrockConfig.services) {
      updateTriggerBranchesForServiceBuildAndUpdatePipeline(
        ringBranches,
        servicePath
      );
    }

    logger.info(`Successfully deleted ring: ${ringName} from this project!`);
    await exitFn(0);
  } catch (err) {
    logError(
      // cannot include ring name in error message because it may not be defined.
      buildError(errorStatusCode.EXE_FLOW_ERR, "ring-delete-cmd-failed", err)
    );
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
