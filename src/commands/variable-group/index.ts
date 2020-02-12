import { Command } from "../command";

const subfolders = ["create"];

export const commandDecorator = Command(
  "variable-group",
  "Creates Variable Group in Azure DevOps project.",
  subfolders.map(m => {
    const cmd = require(`./${m}`);
    return cmd.commandDecorator;
  })
);
