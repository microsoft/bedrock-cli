import { Command } from "../command";
import { scaffoldCommandDecorator } from "./scaffold";
import { validateCommandDecorator } from "./validate";

export const infraCommand = Command(
  "infra",
  "Manage and modify your Bedrock infrastructure.",
  [scaffoldCommandDecorator, validateCommandDecorator]
);
