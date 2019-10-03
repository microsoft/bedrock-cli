import { logger } from "../../../logger";

export const setSecret = async (
  keyVaultName: string,
  secretName: string,
  secretValue: string
) => {
  logger.info(
    `called mock with key vault ${keyVaultName}, secret name ${secretName}, and secret value ${secretValue}"`
  );
};

export const getSecret = async (
  keyVaultName: string,
  secretName: string
): Promise<string | undefined> => {
  logger.info(
    `called mock with key vault ${keyVaultName} and secret name ${secretName}`
  );
  return "mock secret value";
};
