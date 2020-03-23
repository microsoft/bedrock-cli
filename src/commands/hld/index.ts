import { Command } from "../command";

const subfolders = ["init", "pipeline", "reconcile"];

export const commandDecorator = Command(
  "hld",
  "Commands for initalizing and managing a bedrock HLD repository.",
  subfolders.map((m) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cmd = require(`./${m}`);
    return cmd.commandDecorator;
  })
);
