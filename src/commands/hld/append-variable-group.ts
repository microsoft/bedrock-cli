import commander from "commander";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { RENDER_HLD_PIPELINE_FILENAME } from "../../lib/constants";
import { appendVariableGroupToPipelineYaml } from "../../lib/fileutils";
import { logger } from "../../logger";
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";
import { hasValue } from "../../lib/validator";
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
  try {
    if (!hasValue(variableGroupName)) {
      throw buildError(
        errorStatusCode.VALIDATION_ERR,
        "hld-append-var-group-name-missing"
      );
    }

    appendVariableGroupToPipelineYaml(
      hldRepoPath,
      RENDER_HLD_PIPELINE_FILENAME,
      variableGroupName
    );
    await exitFn(0);
  } catch (err) {
    logError(
      buildError(
        errorStatusCode.CMD_EXE_ERR,
        "hld-append-var-group-cmd-failed",
        err
      )
    );
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
