import { Command } from "../command";
import { commandDecorator as createCommandDecorator } from "./create";
import { commandDecorator as createServiceRevisionCommandDecorator } from "./create-revision";
import { commandDecorator as installBuildPipelineCommandDecorator } from "./pipeline";

export const serviceCommand = Command(
  "service",
  "Create and manage services for a Bedrock project.",
  [
    createCommandDecorator,
    installBuildPipelineCommandDecorator,
    createServiceRevisionCommandDecorator
  ]
);
