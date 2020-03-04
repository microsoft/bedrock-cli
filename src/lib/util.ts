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
 * @param timeInSecond duration in milli second
 */
export const sleep = (timeInMilliSecond: number) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, timeInMilliSecond);
  });
};
