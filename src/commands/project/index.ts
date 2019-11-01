import { Command } from "../command";
import { createVariablegroupCommandDecorator } from "./create-variable-group";
import { initCommandDecorator } from "./init";

export const projectCommand = Command(
  "project",
  "Initialize and manage your Bedrock project.",
  [initCommandDecorator, createVariablegroupCommandDecorator]
);
