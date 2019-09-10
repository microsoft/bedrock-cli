import { Command } from "../command";
import { initCommandDecorator } from "./init";

export const projectCommand = Command(
  "project",
  "Initialize and manage your Bedrock project.",
  [initCommandDecorator]
);
