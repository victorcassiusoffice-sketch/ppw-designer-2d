/**
 * Currency formatter — Week 3 unit tests.
 *
 * Checks that each supported currency gets the right symbol and locale
 * grouping, and that fraction-digit policy is consistent.
 */
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCurrencyCompact } from '../currency';

describe('formatCurrency', () => {
  it('formats MUR with "Rs" prefix and zero decimals', () => {
    const out = formatCurrency(123456, 'MUR');
    expect(out.startsWith('Rs ')).toBe(true);
    expect(out).toContain('123');
    expect(out).not.toMatch(/\.\d/);
  });

  it('formats USD with $ prefix', () => {
    const out = formatCurrency(1299, 'USD');
    expect(out.startsWith('$')).toBe(true);
    expect(out).toContain('1');
    expect(out).toContain('299');
  });

  it('formats EUR with € prefix', () => {
    const out = formatCurrency(1234.5, 'EUR');
    expect(out.startsWith('€')).toBe(true);
  });

  it('formats GBP with £ prefix', () => {
    const out = formatCurrency(1000, 'GBP');
    expect(out.startsWith('£')).toBe(true);
  });

  it('uses 2 decimals for non-integer non-MUR amounts', () => {
    const out = formatCurrency(12.34, 'USD');
    expect(out).toMatch(/\.\d{2}$/);
  });

  it('honours the fractionDigits override', () => {
    expect(formatCurrency(1, 'USD', { fractionDigits: 2 })).toBe('$1.00');
  });

  it('honours noSymbol', () => {
    expect(formatCurrency(100, 'USD', { noSymbol: true })).toBe('100');
  });

  it('uses locale-aware grouping', () => {
    // en-US uses comma as grouping separator
    const out = formatCurrency(1000000, 'USD');
    expect(out).toContain(',');
  });
});

describe('formatCurrencyCompact', () => {
  it('returns full value below 1k', () => {
    const out = formatCurrencyCompact(999, 'USD');
    expect(out).not.toContain('k');
  });

  it('returns k-suffixed for >= 1k', () => {
    expect(formatCurrencyCompact(1300, 'USD')).toContain('1.3k');
  });

  it('drops the decimal at >= 10k', () => {
    expect(formatCurrencyCompact(50000, 'USD')).toContain('50k');
  });
});
