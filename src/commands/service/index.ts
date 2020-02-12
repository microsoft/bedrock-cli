import { Command } from "../command";

const subfolders = ["create", "create-revision", "pipeline"];

export const commandDecorator = Command(
  "service",
  "Create and manage services for a Bedrock project.",
  subfolders.map(m => {
    const cmd = require(`./${m}`);
    return cmd.commandDecorator;
  })
);
