/**
 * Deep clone an object.
 *
 * @param obj Object to clone
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
