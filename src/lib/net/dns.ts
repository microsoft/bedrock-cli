////////////////////////////////////////////////////////////////////////////////
// DNS helper functions
//
// Use these functions for sanitization and validation of DNS names and DNS name
// segments.
////////////////////////////////////////////////////////////////////////////////

export const validDnsRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

/**
 * Returns if the dns string `segment` is composed only of DNS compliant
 * characters.
 * Passing this does not make the `segment` a valid DNS name -- use isValid()
 * for that functionality.
 *
 * @param segment the string to validate contains only DNS compliant characters
 */
export const containsValidCharacters = (segment: string): boolean => {
  return !!segment.match(/^[0-9a-z-.]+$/);
};

/**
 * Returns if the `dns` string provided is a valid DNS-1123 name.
 *
 * @param dns string to validate is a DNS compliant string
 */
export const isValid = (dns: string): boolean => {
  return !!dns.match(validDnsRegex);
};

/**
 * Makes the provided `dns` string contain only DNS-1123 compliant characters.
 *
 * - All characters are converted to lower case
 * - All non-alphanumerics, non-dashes ('-'), and non-dots ('.') are converted
 *   to dashes ('-')
 *
 * @param dns the dns string to replace all illegal characters from
 */
export const replaceIllegalCharacters = (dns: string): string => {
  return dns.toLowerCase().replace(/[^0-9a-z-.]/g, "-");
};

/**
 * Asserts that the provided `dns` is a valid RFC1123 name/value.
 * @throws {Error} when `dns` is not RFC1123 compliant
 *
 * @params fieldName the name of thing being validated, used to create Error
 *         message
 * @params dns to validate
 */
export function assertIsValid(
  fieldName: string,
  dns: string
): asserts dns is string {
  if (!isValid(dns)) {
    throw Error(
      `Invalid ${fieldName} '${dns}' provided for Traefik IngressRoute. Must be RFC1123 compliant and match regex: ${validDnsRegex}`
    );
  }
}
