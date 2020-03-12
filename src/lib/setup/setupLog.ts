import fs from "fs";
import { IRequestContext, SETUP_LOG } from "./constants";

const getBooleanVal = (val: boolean | undefined) => {
  return !!val ? "yes" : "no";
};

export const create = (rc: IRequestContext | undefined, file?: string) => {
  if (rc) {
    file = file || SETUP_LOG;
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    const buff = [
      `azdo_org_name=${rc.orgName}`,
      `azdo_project_name=${rc.projectName}`,
      "azdo_pat=*********",
      `az_create_app=${!!rc.toCreateAppRepo}`,
      `az_create_sp=${!!rc.toCreateSP}`,
      `az_sp_id=${rc.servicePrincipalId || ""}`,
      `az_sp_password=${rc.servicePrincipalPassword ? "********" : ""}`,
      `az_sp_tenant=${rc.servicePrincipalTenantId || ""}`,
      `az_subscription_id=${rc.subscriptionId || ""}`,
      `workspace: ${rc.workspace}`,
      `Project Created: ${getBooleanVal(rc.createdProject)}`,
      `High Level Definition Repo Scaffolded: ${getBooleanVal(rc.scaffoldHLD)}`,
      `Manifest Repo Scaffolded: ${getBooleanVal(rc.scaffoldManifest)}`,
      `HLD to Manifest Pipeline Created: ${getBooleanVal(
        rc.createdHLDtoManifestPipeline
      )}`,
      `Service Principal Created: ${getBooleanVal(rc.createServicePrincipal)}`,
      `Resource Group Created: ${getBooleanVal(rc.createdResourceGroup)}`,
      `ACR Created: ${getBooleanVal(rc.createdACR)}`
    ];
    if (rc.error) {
      buff.push(`Error: ${rc.error}`);
      buff.push("Status: Incomplete");
    } else {
      buff.push("Status: Completed");
    }

    fs.writeFileSync(file, buff.join("\n"));
  }
};
