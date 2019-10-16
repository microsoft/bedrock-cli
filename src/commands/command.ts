import commander from "commander";
import { enableVerboseLogging, logger } from "../logger";

/**
 * General interface to encapsulate a sub-command.
 * The `name` and `description` are used to give information about the
 * sub-command to the root command.
 *
 * Warning: Avoid implementing this interface directly; use Command() function
 * to generate concrete implementations.
 */
interface ICommand {
  name: string;
  description: string;
  command: commander.Command;
  subCommands: ICommand[];
}

/**
 * Generates an concrete implementation of ICommand.
 *
 * `decorators` are a list of functions which will be applied to the the command
 * itself, use this for things such as adding .option(), .alias(), etc...
 *
 * `subComponents` is a list of ICommand which will be added as child nodes in
 * command tree.
 *
 * Implements default behavior of:
 * - Adding the `-v`/`--verbose` option
 * - Exiting and outputting help screen if the called a called command is not found
 * - Exiting and outputting error when an unknown option/flag is used
 *
 * @param name Name of the command -- will be converted .toLowerCase()
 * @param description Description of the command to show on on the root `--help` screen
 * @param decorators Array of command decorators
 * @param subCommands Array of ICommand which will be added as sub-commands
 */
export const Command = (
  name: string,
  description: string,
  decorators: Array<(c: commander.Command) => void> = [],
  subCommands: ICommand[] = []
): ICommand => {
  // Initialize default command
  const cmd = new commander.Command();
  cmd
    .name(name.toLowerCase())
    .description(description)
    .option("-v, --verbose", "Enable verbose logging")
    .on("option:verbose", () => {
      enableVerboseLogging();
    });

  // Add all decorators
  for (const decorator of decorators) {
    decorator(cmd);
  }

  // Catch-all for unknown commands
  cmd.on("command:*", calledCmd => {
    logger.error(`Unknown command "${calledCmd}"`);
    cmd.outputHelp();
  });
  cmd.on("option:*", unknownOption => {
    logger.error(`Unknown option "${unknownOption}"`);
  });

  return linkSubCommands({
    command: cmd,
    description,
    name: name.toLowerCase(),
    subCommands
  });
};

/**
 * 'Decrements' the `argv` array by removing the 3rd item from the list (the
 * target command)
 * Use function while traversing down the command tree to generate the
 * appropriate args to pass to the target command.
 *
 * @param argv Array of strings representing a list of arguments that would propagated in process.argv
 */
const decrementArgv = (argv: string[]): string[] => {
  const decremented = [...argv.slice(0, 2), ...argv.slice(3)];
  return decremented;
};

/**
 * Executes the provided command with the given argument list.
 * Traverses the sub-command tree as long as the head of `argv` is found in the
 * sub-command list of `cmd`. When the head of `argv` is no longer found, the
 * current `cmd` is called against `argv`
 *
 * @param cmd ICommand object to execute against
 * @param argv Array of arguments, flags *must* come at the end (limitation of using git-style sub-commands)
 */
export const executeCommand = (cmd: ICommand, argv: string[]): void => {
  const targetCommandName = argv.slice(2, 3)[0];
  const targetCommand = cmd.subCommands.find(
    sc => sc.name === targetCommandName
  );

  // If the the next argument matches against a sub-command, recur into it.
  // Else call the current command with the rest of the arguments.
  if (targetCommandName && targetCommand) {
    // If command is a sub-command, it needs to load configuration before
    // sub-command can be executed.
    executeCommand(targetCommand, decrementArgv(argv));
  } else {
    // Top level try/catch. If an error occurs, log it and exit with code 1
    try {
      argv.length <= 2 ? cmd.command.outputHelp() : cmd.command.parse(argv);
    } catch (err) {
      logger.error(err);
      process.exit(1);
    }
  }
};

/**
 * Links the command and sub-commands in the passed IComponent together.
 * Adding the necessary command/actions for each sub-command to the parent.
 *
 * Note: this linking isn't what actually enables nested sub-command calling,
 * this is only used for displaying what sub-commands are available for any
 * given parent. For information on how sub-commands are executed refer to
 * `executeCommand`
 *
 * @param c ICommand object to prepare
 */
const linkSubCommands = (c: ICommand): ICommand => {
  const { command, subCommands } = c;
  // Add all sub-commands
  for (const subCommand of subCommands) {
    // Recur; link all sub-sub-commands to the sub-command before adding to current
    linkSubCommands(subCommand);

    // Add the subCommand to command
    command
      .command(subCommand.command.name())
      .description(subCommand.command.description());
  }

  return c;
};
