/* eslint-disable @typescript-eslint/no-use-before-define */
import commander from "commander";
import {
  addNewRing,
  fileInfo as bedrockFileInfo,
  read as loadBedrockFile
} from "../../lib/bedrockYaml";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import {
  BEDROCK_FILENAME,
  PROJECT_INIT_DEPENDENCY_ERROR_MESSAGE
} from "../../lib/constants";
import { updateTriggerBranchesForServiceBuildAndUpdatePipeline } from "../../lib/fileutils";
import * as dns from "../../lib/net/dns";
import { hasValue } from "../../lib/validator";
import { logger } from "../../logger";
import { BedrockFile, BedrockFileInfo } from "../../types";
import decorator from "./create.decorator.json";

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
    logger.error(`No ring name given.`);
    await exitFn(1);
    return;
  }

  try {
    logger.info(`Project path: ${projectPath}`);

    dns.assertIsValid("<ring-name>", ringName);
    checkDependencies(projectPath, ringName);

    // Add ring to bedrock.yaml
    addNewRing(projectPath, ringName);
    // Add ring to all linked service build pipelines' branch triggers
    const bedrockFile: BedrockFile = loadBedrockFile(projectPath);

    const newRings = Object.entries(bedrockFile.rings).map(([ring]) => ring);
    logger.info(`Updated project rings: ${newRings}`);

    const servicePathDirectories = Object.entries(bedrockFile.services).map(
      ([serviceRelativeDir]) => serviceRelativeDir
    );

    servicePathDirectories.forEach(s => {
      updateTriggerBranchesForServiceBuildAndUpdatePipeline(newRings, s);
    });

    logger.info(`Successfully created ring: ${ringName} for this project!`);
    await exitFn(0);
  } catch (err) {
    logger.error(`Error occurred while creating ring: ${ringName}`);
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
export const checkDependencies = (
  projectPath: string,
  ringName: string
): void => {
  const fileInfo: BedrockFileInfo = bedrockFileInfo(projectPath);
  if (fileInfo.exist === false) {
    throw new Error(PROJECT_INIT_DEPENDENCY_ERROR_MESSAGE);
  }

  // Check if ring already exists, if it does, warn and exit
  const bedrockFile: BedrockFile = loadBedrockFile(projectPath);
  if (ringName in bedrockFile.rings) {
    throw new Error(
      `ring: ${ringName} already exists in project ${BEDROCK_FILENAME}.`
    );
  }
};
