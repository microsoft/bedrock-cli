import fs from "fs";
import { RequestContext, SETUP_LOG } from "./constants";

const getBooleanVal = (val: boolean | undefined): "yes" | "no" => {
  return val ? "yes" : "no";
};

export const create = (rc: RequestContext | undefined, file?: string): void => {
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
      `az_acr_name=${rc.acrName || ""}`,
      `az_storage_account_name=${rc.storageAccountName || ""}`,
      `az_storage_table=${rc.storageTableName || ""}`,
      `workspace: ${rc.workspace}`,
      `Project Created: ${getBooleanVal(rc.createdProject)}`,
      `High Level Definition Repo Scaffolded: ${getBooleanVal(rc.scaffoldHLD)}`,
      `Helm Repo Scaffolded: ${getBooleanVal(rc.scaffoldHelm)}`,
      `Sample App Repo Scaffolded: ${getBooleanVal(rc.scaffoldAppService)}`,
      `Manifest Repo Scaffolded: ${getBooleanVal(rc.scaffoldManifest)}`,
      `HLD to Manifest Pipeline Created: ${getBooleanVal(
        rc.createdHLDtoManifestPipeline
      )}`,
      `Service Principal Created: ${getBooleanVal(rc.createServicePrincipal)}`,
      `Resource Group Created: ${getBooleanVal(rc.createdResourceGroup)}`,
      `Lifecycle Pipeline Created: ${getBooleanVal(
        rc.createdLifecyclePipeline
      )}`,
      `Build Pipeline Created: ${getBooleanVal(rc.createdBuildPipeline)}`,
      `ACR Created: ${getBooleanVal(rc.createdACR)}`,
      `Storage Account Created: ${getBooleanVal(rc.createdStorageAccount)}`,
      `Storage Table Created: ${getBooleanVal(rc.createdStorageTable)}`,
    ];
    if (rc.error) {
      buff.push(`Error: ${rc.error}`);
      buff.push("Status: Incomplete");
    } else {
      buff.push("Status: Completed");
    }

    console.log("");
    console.log(buff.join("\n"));
    console.log("");

    if (rc.toCreateAppRepo && !rc.error) {
      console.log(
        `type "spk deployment get" or "spk deployment dashboard" command to view deployments information.`
      );
    }

    fs.writeFileSync(file, buff.join("\n"));
  }
};
