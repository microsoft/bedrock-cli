import { Command } from "../command";
import { createCommandDecorator } from "./create";
import { createServiceRevisionCommandDecorator } from "./create-revision";
import { createPipelineCommandDecorator } from "./pipeline";

export const serviceCommand = Command(
  "service",
  "Create and manage services for a Bedrock project.",
  [
    createCommandDecorator,
    createPipelineCommandDecorator,
    createServiceRevisionCommandDecorator
  ]
);
