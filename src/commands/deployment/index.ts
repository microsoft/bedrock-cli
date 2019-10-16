import { Command } from "../command";
import { dashboardCommandDecorator } from "./dashboard";
import { getCommandDecorator } from "./get";
import { onboardCommandDecorator } from "./onboard";
import { validateCommandDecorator } from "./validate";

/**
 * `deployment` command
 */
export const deploymentCommand = Command(
  "deployment",
  "Introspect your deployments",
  [
    getCommandDecorator,
    onboardCommandDecorator,
    validateCommandDecorator,
    dashboardCommandDecorator
  ]
);
