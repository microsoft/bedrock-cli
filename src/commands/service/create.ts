import { fail } from "assert";
import commander from "commander";
import path from "path";
import shelljs from "shelljs";
import * as sshUrl from "ssh-url";
import { Bedrock } from "../../config";
import {
  addNewService as addNewServiceToBedrockFile,
  fileInfo as bedrockFileInfo,
  YAML_NAME as BedrockFileName,
} from "../../lib/bedrockYaml";
import { build as buildCmd, exit as exitCmd } from "../../lib/commandBuilder";
import {
  PROJECT_CVG_DEPENDENCY_ERROR_MESSAGE,
  PROJECT_INIT_CVG_DEPENDENCY_ERROR_MESSAGE,
} from "../../lib/constants";
import {
  addNewServiceToMaintainersFile,
  generateDockerfile,
  generateGitIgnoreFile,
  generateServiceBuildAndUpdatePipelineYaml,
} from "../../lib/fileutils";
import { checkoutCommitPushCreatePRLink } from "../../lib/gitutils";
import * as dns from "../../lib/net/dns";
import { isPortNumberString } from "../../lib/validator";
import { logger } from "../../logger";
import { BedrockFileInfo, HelmConfig, User } from "../../types";
import decorator from "./create.decorator.json";

export interface CommandOptions {
  gitPush: boolean;
  helmChartChart: string;
  helmChartRepository: string;
  helmConfigAccessTokenVariable: string;
  helmConfigBranch: string;
  helmConfigGit: string;
  helmConfigPath: string;
  k8sBackend: string;
  k8sBackendPort: string;
  maintainerEmail: string;
  maintainerName: string;
  middlewares: string;
  packagesDir: string;
  pathPrefix: string;
  pathPrefixMajorVersion: string;
  serviceBuildVg: string;
  serviceBuildVariables: string;
}

export interface CommandValues extends CommandOptions {
  k8sPort: number;
  middlewaresArray: string[];
  ringNames: string[];
  variableGroups: string[];
  serviceVgArray: string[];
  serviceVariablesArray: string[];
}

export const validUpperUnderscoreCase = (segment: string): boolean => {
  return !!segment.match(/^[A-Z0-9_]+$/);
};

export const fetchValues = (opts: CommandOptions): CommandValues => {
  if (!isPortNumberString(opts.k8sBackendPort)) {
    throw Error("value for --k8s-service-port is not a valid port number");
  }

  const bedrock = Bedrock();
  const variableGroups = bedrock.variableGroups ?? [];
  const rings = Object.keys(bedrock.rings);

  let middlewaresArray: string[] = [];
  if (opts.middlewares && opts.middlewares.trim()) {
    middlewaresArray = opts.middlewares.split(",").map((str) => str.trim());
  }

  let serviceVgArray: string[] = [];
  if (opts.serviceBuildVg && opts.serviceBuildVg.trim()) {
    serviceVgArray = opts.serviceBuildVg.split(",").map((str) => str.trim());
  }

  let serviceVariablesArray: string[] = [];
  if (opts.serviceBuildVariables && opts.serviceBuildVariables.trim()) {
    serviceVariablesArray = opts.serviceBuildVariables
      .split(",")
      .map((str) => str.trim());
  }

  serviceVariablesArray.forEach(function (r) {
    if (!validUpperUnderscoreCase(r)) {
      logger.warn(`${r} is not in a valid format. Valid strings include only uppercases, numbers, and underscores.`);
    }
  });

  const values: CommandValues = {
    gitPush: opts.gitPush,
    helmChartChart: opts.helmChartChart,
    helmChartRepository: opts.helmChartRepository,
    helmConfigAccessTokenVariable: opts.helmConfigAccessTokenVariable,
    helmConfigBranch: opts.helmConfigBranch,
    helmConfigGit: opts.helmConfigGit,
    helmConfigPath: opts.helmConfigPath,
    k8sBackend: opts.k8sBackend,
    k8sBackendPort: opts.k8sBackendPort,
    k8sPort: parseInt(opts.k8sBackendPort, 10),
    maintainerEmail: opts.maintainerEmail,
    maintainerName: opts.maintainerName,
    middlewares: opts.middlewares,
    middlewaresArray,
    packagesDir: opts.packagesDir,
    pathPrefix: opts.pathPrefix,
    pathPrefixMajorVersion: opts.pathPrefixMajorVersion,
    ringNames: rings,
    variableGroups,
    serviceBuildVg: opts.serviceBuildVg,
    serviceVgArray,
    serviceBuildVariables: opts.serviceBuildVariables,
    serviceVariablesArray,
  };

  // Values do not need to be validated
  // as they are mostly provided by Commander.
  return values;
};

export const checkDependencies = (projectPath: string): void => {
  const fileInfo: BedrockFileInfo = bedrockFileInfo(projectPath);
  if (fileInfo.exist === false) {
    throw Error(PROJECT_INIT_CVG_DEPENDENCY_ERROR_MESSAGE);
  } else if (fileInfo.hasVariableGroups === false) {
    throw Error(PROJECT_CVG_DEPENDENCY_ERROR_MESSAGE);
  }
};

/**
 * Validate that the provided ICommandOpts contain RFC1123 compliant values if
 * they are were set by the user
 *
 * @throws {Error} when any of displayName, k8sBackend, pathPrefix,
 *                 pathPrefixMajorVersion are provided and are non-DNS compliant
 */
export const assertValidDnsInputs = (opts: Partial<CommandOptions>): void => {
  if (opts.k8sBackend) {
    dns.assertIsValid("--k8s-backend", opts.k8sBackend);
  }
  if (opts.pathPrefix) {
    dns.assertIsValid("--path-prefix", opts.pathPrefix);
  }
  if (opts.pathPrefixMajorVersion) {
    dns.assertIsValid(
      "--path-prefix-major-version",
      opts.pathPrefixMajorVersion
    );
  }
};

/**
 * Create a service in a bedrock project directory.
 *
 * @param rootProjectPath
 * @param serviceName
 * @param values
 */
export const createService = async (
  rootProjectPath: string,
  serviceName: string,
  servicePath: string,
  values: CommandValues
): Promise<void> => {
  logger.info(
    `Adding Service: ${serviceName}, located at ${servicePath}, to Project: ${rootProjectPath} under directory: ${values.packagesDir}`
  );

  const newServiceDir = path.join(
    rootProjectPath,
    values.packagesDir,
    servicePath
  );
  logger.info(`servicePath: ${newServiceDir}`);

  shelljs.mkdir("-p", newServiceDir);

  // Create azure pipelines yaml in directory
  generateServiceBuildAndUpdatePipelineYaml(
    rootProjectPath,
    values.ringNames,
    serviceName,
    newServiceDir,
    values.variableGroups,
    values.serviceVgArray,
    values.serviceVariablesArray
  );

  // Create empty .gitignore file in directory
  generateGitIgnoreFile(newServiceDir, "");

  // Create simple Dockerfile in directory
  generateDockerfile(newServiceDir);

  // add maintainers to file in parent repo file
  const newUser = {
    email: values.maintainerEmail,
    name: values.maintainerName,
  } as User;

  const newServiceRelativeDir = path.relative(rootProjectPath, newServiceDir);
  logger.debug(`newServiceRelPath: ${newServiceRelativeDir}`);

  addNewServiceToMaintainersFile(
    path.join(rootProjectPath, "maintainers.yaml"),
    newServiceRelativeDir,
    [newUser]
  );

  // Add relevant bedrock info to parent bedrock.yaml

  const helmConfig: HelmConfig =
    values.helmChartChart && values.helmChartRepository
      ? {
          chart: {
            chart: values.helmChartChart,
            repository: values.helmChartRepository,
          },
        }
      : {
          chart: {
            accessTokenVariable: values.helmConfigAccessTokenVariable,
            branch: values.helmConfigBranch,
            git: values.helmConfigGit,
            path: values.helmConfigPath,
          },
        };

  addNewServiceToBedrockFile(
    rootProjectPath,
    newServiceRelativeDir,
    serviceName,
    helmConfig,
    values.middlewaresArray,
    values.k8sPort,
    values.k8sBackend,
    values.pathPrefix,
    values.pathPrefixMajorVersion,
    values.serviceVgArray,
    values.serviceVariablesArray
  );

  // If requested, create new git branch, commit, and push
  if (values.gitPush) {
    await checkoutCommitPushCreatePRLink(
      serviceName,
      newServiceDir,
      path.join(rootProjectPath, BedrockFileName),
      path.join(rootProjectPath, "maintainers.yaml")
    );
  }
};

/**
 * Validates a helm config git URI, if one is provided through the CLI
 * Silently returns if nothing is wrong with it, otherwise errors loudly.
 * @param gitUrl A URL to a helm chart
 * @param exitFn A function to call to exit the process.
 */
export const validateGitUrl = async (
  gitUrl: string,
  exitFn: (status: number) => void
): Promise<void> => {
  if (gitUrl === "") {
    return;
  }

  let isHelmConfigHttp = true;

  try {
    new URL(gitUrl);
  } catch (err) {
    logger.warn(
      `Provided helm git URL is an invalid http/https URL: ${gitUrl}`
    );
    isHelmConfigHttp = false;
  }

  // We might be looking at a git+ssh URL ie: git@foo.com:/path/to/git
  if (!isHelmConfigHttp) {
    try {
      const parsedSshUrl = sshUrl.parse(gitUrl);
      // Git url parsed by node-ssh-url will have a `user` field if it resembles
      // git@ssh.dev.azure.com:v3/bhnook/test/hld
      if (parsedSshUrl.user === null) {
        fail("Not a valid git+ssh url");
      }
    } catch (err) {
      logger.error(
        `Provided helm git URL is an invalid git+ssh or http/https URL: ${gitUrl}`
      );
      await exitFn(1);
      return;
    }
  }
};

export const execute = async (
  serviceName: string,
  servicePath: string,
  opts: CommandOptions,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  if (!serviceName) {
    logger.error("Service name is missing");
    await exitFn(1);
    return;
  }

  if (!servicePath) {
    logger.error("Service path is missing");
    await exitFn(1);
    return;
  }

  // validate user inputs are DNS compliant
  try {
    dns.assertIsValid("<service-name>", serviceName);
    assertValidDnsInputs(opts);
  } catch (err) {
    logger.error(err);
    await exitFn(1);
  }

  // Sanity checking the specified Helm URLs
  await validateGitUrl(opts.helmConfigGit, exitFn);

  const projectPath = process.cwd();
  logger.verbose(`project path: ${projectPath}`);

  try {
    checkDependencies(projectPath);
    const values = fetchValues(opts);
    await createService(projectPath, serviceName, servicePath, values);
    await exitFn(0);
  } catch (err) {
    logger.error(
      `Error occurred adding service ${serviceName} to project ${projectPath}`
    );
    logger.error(err);
    await exitFn(1);
  }
};

/**
 * Adds the create command to the service command object
 *
 * @param command Commander command object to decorate
 */
export const commandDecorator = (command: commander.Command): void => {
  buildCmd(command, decorator).action(
    async (serviceName: string, servicePath: string, opts: CommandOptions) => {
      await execute(serviceName, servicePath, opts, async (status: number) => {
        await exitCmd(logger, process.exit, status);
      });
    }
  );
};
