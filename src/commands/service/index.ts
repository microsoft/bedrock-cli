import { Command } from "../command";

const subfolders = [
  "create",
  "create-revision",
  "pipeline",
  "get-display-name",
];

export const commandDecorator = Command(
  "service",
  "Create and manage services for a Bedrock project.",
  subfolders.map((m) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cmd = require(`./${m}`);
    return cmd.commandDecorator;
  })
);
