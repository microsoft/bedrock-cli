import { Command } from "../command";
import { getCommandDecorator } from "./get";
import { onboardCommandDecorator } from "./onboard";

/**
 * `deployment` command
 */
export const deploymentCommand = Command(
  "deployment",
  "Introspect your deployments",
  [getCommandDecorator, onboardCommandDecorator]
);
