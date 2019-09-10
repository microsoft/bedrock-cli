import commander from "commander";
import { logger } from "../../logger";

/**
 * A simple add command which will take in two numbers <a> and <b> and log the
 * sum of the two
 * @param command Commander object
 */
export const addCommand = (command: commander.Command): void => {
  command
    .command("add <a> <b>")
    .description("Add two numbers <a> and <b> together")
    .option("-r, --radix <radix>")
    .action((a, b, { radix = 10 }) => {
      try {
        const [aNum, bNum] = [a, b].map(num => parseInt(num, radix));
        logger.info(`${a} + ${b} equals ${aNum + bNum}`);
      } catch (err) {
        logger.error(err);
      }
    });
};
