import { Command } from "../command";

const subfolders = ["create", "dashboard", "get", "onboard", "validate"];

export const commandDecorator = Command(
  "deployment",
  "Introspect your deployments",
  subfolders.map(m => {
    const cmd = require(`./${m}`);
    return cmd.commandDecorator;
  })
);
