import { transports, Logger } from "winston";
/**
 * Deep clone an object.
 *
 * @param obj Object to clone
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Halt the thread for a duration.
 *
 * @param timeInSecond duration in millisecond
 */
export const sleep = (timeInMs: number): Promise<unknown> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, timeInMs);
  });
};

export const turnOffConsoleLogging = (logger: Logger): void => {
  //If logging level is not verbose
  if (logger.level !== "silly") {
    logger.transports.forEach((t) => {
      if (t instanceof transports.Console) {
        t.silent = true;
      }
    });
  }
};

export const turnOnConsoleLogging = (logger: Logger): void => {
  logger.transports.forEach((t) => {
    if (t instanceof transports.Console) {
      t.silent = false;
    }
  });
};
