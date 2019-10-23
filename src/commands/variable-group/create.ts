import { VariableGroup } from "azure-devops-node-api/interfaces/ReleaseInterfaces";
import commander from "commander";
import fs from "fs";
import { readYaml } from "../../config";
import { IAzureDevOpsOpts } from "../../lib/git";
import {
  addVariableGroup,
  addVariableGroupWithKeyVaultMap
} from "../../lib/pipelines/variableGroup";
import { logger } from "../../logger";
import { IVariableGroupData } from "../../types";

/**
 * Adds the create command to the variable-group command object
 *
 * @param command Commander command object to decorate
 */
export const createCommandDecorator = (command: commander.Command): void => {
  command
    .command("create")
    .alias("c")
    .description("Add a new variable group in Azure DevOps project.")
    .option(
      "-f, --file <variable-group-manifest-file-path>",
      "Path to the yaml file that contains variable group manifest."
    )
    .option(
      "-o, --org-name <organization-name>",
      "Azure DevOps organization name; falls back to azure_devops.org in spk config"
    )
    .option(
      "-p, --project <project>",
      "Azure DevOps project name; falls back to azure_devops.project in spk config"
    )
    .option(
      "-t, --personal-access-token <personal-access-token>",
      "Personal access token associated with the Azure DevOps org; falls back to azure_devops.access_token in spk config"
    )
    .action(async opts => {
      try {
        if (!opts.file) {
          logger.error(
            "You need to specify a file with variable group manifest"
          );
          return;
        }

        const { file, orgName, project, personalAccessToken } = opts;

        logger.debug(
          `opts: ${file}, ${orgName}, ${project}, ${personalAccessToken}`
        );

        // type check
        if (typeof orgName !== "undefined" && typeof orgName !== "string") {
          throw Error(
            `--org-name must be of type 'string', ${typeof orgName} specified.`
          );
        }

        if (typeof project !== "undefined" && typeof project !== "string") {
          throw Error(
            `--project must be of type 'string', ${typeof project} specified.`
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
          project
        };
        logger.debug(`access options: ${JSON.stringify(accessOpts)}`);

        await create(opts.file, accessOpts);

        logger.info(
          "Successfully added a variable group in Azure DevOps project!"
        );
      } catch (err) {
        logger.error(`Error occurred while creating variable group`);
        logger.error(err);
      }
    });
};

/**
 * Loads varible group manifest from a given filename
 *
 * @param filepath file to read manifest
 * @param accessOpts Azure DevOps access options from command options to override spk config
 */
export const create = async (
  filepath: string,
  accessOpts: IAzureDevOpsOpts
) => {
  logger.info("Creating variale group");
  try {
    fs.statSync(filepath);
    const data = readYaml<IVariableGroupData>(filepath);
    logger.debug(`Varible Group Yaml data: ${JSON.stringify(data)}`);

    // validate variable group type

    let variableGroup: VariableGroup;

    if (data.type === "AzureKeyVault") {
      variableGroup = await addVariableGroupWithKeyVaultMap(data, accessOpts);
    } else if (data.type === "Vsts") {
      variableGroup = await addVariableGroup(data, accessOpts);
    } else {
      throw new Error(
        `Varible Group type "${data.type}" is not supported. Only "Vsts" and "AzureKeyVault" are valid types and case sensitive.`
      );
    }
  } catch (err) {
    throw err;
  }
};
