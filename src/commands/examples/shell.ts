import commander from "commander";
import fs from "fs";
import shell from "shelljs";
import { logger } from "../../logger";

/**
 * A simple Commander decorator which adds a `shell` command to run any `<cmd>`
 * on the host with the provided `[args...]`
 * @param command Commander object
 */
export const shellCommand = (command: commander.Command): void => {
  command
    // Arrow brackets denote a required positional argument
    // Square brackets denote optional arguments
    // The last parameter can be variadic; denoted with trailing `...`
    .command("shell <cmd> [args...]") // Commander will automatically parse this string and populate the args in the .action() below
    .alias("sh") // Can give a short hand to the command
    .description(
      "Shell out to the host and run command <cmd> with args [args...]"
    )
    .option("-s, --silent", "Run silently; will not echo stdout/stderr") // option will be bound as a key (the full long form, in this case 'silent') to the last arg of .action()
    .option(
      "-o, --output <out file>",
      "Output the contents of stdout to out_file"
    ) // If the flag is followed by a variable in arrow brackets, the flag is a parsed as a value (instead of a default boolean). In this case the value will be bound to 'output'
    // Arguments are fed into .action in the order defined by the closest parent .command
    // First will be the required <cmd> (arrow brackets denote required)
    // Second will be the an variadic array of [args...] (square brackets denote optional, so it may be undefined)
    // The last will always be the command object itself; you get any of the .option applied to the command from it
    .action((cmd, args, opts) => {
      const { silent = false, output } = opts;
      const shellCmd = `${cmd} ${args.join(" ")}`;
      shell.exec(shellCmd, { silent: !!silent }, (code, stdout, stderr) => {
        logger.info("Exit code:", code);
        logger.info(stdout);
        if (output) {
          fs.writeFileSync(output, stdout, { encoding: "utf8" });
        }
        if (stderr) {
          logger.error(stderr);
        }
      });
    });
};
