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
import { Command, executeCommand } from "./commands/command";
import { deploymentCommand } from "./commands/deployment";
import { projectCommand } from "./commands/project";
import { serviceCommand } from "./commands/service";

////////////////////////////////////////////////////////////////////////////////
// Instantiate core command object
////////////////////////////////////////////////////////////////////////////////
const rootCommand = Command(
  "spk",
  "The missing Bedrock CLI",
  [
    c => {
      c.version(require("../package.json").version);
    }
  ],
  [deploymentCommand, projectCommand, serviceCommand]
);

////////////////////////////////////////////////////////////////////////////////
// Main
////////////////////////////////////////////////////////////////////////////////
executeCommand(rootCommand, [...process.argv]);
