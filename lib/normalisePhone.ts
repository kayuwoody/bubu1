/**
 * Normalise a Malaysian phone number to local format (0XXXXXXXXX).
 * Handles: 0123456789 / 60123456789 / +60123456789
 */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('60') && digits.length >= 10) {
    return '0' + digits.slice(2);
  }
  return digits;
}

/**
 * Returns true for a plausible Malaysian phone number:
 * starts with 01 (mobile) or 03/04/05/06/07/09 (landline), 10–11 digits total.
 */
export function isValidMalaysianPhone(normalised: string): boolean {
  return /^0[1-9]\d{7,9}$/.test(normalised);
}
