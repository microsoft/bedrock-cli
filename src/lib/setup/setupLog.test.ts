import fs from "fs";
import path from "path";
import uuid from "uuid/v4";
import { createTempDir } from "../ioUtil";
import { create } from "./setupLog";

const positiveTest = (logExist?: boolean) => {
  const dir = createTempDir();
  const file = path.join(dir, uuid());

  if (logExist) {
    fs.writeFileSync(file, "dummy");
  }

  create(
    {
      accessToken: "accessToken",
      createdHLDtoManifestPipeline: true,
      createdProject: true,
      orgName: "orgName",
      projectName: "projectName",
      scaffoldHLD: true,
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
    "workspace: workspace",
    "Project Created: yes",
    "High Level Definition Repo Scaffolded: yes",
    "Manifest Repo Scaffolded: yes",
    "HLD to Manifest Pipeline Created: yes",
    "Status: Completed"
  ]);
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
        scaffoldHLD: true,
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
      "workspace: workspace",
      "Project Created: yes",
      "High Level Definition Repo Scaffolded: yes",
      "Manifest Repo Scaffolded: yes",
      "HLD to Manifest Pipeline Created: yes",
      "Error: things broke",
      "Status: Incomplete"
    ]);
  });
});
