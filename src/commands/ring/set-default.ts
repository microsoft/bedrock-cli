import commander from "commander";
import {
  fileInfo as bedrockFileInfo,
  read as loadBedrockFile,
  setDefaultRing,
} from "../../lib/bedrockYaml";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { hasValue } from "../../lib/validator";
import { logger } from "../../logger";
import { BedrockFileInfo } from "../../types";
import decorator from "./set-default.decorator.json";
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";

/**
 * Check for bedrock.yaml
 * @param projectPath
 */
export const checkDependencies = (projectPath: string): void => {
  const fileInfo: BedrockFileInfo = bedrockFileInfo(projectPath);
  if (fileInfo.exist === false) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "ring-set-default-cmd-err-dependency"
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
  if (!hasValue(ringName)) {
    await exitFn(1);
    return;
  }

  try {
    logger.info(`Project path: ${projectPath}`);

    checkDependencies(projectPath);

    // Get bedrock.yaml
    const bedrockFile = loadBedrockFile(projectPath);
    setDefaultRing(bedrockFile, ringName, projectPath);

    logger.info(`Successfully set default ring: ${ringName} for this project!`);
    await exitFn(0);
  } catch (err) {
    logError(
      buildError(
        errorStatusCode.EXE_FLOW_ERR,
        {
          errorKey: "ring-set-default-cmd-failed",
          values: [ringName],
        },
        err
      )
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
