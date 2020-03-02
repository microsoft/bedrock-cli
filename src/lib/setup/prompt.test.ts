import fs from "fs";
import inquirer from "inquirer";
import os from "os";
import path from "path";
import uuid from "uuid/v4";
import { createTempDir } from "../../lib/ioUtil";
import { DEFAULT_PROJECT_NAME, getAnswerFromFile, prompt } from "./prompt";

describe("test prompt function", () => {
  it("positive test", async () => {
    const answers = {
      azdo_org_name: "org",
      azdo_pat: "pat",
      azdo_project_name: "project"
    };
    jest.spyOn(inquirer, "prompt").mockResolvedValueOnce(answers);
    const ans = await prompt();
    expect(ans).toStrictEqual(answers);
  });
});

describe("test getAnswerFromFile function", () => {
  it("positive test", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = [
      "azdo_org_name=orgname",
      "azdo_pat=pat",
      "azdo_project_name=project"
    ];
    fs.writeFileSync(file, data.join("\n"));
    const answer = getAnswerFromFile(file);
    expect(answer.azdo_org_name).toBe("orgname");
    expect(answer.azdo_pat).toBe("pat");
    expect(answer.azdo_project_name).toBe("project");
  });
  it("positive test: without project name", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = ["azdo_org_name=orgname", "azdo_pat=pat"];
    fs.writeFileSync(file, data.join("\n"));
    const answer = getAnswerFromFile(file);
    expect(answer.azdo_org_name).toBe("orgname");
    expect(answer.azdo_pat).toBe("pat");
    expect(answer.azdo_project_name).toBe(DEFAULT_PROJECT_NAME);
  });
  it("negative test: file does not exist", () => {
    const file = path.join(os.tmpdir(), uuid());
    expect(() => {
      getAnswerFromFile(file);
    }).toThrow();
  });
  it("negative test: missing org name", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = ["azdo_pat=pat"];
    fs.writeFileSync(file, data.join("\n"));
    expect(() => {
      getAnswerFromFile(file);
    }).toThrow();
  });
  it("negative test: invalid project name", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = [
      "azdo_org_name=orgname",
      "azdo_project_name=.project",
      "azdo_pat=pat"
    ];
    fs.writeFileSync(file, data.join("\n"));
    expect(() => {
      getAnswerFromFile(file);
    }).toThrow();
  });
  it("negative test: missing pat", () => {
    const dir = createTempDir();
    const file = path.join(dir, "testfile");
    const data = ["azdo_org_name=orgname"];
    fs.writeFileSync(file, data.join("\n"));
    expect(() => {
      getAnswerFromFile(file);
    }).toThrow();
  });
});
