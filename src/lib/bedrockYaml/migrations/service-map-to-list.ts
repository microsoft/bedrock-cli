import * as bedrock from "..";
import { BedrockFile, Rings, HelmConfig } from "../../../types";
import * as path from "path";
import * as fs from "fs";
import { logger } from "../../../logger";
import yaml from "js-yaml";

export interface LegacyBedrockService {
  displayName?: string;
  disableRouteScaffold?: boolean;
  helm: HelmConfig;
  k8sBackend?: string; // k8s service backend name for ingress routing
  k8sBackendPort: number; // the service port for the k8s service Traefik2 IngressRoutes will point to
  middlewares?: string[];
  pathPrefix?: string; // pathprefix for ingress route, ie. document-service
  pathPrefixMajorVersion?: string; // api version, will prefix path prefix if provided. ie. 'v1' will result in the endpoint: /v1/document-service
}

/**
 * Bedrock config file
 * Used to capture service meta-information regarding how to deploy
 */
export interface LegacyBedrockFile {
  rings: Rings;
  services: {
    [path: string]: LegacyBedrockService;
  };
  variableGroups?: string[];
  version: string;
}

/**
 * Converts a legacy bedrock.yaml file to the new v0.6.0 syntax
 *
 * - Changes the index of the services to be the displayName, uses
 *  `getServiceName` to compute it.
 * - Removes displayName from all services if found
 * - Adds `path` to the service -- using the value of the existing index for the
 *   service
 *
 * @param legacy bedrockYaml to convert
 */
export const convertToNewSchema = (legacy: LegacyBedrockFile): BedrockFile => {
  const services = Object.entries(legacy.services).map(([svcPath, config]) => ({
    ...config,
    path: svcPath,
  }));

  return {
    ...legacy,
    services,
  };
};

/**
 * Checks if the provided bedrock yaml file is the legacy schema.
 * It is considered legacy if the value of `b.services` is not an array
 *
 * @param b config to check if legacy or not
 */
export function isLegacySchema(
  b: BedrockFile | LegacyBedrockFile
): b is LegacyBedrockFile {
  return !Array.isArray(b.services);
}

/**
 * Run the migration to new Bedrock schema.
 *
 * - Attempts to load the bedrock.yaml file and check the version it legacy
 * - If it is legacy, update it and overwrite
 */
export const migrate = (
  b: BedrockFile | LegacyBedrockFile,
  bedrockDir: string
): BedrockFile => {
  if (isLegacySchema(b)) {
    logger.info(
      "Legacy bedrock.yaml schema found -- Migrating to new schema..."
    );
    // delete the original
    const bedrockPath = path.resolve(path.join(bedrockDir, bedrock.YAML_NAME));
    fs.unlinkSync(path.join(bedrockDir, bedrock.YAML_NAME));

    // write out the new one
    logger.info(`Writing updated bedrock.yaml file to ${bedrockPath}`);
    const migrated = convertToNewSchema(b);
    bedrock.create(bedrockDir, migrated);
    logger.info(`Successfully updated Bedrock config`);
    return yaml.safeLoad(fs.readFileSync(bedrockPath, "utf8"));
  } else {
    return b;
  }
};
