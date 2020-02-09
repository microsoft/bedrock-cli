import { Command } from "../command";
import { commandDecorator as createCommandDecorator } from "./create";
import { commandDecorator as dashboardCommandDecorator } from "./dashboard";
import { commandDecorator as getCommandDecorator } from "./get";
import { commandDecorator as onboardCommandDecorator } from "./onboard";
import { commandDecorator as validateCommandDecorator } from "./validate";

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
    dashboardCommandDecorator,
    createCommandDecorator
  ]
);
