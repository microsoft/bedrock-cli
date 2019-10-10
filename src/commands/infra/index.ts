import { Command } from "../command";
import { createCommandDecorator } from "./create";
import { infraValidateCommand } from "./vaildate";

export const infraCommand = Command(
  "infra",
  "Deploy and modify your Bedrock infrastructure.",
  [infraValidateCommand, createCommandDecorator]
);
