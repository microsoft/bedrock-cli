import { Command } from "../command";
import { getCommandDecorator } from "./get";
import { initCommandDecorator } from "./init";

/**
 * `deployment` command
 */
export const deploymentCommand = Command(
  "deployment",
  "Introspect your deployments",
  [getCommandDecorator, initCommandDecorator]
);
