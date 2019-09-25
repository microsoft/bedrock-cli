import { Command } from "../command";
import { createCommandDecorator } from "./create";

export const serviceCommand = Command(
  "service",
  "Create and manage services for a Bedrock project.",
  [createCommandDecorator]
);
