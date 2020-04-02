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
import { commandDecorator as initCommandDecorator } from "./commands/init";
import { commandDecorator as setupCommandDecorator } from "./commands/setup";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(process as any).noDeprecation = true;

const commandModules = [
  "deployment",
  "hld",
  "infra",
  "project",
  "ring",
  "service",
  "variable-group",
];

////////////////////////////////////////////////////////////////////////////////
// Instantiate core command object
////////////////////////////////////////////////////////////////////////////////
(async (): Promise<void> => {
  const cmds = await Promise.all(
    commandModules.map(async (m) => {
      const cmd = await import(`./commands/${m}`);
      return cmd.commandDecorator;
    })
  );
  const rootCommand = Command(
    "spk",
    "The missing Bedrock CLI",
    [
      (c): void => {
        c.version(require("../package.json").version);
      },
      initCommandDecorator,
      setupCommandDecorator,
    ],
    cmds
  );

  // main
  executeCommand(rootCommand, [...process.argv]);
})();
