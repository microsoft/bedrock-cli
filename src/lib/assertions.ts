/**
 * String type-guard
 *
 * @param value value to type-guard as a string
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Assertion helper to assert that `value` is a string with a length greater
 * than 0
 *
 * @param value value to assert is string of length greater than 0
 * @param variableName name of the variable being asserted -- used for clearer error messages if provided
 */
export function assertIsStringWithContent(
  value: unknown,
  variableName?: string
): asserts value is string {
  if (!isString(value) || value.length === 0) {
    const valueType = typeof value;
    const errorMessage = variableName
      ? `${variableName} expected to be of type 'string' with length greater than 0, '${valueType}' provided with value '${value}'`
      : `expected value of type 'string' with length greater than 0, '${valueType}' provided with value '${value}'`;
    throw TypeError(errorMessage);
  }
}
