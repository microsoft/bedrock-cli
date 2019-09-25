import commander from "commander";
import path from "path";
import shelljs from "shelljs";
import { logger } from "../../logger";
import { generateAzurePipelinesYaml } from "../../lib/fileutils";

/**
 * Adds the init command to the commander command object
 *
 * @param command Commander command object to decorate
 */
export const createCommandDecorator = (command: commander.Command): void => {
  command
    .command("create <service-name>")
    .alias("c")
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
        await createService(projectPath, serviceName, {
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

/**
 * Create a service in a bedrock project directory.
 *
 * @param rootProjectPath
 * @param serviceName
 * @param opts
 */
export const createService = async (
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
