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
