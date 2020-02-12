import { Command } from "../command";

const subfolders = ["create-variable-group", "init", "pipeline"];

export const commandDecorator = Command(
  "project",
  "Initialize and manage your Bedrock project.",
  subfolders.map(m => {
    const cmd = require(`./${m}`);
    return cmd.commandDecorator;
  })
);
