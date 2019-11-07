import { Command } from "../command";
import { createVariablegroupCommandDecorator } from "./create-variable-group";
import { initCommandDecorator } from "./init";
import { deployLifecyclePipelineCommandDecorator } from "./pipeline";

export const projectCommand = Command(
  "project",
  "Initialize and manage your Bedrock project.",
  [
    createVariablegroupCommandDecorator,
    deployLifecyclePipelineCommandDecorator,
    initCommandDecorator
  ]
);
