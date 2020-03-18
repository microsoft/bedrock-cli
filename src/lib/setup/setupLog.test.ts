import fs from "fs";
import path from "path";
import uuid from "uuid/v4";
import { createTempDir } from "../ioUtil";
import { RequestContext } from "./constants";
import { create } from "./setupLog";

const positiveTest = (logExist?: boolean, withAppCreation = false): void => {
  const dir = createTempDir();
  const file = path.join(dir, uuid());

  if (logExist) {
    fs.writeFileSync(file, "dummy");
  }

  const rc: RequestContext = {
    accessToken: "accessToken",
    createdACR: false,
    createdHLDtoManifestPipeline: true,
    createdProject: true,
    createdResourceGroup: false,
    orgName: "orgName",
    projectName: "projectName",
    acrName: "testacr",
    scaffoldAppService: true,
    scaffoldHLD: true,
    scaffoldHelm: true,
    scaffoldManifest: true,
    subscriptionId: "72f988bf-86f1-41af-91ab-2d7cd011db48",
    workspace: "workspace"
  };

  if (withAppCreation) {
    (rc.toCreateAppRepo = true),
      (rc.toCreateSP = true),
      (rc.servicePrincipalId = "b510c1ff-358c-4ed4-96c8-eb23f42bb65b");
    rc.servicePrincipalPassword = "a510c1ff-358c-4ed4-96c8-eb23f42bbc5b";
    rc.servicePrincipalTenantId = "72f988bf-86f1-41af-91ab-2d7cd011db47";
    rc.createdResourceGroup = true;
    rc.createdACR = true;
  }
  create(rc, file);

  expect(fs.existsSync(file)).toBeTruthy();

  if (withAppCreation) {
    expect(fs.readFileSync(file, "UTF-8").split("\n")).toStrictEqual([
      "azdo_org_name=orgName",
      "azdo_project_name=projectName",
      "azdo_pat=*********",
      "az_create_app=true",
      "az_create_sp=true",
      "az_sp_id=b510c1ff-358c-4ed4-96c8-eb23f42bb65b",
      "az_sp_password=********",
      "az_sp_tenant=72f988bf-86f1-41af-91ab-2d7cd011db47",
      "az_subscription_id=72f988bf-86f1-41af-91ab-2d7cd011db48",
      "az_acr_name=testacr",
      "workspace: workspace",
      "Project Created: yes",
      "High Level Definition Repo Scaffolded: yes",
      "Helm Repo Scaffolded: yes",
      "Sample App Repo Scaffolded: yes",
      "Manifest Repo Scaffolded: yes",
      "HLD to Manifest Pipeline Created: yes",
      "Service Principal Created: no",
      "Resource Group Created: yes",
      "ACR Created: yes",
      "Status: Completed"
    ]);
  } else {
    expect(fs.readFileSync(file, "UTF-8").split("\n")).toStrictEqual([
      "azdo_org_name=orgName",
      "azdo_project_name=projectName",
      "azdo_pat=*********",
      "az_create_app=false",
      "az_create_sp=false",
      "az_sp_id=",
      "az_sp_password=",
      "az_sp_tenant=",
      "az_subscription_id=72f988bf-86f1-41af-91ab-2d7cd011db48",
      "az_acr_name=testacr",
      "workspace: workspace",
      "Project Created: yes",
      "High Level Definition Repo Scaffolded: yes",
      "Helm Repo Scaffolded: yes",
      "Sample App Repo Scaffolded: yes",
      "Manifest Repo Scaffolded: yes",
      "HLD to Manifest Pipeline Created: yes",
      "Service Principal Created: no",
      "Resource Group Created: no",
      "ACR Created: no",
      "Status: Completed"
    ]);
  }
};

describe("test create function", () => {
  it("positive test: no request context", () => {
    const dir = createTempDir();
    const file = path.join(dir, uuid());
    create(undefined, file);
    expect(fs.existsSync(file)).toBeFalsy();
  });
  it("positive test: no errors", () => {
    positiveTest();
  });
  it("positive test: no errors and log already exists", () => {
    positiveTest(true);
  });
  it("positive test: no errors and app and sp creation", () => {
    positiveTest(false, true);
  });
  it("positive test: with errors", () => {
    const dir = createTempDir();
    const file = path.join(dir, uuid());

    create(
      {
        accessToken: "accessToken",
        createdHLDtoManifestPipeline: true,
        createdProject: true,
        error: "things broke",
        orgName: "orgName",
        projectName: "projectName",
        scaffoldAppService: true,
        scaffoldHLD: true,
        scaffoldHelm: true,
        scaffoldManifest: true,
        workspace: "workspace"
      },
      file
    );

    expect(fs.existsSync(file)).toBeTruthy();
    expect(fs.readFileSync(file, "UTF-8").split("\n")).toStrictEqual([
      "azdo_org_name=orgName",
      "azdo_project_name=projectName",
      "azdo_pat=*********",
      "az_create_app=false",
      "az_create_sp=false",
      "az_sp_id=",
      "az_sp_password=",
      "az_sp_tenant=",
      "az_subscription_id=",
      "az_acr_name=",
      "workspace: workspace",
      "Project Created: yes",
      "High Level Definition Repo Scaffolded: yes",
      "Helm Repo Scaffolded: yes",
      "Sample App Repo Scaffolded: yes",
      "Manifest Repo Scaffolded: yes",
      "HLD to Manifest Pipeline Created: yes",
      "Service Principal Created: no",
      "Resource Group Created: no",
      "ACR Created: no",
      "Error: things broke",
      "Status: Incomplete"
    ]);
  });
});
