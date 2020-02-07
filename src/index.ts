/**
 * Warning! This program section of the code is very dangerous.
 * This is file is where we parse untyped user given commands into argument
 * code for the application.
 * For every command added/parsed, do your best to ensure type safety using
 * the built-in JS primitives such as:
 * - Array.isArray()
 * - Number.isInteger()
 * - if (typeof var === 'boolean') {}
 * - if (typeof var === 'undefined') {}
 * - if (typeof var === 'number') {}
 * - etc...
 */
// fetch module is required for @azure/ms-rest-nodeauth in lib/azure
import "isomorphic-fetch";
import { Command, executeCommand } from "./commands/command";
import { deploymentCommand } from "./commands/deployment";
import { hldCommand } from "./commands/hld";
import { infraCommand } from "./commands/infra";
import { commandDecorator as initCommandDecorator } from "./commands/init";
import { projectCommand } from "./commands/project";
import { serviceCommand } from "./commands/service";
import { variableGroupCommand } from "./commands/variable-group";

(process as any).noDeprecation = true;

////////////////////////////////////////////////////////////////////////////////
// Instantiate core command object
////////////////////////////////////////////////////////////////////////////////
const rootCommand = Command(
  "spk",
  "The missing Bedrock CLI",
  [
    c => {
      c.version(require("../package.json").version);
    },
    initCommandDecorator
  ],
  [
    deploymentCommand,
    projectCommand,
    serviceCommand,
    infraCommand,
    hldCommand,
    variableGroupCommand
  ]
);

////////////////////////////////////////////////////////////////////////////////
// Main
////////////////////////////////////////////////////////////////////////////////
executeCommand(rootCommand, [...process.argv]);
