import commander from "commander";
import { read as readBedrockYaml } from "../../lib/bedrockYaml";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { logger } from "../../logger";
import decorator from "./get-display-name.decorator.json";
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";

export interface CommandOptions {
  path: string | undefined;
}

/**
 * Executes the command, can all exit function with 0 or 1
 * when command completed successfully or failed respectively.
 *
 * @param opts validated option values
 * @param exitFn exit function
 */
export const execute = async (
  opts: CommandOptions,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  // The assumption is that this command should be ran from the directory where bedrock.yaml exists
  try {
    if (!opts.path) {
      throw buildError(
        errorStatusCode.VALIDATION_ERR,
        "service-get-display-name-cmd-path-missing-param-err"
      );
    }

    // bedrockFile will always be return
    // it cannot be null or undefined.
    const bedrockFile = readBedrockYaml(process.cwd());

    // bedrockFile.services is an array
    const serviceConfig = bedrockFile.services.find(
      (config) => opts.path === config.path
    );

    if (serviceConfig) {
      console.log(serviceConfig.displayName);
      await exitFn(0);
    } else {
      throw buildError(errorStatusCode.ENV_SETTING_ERR, {
        errorKey: "service-get-display-name-cmd-service-name-not-found-err",
        values: [opts.path],
      });
    }
  } catch (err) {
    logError(
      buildError(
        errorStatusCode.VALIDATION_ERR,
        "service-get-display-name-cmd-failed",
        err
      )
    );
    await exitFn(1);
  }
};

/**
 * Adds the get-display-name command to the commander command object
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: CommandOptions) => {
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
