import commander from "commander";
import path from "path";
import shelljs from "shelljs";
import { Bedrock, bedrockFileInfo } from "../../config";
import {
  projectCvgDependencyErrorMessage,
  projectInitCvgDependencyErrorMessage
} from "../../constants";
import {
  addNewService as addNewServiceToBedrockFile,
  YAML_NAME as BedrockFileName
} from "../../lib/bedrockYaml";
import {
  addNewServiceToMaintainersFile,
  generateDockerfile,
  generateGitIgnoreFile,
  generateStarterAzurePipelinesYaml
} from "../../lib/fileutils";
import { checkoutCommitPushCreatePRLink } from "../../lib/gitutils";
import { logger } from "../../logger";
import { IBedrockFileInfo, IHelmConfig, IUser } from "../../types";

/**
 * Adds the create command to the service command object
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
      "-c, --helm-chart-chart <helm-chart>",
      "bedrock helm chart name. --helm-chart-* and --helm-config-* are exclusive; you may only use one.",
      ""
    )
    .option(
      "-r, --helm-chart-repository <helm-repository>",
      "bedrock helm chart repository. --helm-chart-* and --helm-config-* are exclusive; you may only use one.",
      ""
    )
    .option(
      "-b, --helm-config-branch <helm-branch>",
      "bedrock custom helm chart configuration branch. --helm-chart-* and --helm-config-* are exclusive; you may only use one.",
      ""
    )
    .option(
      "-p, --helm-config-path <helm-path>",
      "bedrock custom helm chart configuration path. --helm-chart-* and --helm-config-* are exclusive; you may only use one.",
      ""
    )
    .option(
      "-g, --helm-config-git <helm-git>",
      "bedrock helm chart configuration git repository. --helm-chart-* and --helm-config-* are exclusive; you may only use one.",
      ""
    )
    .option(
      "-d, --packages-dir <dir>",
      "The directory containing the mono-repo packages.",
      ""
    )
    .option(
      "-n, --display-name <display-name>",
      "Display name of the service.",
      ""
    )
    .option(
      "-m, --maintainer-name <maintainer-name>",
      "The name of the primary maintainer for this service.",
      "maintainer name"
    )
    .option(
      "-e, --maintainer-email <maintainer-email>",
      "The email of the primary maintainer for this service.",
      "maintainer email"
    )
    .option(
      "--git-push",
      "SPK CLI will try to commit and push these changes to a new origin/branch named after the service.",
      false
    )
    .option(
      "--middlewares <comma-delimitated-list-of-middleware-names>",
      "Traefik2 middlewares you wish to to be injected into your Traefik2 IngressRoutes",
      ""
    )
    .option(
      "--k8s-backend-port <port>",
      "Kubernetes backend service port which this service is exposed with; will be used to configure Traefik2 IngressRoutes",
      "80"
    )
    .option(
      "--k8s-backend <backend>",
      "Kubernetes backend service name; will be used to configure Traefik2 IngressRoutes",
      ""
    )
    .option(
      "--path-prefix <path-prefix>",
      "The path prefix for ingress route; will be used to configure Traefik2 IngressRoutes. If omitted, then the service name will used.",
      ""
    )
    .option(
      "--path-prefix-major-version <path-prefix-major-version>",
      "Version to be used in the path prefix; will be used to configure Traefik2 IngressRoutes. ie. 'v1' will result in a path prefix of '/v1/servicename",
      ""
    )
    .action(async (serviceName, opts) => {
      const projectPath = process.cwd();
      logger.verbose(`project path: ${projectPath}`);

      const fileInfo: IBedrockFileInfo = await bedrockFileInfo(projectPath);
      if (fileInfo.exist === false) {
        logger.error(projectInitCvgDependencyErrorMessage);
        return undefined;
      } else if (fileInfo.hasVariableGroups === false) {
        logger.error(projectCvgDependencyErrorMessage);
        return undefined;
      }

      const bedrock = Bedrock();

      const {
        displayName,
        gitPush,
        helmChartChart,
        helmChartRepository,
        helmConfigBranch,
        helmConfigGit,
        helmConfigPath,
        k8sBackend,
        maintainerEmail,
        maintainerName,
        middlewares,
        packagesDir,
        pathPrefix,
        pathPrefixMajorVersion
      } = opts;
      const k8sPort = Number(opts.k8sBackendPort);
      const variableGroups = bedrock?.variableGroups;

      try {
        if (
          !isValidConfig(
            helmChartChart,
            helmChartRepository,
            helmConfigBranch,
            helmConfigGit,
            helmConfigPath,
            serviceName,
            packagesDir,
            maintainerName,
            maintainerEmail,
            middlewares,
            gitPush,
            displayName,
            k8sPort,
            pathPrefix,
            pathPrefixMajorVersion,
            k8sBackend
          )
        ) {
          throw Error(`Invalid configuration provided`);
        }

        await createService(
          projectPath,
          serviceName,
          packagesDir,
          gitPush,
          k8sPort,
          {
            displayName,
            helmChartChart,
            helmChartRepository,
            helmConfigBranch,
            helmConfigGit,
            helmConfigPath,
            k8sBackend,
            maintainerEmail,
            maintainerName,
            middlewares: (middlewares as string)
              .split(",")
              .map(str => str.trim()),
            pathPrefix,
            pathPrefixMajorVersion,
            variableGroups
          }
        );
      } catch (err) {
        logger.error(
          `Error occurred adding service ${serviceName} to project ${projectPath}`
        );
        logger.error(err);
        process.exit(1);
      }
    });
};

/**
 * Validates the pipeline configuration
 *
 * @param helmChartChart
 * @param helmChartRepository
 * @param helmConfigBranch
 * @param helmConfigGit
 * @param helmConfigPath
 * @param serviceName
 * @param packagesDir
 * @param maintainerName
 * @param maintainerEmail
 * @param middlewares
 * @param gitPush
 * @param displayName
 * @param k8sPort
 * @param pathPrefix
 * @param pathPrefixMajorVersion
 * @param k8sBackend
 */
export const isValidConfig = (
  helmChartChart: any,
  helmChartRepository: any,
  helmConfigBranch: any,
  helmConfigGit: any,
  helmConfigPath: any,
  serviceName: any,
  packagesDir: any,
  maintainerName: any,
  maintainerEmail: any,
  middlewares: any,
  gitPush: any,
  displayName: any,
  k8sPort: any,
  pathPrefix?: any,
  pathPrefixMajorVersion?: any,
  k8sBackend?: any
): boolean => {
  const missingConfig = [];

  // Type check all parsed command line args here.
  if (typeof helmChartChart !== "string") {
    missingConfig.push(
      `helmChartChart must be of type 'string', ${typeof helmChartChart} given.`
    );
  }
  if (typeof helmChartRepository !== "string") {
    missingConfig.push(
      `helmChartRepository must be of type 'string', ${typeof helmChartRepository} given.`
    );
  }
  if (typeof helmConfigBranch !== "string") {
    missingConfig.push(
      `helmConfigBranch must be of type 'string', ${typeof helmConfigBranch} given.`
    );
  }
  if (typeof helmConfigGit !== "string") {
    missingConfig.push(
      `helmConfigGit must be of type 'string', ${typeof helmConfigGit} given.`
    );
  }
  if (typeof helmConfigPath !== "string") {
    missingConfig.push(
      `helmConfigPath must be of type 'string', ${typeof helmConfigPath} given.`
    );
  }
  if (typeof serviceName !== "string") {
    missingConfig.push(
      `serviceName must be of type 'string', ${typeof serviceName} given.`
    );
  }
  if (typeof displayName !== "string") {
    missingConfig.push(
      `displayName must be of type 'string', ${typeof displayName} given.`
    );
  }
  if (typeof packagesDir !== "string") {
    missingConfig.push(
      `packagesDir must be of type 'string', ${typeof packagesDir} given.`
    );
  }
  if (typeof maintainerName !== "string") {
    missingConfig.push(
      `maintainerName must be of type 'string', ${typeof maintainerName} given.`
    );
  }
  if (typeof maintainerEmail !== "string") {
    missingConfig.push(
      `maintainerEmail must be of type 'string', ${typeof maintainerEmail} given.`
    );
  }
  if (typeof middlewares !== "string") {
    missingConfig.push(
      `middlewares must be of type of 'string', ${typeof middlewares} given.`
    );
  }
  if (typeof gitPush !== "boolean") {
    missingConfig.push(
      `gitPush must be of type 'boolean', ${typeof gitPush} given.`
    );
  }
  // k8sPort has to be a positive integer
  if (
    typeof k8sPort !== "number" ||
    !Number.isInteger(k8sPort) ||
    k8sPort < 0
  ) {
    missingConfig.push(
      `k8s-port must be a positive integer, parsed ${k8sPort} from input.`
    );
  }
  if (typeof k8sBackend !== "string") {
    missingConfig.push(
      `k8s-backend must be of type 'string', ${typeof k8sBackend} given.`
    );
  }
  if (typeof pathPrefix !== "string") {
    missingConfig.push(
      `pathPrefix must be of type 'string', ${typeof pathPrefix} given.`
    );
  }
  if (typeof pathPrefixMajorVersion !== "string") {
    missingConfig.push(
      `path-prefix-major-version must be of type 'string', ${typeof pathPrefixMajorVersion} given.`
    );
  }

  if (missingConfig.length > 0) {
    logger.error("Error in configuration: " + missingConfig.join(" "));
    return false;
  }

  return true;
};

/**
 * Create a service in a bedrock project directory.
 *
 * @param rootProjectPath
 * @param serviceName
 * @param packagesDir
 * @param gitPush
 * @param k8sBackendPort
 * @param opts
 */
export const createService = async (
  rootProjectPath: string,
  serviceName: string,
  packagesDir: string,
  gitPush: boolean,
  k8sBackendPort: number,
  opts?: {
    displayName?: string;
    helmChartChart?: string;
    helmChartRepository?: string;
    helmConfigBranch?: string;
    helmConfigGit?: string;
    helmConfigPath?: string;
    k8sBackend?: string;
    maintainerEmail?: string;
    maintainerName?: string;
    middlewares?: string[];
    pathPrefix?: string;
    pathPrefixMajorVersion?: string;
    variableGroups?: string[];
  }
) => {
  const {
    displayName = "",
    helmChartChart = "",
    helmChartRepository = "",
    helmConfigBranch = "",
    helmConfigPath = "",
    helmConfigGit = "",
    k8sBackend = "",
    maintainerName = "",
    maintainerEmail = "",
    middlewares = [],
    variableGroups = [],
    pathPrefix = "",
    pathPrefixMajorVersion = ""
  } = opts ?? {};

  logger.info(
    `Adding Service: ${serviceName}, to Project: ${rootProjectPath} under directory: ${packagesDir}`
  );
  logger.info(
    `DisplayName: ${displayName}, MaintainerName: ${maintainerName}, MaintainerEmail: ${maintainerEmail}`
  );

  const newServiceDir = path.join(rootProjectPath, packagesDir, serviceName);
  logger.info(`servicePath: ${newServiceDir}`);

  // Mkdir
  shelljs.mkdir("-p", newServiceDir);

  // Create azure pipelines yaml in directory
  await generateStarterAzurePipelinesYaml(rootProjectPath, newServiceDir, {
    variableGroups
  });

  // Create empty .gitignore file in directory
  generateGitIgnoreFile(newServiceDir, "");

  // Create simple Dockerfile in directory
  generateDockerfile(newServiceDir);

  // add maintainers to file in parent repo file
  const newUser = {
    email: maintainerEmail,
    name: maintainerName
  } as IUser;

  const newServiceRelativeDir = path.relative(rootProjectPath, newServiceDir);
  logger.debug(`newServiceRelPath: ${newServiceRelativeDir}`);

  addNewServiceToMaintainersFile(
    path.join(rootProjectPath, "maintainers.yaml"),
    newServiceRelativeDir,
    [newUser]
  );

  // Add relevant bedrock info to parent bedrock.yaml

  let helmConfig: IHelmConfig;
  if (helmChartChart && helmChartRepository) {
    helmConfig = {
      chart: {
        chart: helmChartChart,
        repository: helmChartRepository
      }
    };
  } else {
    helmConfig = {
      chart: {
        branch: helmConfigBranch,
        git: helmConfigGit,
        path: helmConfigPath
      }
    };
  }

  addNewServiceToBedrockFile(
    rootProjectPath,
    newServiceRelativeDir,
    displayName,
    helmConfig,
    middlewares,
    k8sBackendPort,
    k8sBackend,
    pathPrefix,
    pathPrefixMajorVersion
  );

  // If requested, create new git branch, commit, and push
  if (gitPush) {
    await checkoutCommitPushCreatePRLink(
      serviceName,
      newServiceDir,
      path.join(rootProjectPath, BedrockFileName),
      path.join(rootProjectPath, "maintainers.yaml")
    );
  }
};
