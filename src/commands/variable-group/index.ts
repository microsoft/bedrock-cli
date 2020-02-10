import { Command } from "../command";
import { commandDecorator as createCommandDecorator } from "./create";
export const variableGroupCommand = Command(
  "variable-group",
  "Creates Variable Group in Azure DevOps project.",
  [createCommandDecorator]
);
