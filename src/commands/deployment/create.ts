import commander from "commander";
import {
  addSrcToACRPipeline,
  DeploymentTable,
  updateACRToHLDPipeline,
  updateHLDToManifestPipeline,
  updateManifestCommitId,
} from "../../lib/azure/deploymenttable";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { hasValue } from "../../lib/validator";
import { logger } from "../../logger";
import decorator from "./create.decorator.json";
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";

/**
 * Command Line values from the commander
 */
export interface CommandOptions {
  accessKey: string | undefined;
  commitId: string | undefined;
  env: string | undefined;
  hldCommitId: string | undefined;
  imageTag: string | undefined;
  manifestCommitId: string | undefined;
  name: string | undefined;
  p1: string | undefined;
  p2: string | undefined;
  p3: string | undefined;
  pr: string | undefined;
  partitionKey: string | undefined;
  service: string | undefined;
  tableName: string | undefined;
  repository: string | undefined;
}

export interface CreateConfig {
  accessKey: string;
  name: string;
  partitionKey: string;
  tableName: string;
}

/**
 * Validates that the required values are provided.
 *
 * @param opts values from commander
 */
export const validateValues = (opts: CommandOptions): CreateConfig => {
  if (
    !hasValue(opts.accessKey) ||
    !hasValue(opts.name) ||
    !hasValue(opts.partitionKey) ||
    !hasValue(opts.tableName)
  ) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "introspect-create-cmd-missing-values"
    );
  }

  return {
    accessKey: opts.accessKey,
    name: opts.name,
    partitionKey: opts.partitionKey,
    tableName: opts.tableName,
  };
};

export const handlePipeline1 = async (
  tableInfo: DeploymentTable,
  opts: CommandOptions
): Promise<void> => {
  if (
    !opts.p1 ||
    !hasValue(opts.imageTag) ||
    !hasValue(opts.commitId) ||
    !hasValue(opts.service)
  ) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "introspect-create-cmd-p1-missing-values"
    );
  }
  await addSrcToACRPipeline(
    tableInfo,
    opts.p1,
    opts.imageTag,
    opts.service,
    opts.commitId,
    opts.repository
  );
};

export const handlePipeline2 = async (
  tableInfo: DeploymentTable,
  opts: CommandOptions
): Promise<void> => {
  if (
    !opts.p2 ||
    !hasValue(opts.hldCommitId) ||
    !hasValue(opts.env) ||
    !hasValue(opts.imageTag)
  ) {
    throw buildError(
      errorStatusCode.VALIDATION_ERR,
      "introspect-create-cmd-p2-missing-values"
    );
  }
  await updateACRToHLDPipeline(
    tableInfo,
    opts.p2,
    opts.imageTag,
    opts.hldCommitId,
    opts.env,
    opts.pr,
    opts.repository
  );
};

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
  try {
    const config = validateValues(opts);

    const tableInfo: DeploymentTable = {
      accountKey: config.accessKey,
      accountName: config.name,
      partitionKey: config.partitionKey,
      tableName: config.tableName,
    };

    if (hasValue(opts.p1)) {
      await handlePipeline1(tableInfo, opts);
    } else if (hasValue(opts.p2)) {
      await handlePipeline2(tableInfo, opts);
    } else if (hasValue(opts.p3) && hasValue(opts.hldCommitId)) {
      await updateHLDToManifestPipeline(
        tableInfo,
        opts.hldCommitId,
        opts.p3,
        opts.manifestCommitId,
        opts.pr,
        opts.repository
      );
    } else if (hasValue(opts.p3) && hasValue(opts.manifestCommitId)) {
      await updateManifestCommitId(
        tableInfo,
        opts.p3,
        opts.manifestCommitId,
        opts.repository
      );
    } else {
      throw buildError(
        errorStatusCode.VALIDATION_ERR,
        "introspect-create-cmd-no-ops"
      );
    }
    await exitFn(0);
  } catch (err) {
    logError(
      buildError(
        errorStatusCode.CMD_EXE_ERR,
        "introspect-create-cmd-failed",
        err
      )
    );
    await exitFn(1);
  }
};

/**
 * Creates a create command decorator for the command to update a deployment in storage
 * @param command
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async (opts: CommandOptions) => {
    await execute(opts, async (status: number) => {
      await exitCmd(logger, process.exit, status);
    });
  });
};
