import { Command } from "../command";
import { commandDecorator as initCommandDecorator } from "./init";
import { commandDecorator as installHldToManifestPipelineDecorator } from "./pipeline";
import { commandDecorator as reconcileHldDecorator } from "./reconcile";

export const hldCommand = Command(
  "hld",
  "Commands for initalizing and managing a bedrock HLD repository.",
  [
    initCommandDecorator,
    installHldToManifestPipelineDecorator,
    reconcileHldDecorator
  ]
);
