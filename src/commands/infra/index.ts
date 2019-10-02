import { Command } from "../command";
import { createCommandDecorator } from "./create";
import { initCommand } from "./init";

export const infraCommand = Command(
  "infra",
  "Deploy and modify your Bedrock infrastructure.",
  [initCommand, createCommandDecorator]
);
