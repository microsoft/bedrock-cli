import commander from "commander";
import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import shelljs from "shelljs";
import { promisify } from "util";
import { logger } from "../../logger";
import { generateAzurePipelinesYaml } from "../../lib/fileutils";
import { IBedrockFile, IMaintainersFile } from "../../types";

/**
 * Adds the init command to the commander command object
 *
 * @param command Commander command object to decorate
 */
export const addServiceCommandDecorator = (
  command: commander.Command
): void => {
  command
    .command("add-service <service-name>")
    // .alias("as")
    .description(
      "Add a new service into this initialized spk project repository"
    )
    .option(
      "-m, --maintainer-name <maintainer-name>",
      "The name of the primary maintainer for this service",
      "maintainer name"
    )
    .option(
      "-e, --maintainer-email <maintainer-email>",
      "The email of the primary maintainer for this service",
      "maintainer email"
    )
    .action(async (serviceName, opts) => {
      const {
        maintainerName = "maintainer name",
        maintainerEmail = "maintainer email"
      } = opts;
      const projectPath = process.cwd();
      try {
        // Type check all parsed command line args here.
        if (typeof serviceName !== "string") {
          throw new Error(
            `serviceName must be of type 'string', ${typeof serviceName} given.`
          );
        }
        if (typeof maintainerName !== "string") {
          throw new Error(
            `maintainerName must be of type 'string', ${typeof maintainerName} given.`
          );
        }
        if (typeof maintainerEmail !== "string") {
          throw new Error(
            `maintainerEmail must be of type 'string', ${typeof maintainerEmail} given.`
          );
        }
        await addService(projectPath, serviceName, {
          maintainerName,
          maintainerEmail
        });
      } catch (err) {
        logger.error(
          `Error occurred adding service ${serviceName} to project ${projectPath}`
        );
        logger.error(err);
      }
    });
};

export const addService = async (
  rootProjectPath: string,
  serviceName: string,
  opts?: { maintainerName: string; maintainerEmail: string }
) => {
  const { maintainerName = "name", maintainerEmail = "email" } = opts || {};

  logger.info(`Adding Service: ${serviceName}, to Project: ${rootProjectPath}`);
  logger.info(
    `MaintainerName: ${maintainerName}, MaintainerEmail: ${maintainerEmail}`
  );

  // Mkdir
  const newServiceDir = path.join(rootProjectPath, serviceName);
  shelljs.mkdir("-p", newServiceDir);

  // Create azure pipelines yaml in directory
  await generateAzurePipelinesYaml(rootProjectPath, newServiceDir);

  // add maintainers to file in parent repo file

  // Add relevant bedrock info to parent bedrock.yaml
};
