import commander from "commander";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { RENDER_HLD_PIPELINE_FILENAME } from "../../lib/constants";
import { appendVariableGroupToPipelineYaml } from "../../lib/fileutils";
import { logger } from "../../logger";
import decorator from "./append-variable-group.decorator.json";

/**
 * Executes the command, can call exit function with 0 or 1
 * when command completed successfully or failed respectively.
 *
 * @param hldRepoPath The hld repository path
 * @param variableGroupName The variable group name
 * @param exitFn exit function
 */
export const execute = async (
  hldRepoPath: string,
  variableGroupName: string,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  if (!variableGroupName) {
    logger.error("Variable group name is missing.");
    await exitFn(1);
    return;
  }

  try {
    appendVariableGroupToPipelineYaml(
      hldRepoPath,
      RENDER_HLD_PIPELINE_FILENAME,
      variableGroupName
    );
    await exitFn(0);
  } catch (err) {
    logger.error(`Error occurred while appending variable group.`);
    logger.error(err);
    await exitFn(1);
  }
};

/**
 * Adds the init command to the commander command object
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (variableGroupName: string) => {
    const hldRepoPath = process.cwd();
    await execute(hldRepoPath, variableGroupName, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
