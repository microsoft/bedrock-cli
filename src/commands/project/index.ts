import { Command } from "../command";
import { initCommandDecorator } from "./init";
import { addServiceCommandDecorator } from "./add-service";

export const projectCommand = Command(
  "project",
  "Initialize and manage your Bedrock project.",
  [initCommandDecorator, addServiceCommandDecorator]
);
