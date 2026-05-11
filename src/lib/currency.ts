/**
 * Currency formatting + locale-aware grouping.
 *
 * `formatCurrency(123456.7, 'MUR')` → "Rs 123,457"
 * `formatCurrency(1299, 'USD')`     → "$1,299"
 * MUR is presented with zero decimals (rupees, integer-ish at our
 * price points); USD/EUR/GBP keep 0 decimals for round prices and 2
 * for fractional. The `minimumFractionDigits` arg lets the caller
 * force 2 when needed (taxes, FX-converted small amounts).
 */

import type { Currency } from '../data/products.schema';
import { CURRENCY_LOCALE, CURRENCY_SYMBOL } from './region';

export interface FormatOpts {
  /** Force this many fraction digits (defaults to "smart" — 0 if int, else 2). */
  fractionDigits?: number;
  /** Skip the currency symbol prefix (used in tables where the header carries it). */
  noSymbol?: boolean;
}

export function formatCurrency(
  amount: number,
  currency: Currency,
  opts: FormatOpts = {},
): string {
  const locale = CURRENCY_LOCALE[currency] ?? 'en-US';
  const isInt = Math.abs(amount - Math.round(amount)) < 0.005;
  const digits =
    opts.fractionDigits ?? (currency === 'MUR' ? 0 : isInt ? 0 : 2);
  const formatted = amount.toLocaleString(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
  if (opts.noSymbol) return formatted;
  const symbol = CURRENCY_SYMBOL[currency];
  // Rs uses a space; the single-char symbols sit tight.
  if (currency === 'MUR') return `${symbol} ${formatted}`;
  return `${symbol}${formatted}`;
}

/** Compact form for narrow chip displays — "$1.3k", "Rs 124k". */
export function formatCurrencyCompact(amount: number, currency: Currency): string {
  if (amount < 1000) return formatCurrency(amount, currency, { fractionDigits: 0 });
  const symbol = CURRENCY_SYMBOL[currency];
  const thousands = amount / 1000;
  const digits = thousands < 10 ? 1 : 0;
  const head = thousands.toFixed(digits);
  if (currency === 'MUR') return `${symbol} ${head}k`;
  return `${symbol}${head}k`;
}
