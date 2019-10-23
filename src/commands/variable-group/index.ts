import { Command } from "../command";
import { createCommandDecorator } from "./create";
export const variableGroupCommand = Command(
  "variable-group",
  "Creates Variable Group in Azure DevOps project.",
  [createCommandDecorator]
);
