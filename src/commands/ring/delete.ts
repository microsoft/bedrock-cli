import commander from "commander";
import { fileInfo as bedrockFileInfo } from "../../lib/bedrockYaml";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { PROJECT_INIT_DEPENDENCY_ERROR_MESSAGE } from "../../lib/constants";
import { hasValue } from "../../lib/validator";
import { logger } from "../../logger";
import { IBedrockFileInfo } from "../../types";

import decorator from "./delete.decorator.json";

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
) => {
  if (!hasValue(ringName)) {
    await exitFn(1);
    return;
  }

  try {
    logger.info(`Project path: ${projectPath}`);

    checkDependencies(projectPath);

    // Check if ring exists, if not, warn and exit
    // Check if ring is default, if so, warn "Cannot delete default ring, set a new default via `spk ring set-default` first." and exit
    // Delete ring from bedrock.yaml
    // Delete ring from all linked service build pipelines' branch triggers

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

/**
 * Check for bedrock.yaml
 * @param projectPath
 */
export const checkDependencies = (projectPath: string) => {
  const fileInfo: IBedrockFileInfo = bedrockFileInfo(projectPath);
  if (fileInfo.exist === false) {
    throw new Error(PROJECT_INIT_DEPENDENCY_ERROR_MESSAGE);
  }
};
