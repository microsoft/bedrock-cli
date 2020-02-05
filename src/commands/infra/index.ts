import { Command } from "../command";
import { commandDecorator as generateCommandDecorator } from "./generate";
import { commandDecorator as scaffoldCommandDecorator } from "./scaffold";

export const infraCommand = Command(
  "infra",
  "Manage and modify your Bedrock infrastructure.",
  [generateCommandDecorator, scaffoldCommandDecorator]
);
