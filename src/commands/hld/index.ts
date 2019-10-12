import { Command } from "../command";
import { initCommandDecorator } from "./init";
import { installHldToManifestPipelineDecorator } from "./pipeline";
export const hldCommand = Command(
  "hld",
  "Commands for initalizing and managing a bedrock HLD repository.",
  [initCommandDecorator, installHldToManifestPipelineDecorator]
);
