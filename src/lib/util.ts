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
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, timeInMs);
  });
};
