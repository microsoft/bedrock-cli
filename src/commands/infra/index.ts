import { Command } from "../command";

const subfolders = ["generate", "scaffold"];

export const commandDecorator = Command(
  "infra",
  "Manage and modify your Bedrock infrastructure.",
  subfolders.map(m => {
    const cmd = require(`./${m}`);
    return cmd.commandDecorator;
  })
);
