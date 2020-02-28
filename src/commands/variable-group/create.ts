import commander from "commander";
import fs from "fs";
import path from "path";
import { readYaml } from "../../config";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import { IAzureDevOpsOpts } from "../../lib/git";
import {
  addVariableGroup,
  addVariableGroupWithKeyVaultMap
} from "../../lib/pipelines/variableGroup";
import { logger } from "../../logger";
import { IVariableGroupData } from "../../types";
import decorator from "./create.decorator.json";

/**
 * Adds the create command to the variable-group command object
 *
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(async opts => {
    try {
      if (!opts.file) {
        throw new Error(
          "You need to specify a file with variable group manifest"
        );
      }

      const { file, orgName, devopsProject, personalAccessToken } = opts;

      logger.debug(
        `opts: ${file}, ${orgName}, ${devopsProject}, ${personalAccessToken}`
      );

      // type check
      if (typeof orgName !== "undefined" && typeof orgName !== "string") {
        throw Error(
          `--org-name must be of type 'string', ${typeof orgName} specified.`
        );
      }

      if (
        typeof devopsProject !== "undefined" &&
        typeof devopsProject !== "string"
      ) {
        throw Error(
          `--devops-project must be of type 'string', ${typeof devopsProject} specified.`
        );
      }

      if (
        typeof personalAccessToken !== "undefined" &&
        typeof personalAccessToken !== "string"
      ) {
        throw Error(
          `--personal-access-token must be of type 'string', ${typeof personalAccessToken} specified.`
        );
      }

      const accessOpts: IAzureDevOpsOpts = {
        orgName,
        personalAccessToken,
        project: devopsProject
      };
      logger.debug(`access options: ${JSON.stringify(accessOpts)}`);

      await create(opts.file, accessOpts);

      logger.info(
        "Successfully added a variable group in Azure DevOps project!"
      );
      await exitCmd(logger, process.exit, 0);
    } catch (err) {
      logger.error(`Error occurred while creating variable group`);
      logger.error(err);
      await exitCmd(logger, process.exit, 1);
    }
  });
};

/**
 * Loads variable group manifest from a given filename
 *
 * @param filepath file to read manifest
 * @param accessOpts Azure DevOps access options from command options to override spk config
 */
export const create = async (
  filepath: string,
  accessOpts: IAzureDevOpsOpts
) => {
  logger.info(
    `Creating Variable Group from group definition '${path.resolve(filepath)}'`
  );

  fs.statSync(filepath);
  const data = readYaml<IVariableGroupData>(filepath);
  logger.debug(`Variable Group Yaml data: ${JSON.stringify(data)}`);

  // validate variable group type
  if (data.type === "AzureKeyVault") {
    await addVariableGroupWithKeyVaultMap(data, accessOpts);
  } else if (data.type === "Vsts") {
    await addVariableGroup(data, accessOpts);
  } else {
    throw new Error(
      `Variable Group type "${data.type}" is not supported. Only "Vsts" and "AzureKeyVault" are valid types and case sensitive.`
    );
  }
};
