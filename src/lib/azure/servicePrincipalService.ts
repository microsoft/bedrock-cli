import { logger } from "../../logger";
import { exec } from "../shell";

export interface ServicePrincipal {
  id: string;
  password: string;
  tenantId: string;
}

/**
 * Login to az command line tool. This is done by
 * doing a shell exec with `az login`; then browser opens
 * prompting user to select the identity.
 */
export const azCLILogin = async (): Promise<void> => {
  try {
    logger.info("attempting to login to az command line");
    await exec("az", ["login"]);
    logger.info("Successfully login to az command line");
  } catch (err) {
    logger.error("Unable to execute az login");
    logger.error(err);
    throw err;
  }
};

/**
 * Create a service principal with az command line tool.
 * this service principal should have contributor privileges.
 * Request context will have the service principal information
 * when service principal is successfully created.
 */
export const createWithAzCLI = async (): Promise<ServicePrincipal> => {
  await azCLILogin();
  try {
    logger.info("attempting to create service principal with az command line");
    const result = await exec("az", ["ad", "sp", "create-for-rbac"]);
    const oResult = JSON.parse(result);
    logger.info("Successfully created service principal with az command line");
    return {
      id: oResult.appId,
      password: oResult.password,
      tenantId: oResult.tenant
    };
  } catch (err) {
    logger.error("Unable to create service principal with az command line");
    logger.error(err);
    throw err;
  }
};
