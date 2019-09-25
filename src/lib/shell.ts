import child_process from "child_process";
import { logger } from "../logger";

/**
 * Promise wrapper for child_process.spawn.
 * Allows users to shell out commands to the host. Uses child_process.spawn()
 * under the hood, so it is safe for long running processes and for processes
 * which output large amounts of text (ie; larger than standard node buffer)
 *
 * @example
 *  exec("ls", ["-l", "-a"])
 *    .then(stdout => console.log(stdout))
 *    .catch(stderr => console.error(stderr))
 *
 * @param cmd Command to run on host
 * @param args Arguments to pass to the command
 * @param opts Options to pass to child_process.spawn()
 */
export const exec = async (
  cmd: string,
  args: string[] = [],
  opts: child_process.SpawnOptions = {}
): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const process = child_process.spawn(cmd, args, opts);
    const cmdString = `${cmd} ${args.join(" ")}`;
    let stdout = "";
    let stderr = "";

    // Capture stdout/stderr as process runs
    if (process.stdout) {
      process.stdout.on("data", data => {
        logger.debug(`stdout -> '${cmdString}' -> ${data}`.trim());
        stdout = stdout + data;
      });
    }
    if (process.stderr) {
      process.stderr.on("data", data => {
        logger.debug(`stderr -> '${cmdString}' -> ${data}`.trim());
        stderr = stderr + data;
      });
    }

    // Reject on error
    process.on("error", err => {
      logger.verbose(`'${cmdString}' encountered an error during execution`);
      logger.verbose(err);
      reject(err);
    });

    // Resolve promise on completion
    process.on("exit", code => {
      // Log completion of of command
      logger.verbose(`'${cmdString}' exited with code: ${code}`);
      if (stdout.length > 0) {
        logger.verbose(`'${cmdString}': ${stdout}`.trim());
      }
      if (stderr.length > 0) {
        logger.verbose(`'${cmdString}': ${stderr}`.trim());
      }

      // Resolve stdout if process exits with 0; else reject with stderr
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim()));
      }
    });
  });
};
