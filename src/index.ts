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
 * - etc...
 */
import commander from "commander";
import { addCommand } from "./commands/add";
import { initCommand } from "./commands/init";
import { shellCommand } from "./commands/shell";
import { enableVerboseLogging, logger } from "./logger";

////////////////////////////////////////////////////////////////////////////////
// Instantiate core command object
////////////////////////////////////////////////////////////////////////////////
const command = new commander.Command()
  .version((() => require("../package.json").version)())
  .option("-v, --verbose", "verbose logging")
  .on("option:verbose", () => {
    enableVerboseLogging();
  });

////////////////////////////////////////////////////////////////////////////////
// Add commands/decorators here
////////////////////////////////////////////////////////////////////////////////
initCommand(command);
shellCommand(command);
addCommand(command);

////////////////////////////////////////////////////////////////////////////////
// Catch-all for unknown commands
////////////////////////////////////////////////////////////////////////////////
command.on("command:*", cmd => {
  logger.error(`Unknown command "${cmd}"`);
  command.outputHelp();
});

////////////////////////////////////////////////////////////////////////////////
// If no command passed (first 2 args in process.argv are the node executable
// and the script called) output help
////////////////////////////////////////////////////////////////////////////////
process.argv.length <= 2 ? command.outputHelp() : command.parse(process.argv);
