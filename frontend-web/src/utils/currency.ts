// Currencies with no subunit (no cents) — amounts are stored as whole numbers
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'IDR', 'CLP']);

/**
 * Format a stored integer amount as a localized currency string.
 * For zero-decimal currencies (JPY etc.) the integer IS the amount.
 * For others it represents cents (e.g. 1234 => $12.34).
 */
export function formatCents(amount: number, currency: string): string {
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: isZeroDecimal ? 0 : 2,
    maximumFractionDigits: isZeroDecimal ? 0 : 2,
  }).format(amount / 100);
}

/**
 * Parse a user-typed string into a stored integer amount (always *100).
 * e.g. parseToCents("51", "JPY")   => 5100
 * e.g. parseToCents("12.34", "USD") => 1234
 */
export function parseToCents(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const float = parseFloat(cleaned);
  if (isNaN(float) || float < 0) return NaN;
  return Math.round(float * 100);
}

/**
 * Convert a stored integer amount to a decimal string for input display.
 * For zero-decimal currencies: 5100 => "51"
 * For others: 1234 => "12.34"
 */
export function centsToDecimal(amount: number, currency: string): string {
  const value = amount / 100;
  if (ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())) {
    return String(Math.round(value));
  }
  return value.toFixed(2);
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
