/**
 * Format integer cents as a localized currency string.
 * e.g. formatCents(1234, 'USD') => "$12.34"
 */
export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Parse a user-typed decimal string into integer cents.
 * e.g. parseToCents("12.34") => 1234
 * e.g. parseToCents("12")    => 1200
 * Returns NaN if the input is not a valid non-negative number.
 */
export function parseToCents(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const float = parseFloat(cleaned);
  if (isNaN(float) || float < 0) return NaN;
  return Math.round(float * 100);
}

/**
 * Convert cents to a decimal string for input display.
 * e.g. centsToDecimal(1234) => "12.34"
 */
export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

const SUPPORTED_CURRENCIES = [
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'JPY', label: 'Japanese Yen (¥)' },
  { code: 'CAD', label: 'Canadian Dollar (CA$)' },
  { code: 'AUD', label: 'Australian Dollar (A$)' },
  { code: 'CHF', label: 'Swiss Franc (CHF)' },
  { code: 'CNY', label: 'Chinese Yuan (¥)' },
  { code: 'INR', label: 'Indian Rupee (₹)' },
  { code: 'KRW', label: 'Korean Won (₩)' },
  { code: 'THB', label: 'Thai Baht (฿)' },
  { code: 'SGD', label: 'Singapore Dollar (S$)' },
];

export { SUPPORTED_CURRENCIES };
