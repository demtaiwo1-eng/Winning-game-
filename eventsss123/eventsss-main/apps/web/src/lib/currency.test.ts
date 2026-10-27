import { describe, expect, it } from 'vitest';
import {
  formatMoneyInput,
  formatMinorCurrency,
  majorToMinorUnits,
  normalizeCurrencyCode,
} from './currency';

describe('currency helpers', () => {
  it('formats a major-unit amount with thousands separators and decimals', () => {
    expect(formatMoneyInput('5000000', true)).toBe('5,000,000.00');
    expect(formatMoneyInput('5000000.5', true)).toBe('5,000,000.50');
  });

  it('converts major units to integer minor units', () => {
    expect(majorToMinorUnits('5,000,000.00')).toBe('500000000');
    expect(majorToMinorUnits('12.5')).toBe('1250');
    expect(majorToMinorUnits('')).toBe('0');
  });

  it('rejects amounts with more than two decimal places', () => {
    expect(() => majorToMinorUnits('12.345')).toThrow();
  });

  it('formats minor units with short currency codes', () => {
    expect(formatMinorCurrency('500000000', 'NGN')).toBe('NGN 5,000,000.00');
    expect(formatMinorCurrency('500000000', 'USD')).toBe('USD 5,000,000.00');
  });

  it('normalizes currency codes and falls back to NGN', () => {
    expect(normalizeCurrencyCode('usd')).toBe('USD');
    expect(normalizeCurrencyCode('invalid')).toBe('NGN');
  });
});
