/**
 * Shared currency helpers for Ephinta.
 * API fields ending in Minor are integer minor units (kobo/cents).
 * Human-facing inputs are major units, e.g. 5,000,000.00.
 */
export type SupportedCurrencyCode = 'NGN' | 'USD' | (string & {});

const VALID_CURRENCY = /^[A-Z]{3}$/;

export function normalizeCurrencyCode(value?: string | null): string {
  const code = (value || 'NGN').trim().toUpperCase();
  return VALID_CURRENCY.test(code) ? code : 'NGN';
}

export function formatMoneyInput(value: string, fixed = false): string {
  const cleaned = String(value ?? '').replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  const wholeRaw = firstDot < 0 ? cleaned : cleaned.slice(0, firstDot);
  const fractionRaw = firstDot < 0 ? '' : cleaned.slice(firstDot + 1).replace(/\./g, '');
  const whole = (wholeRaw || '').replace(/^0+(?=\d)/, '');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (!fixed && firstDot < 0) return grouped;
  const fraction = fractionRaw.slice(0, 2);
  return fixed
    ? `${grouped || '0'}.${fraction.padEnd(2, '0')}`
    : `${grouped || '0'}.${fraction}`;
}

export function majorToMinorUnits(value: string): string {
  const cleaned = String(value ?? '').replace(/,/g, '').trim();
  if (!cleaned) return '0';
  if (!/^\d*(\.\d{0,2})?$/.test(cleaned)) {
    throw new Error('Enter a valid amount with no more than two decimal places.');
  }
  const [wholePart, fractionPart = ''] = cleaned.split('.');
  const whole = BigInt(wholePart || '0');
  const fraction = BigInt((fractionPart + '00').slice(0, 2));
  return (whole * 100n + fraction).toString();
}

export function formatMinorCurrency(value: string | number | null | undefined, currency?: string): string {
  const raw = String(value ?? '0').trim();
  if (!/^-?\d+$/.test(raw)) return `${normalizeCurrencyCode(currency)} 0.00`;
  const minor = BigInt(raw);
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const whole = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, '0');
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${normalizeCurrencyCode(currency)} ${negative ? '-' : ''}${grouped}.${fraction}`;
}
