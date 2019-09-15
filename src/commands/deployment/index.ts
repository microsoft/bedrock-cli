import { Command } from "../command";
import { getCommandDecorator } from "./get";
import { initCommandDecorator } from "./init";

export const deploymentCommand = Command(
  "deployment",
  "Introspect your deployments",
  [getCommandDecorator, initCommandDecorator]
);
