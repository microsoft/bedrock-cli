import { Command } from "../command";
import { commandDecorator as initCommandDecorator } from "./init";
import { installHldToManifestPipelineDecorator } from "./pipeline";
import { reconcileHldDecorator } from "./reconcile";
export const hldCommand = Command(
  "hld",
  "Commands for initalizing and managing a bedrock HLD repository.",
  [
    initCommandDecorator,
    installHldToManifestPipelineDecorator,
    reconcileHldDecorator
  ]
);
