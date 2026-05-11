/**
 * CurrencySwitcher — Week 3.
 *
 * Tiny dropdown that swaps the display currency app-wide. Reads from
 * and writes to `currencyStore`; persists the choice via `saveCurrency`.
 */

import { useCurrencyStore } from '../store/currencyStore';
import { SUPPORTED_CURRENCIES } from '../lib/region';
import type { Currency } from '../data/products.schema';

export interface CurrencySwitcherProps {
  /** Strip the label prefix — useful in a tight TopBar. */
  compact?: boolean;
}

export function CurrencySwitcher({ compact = false }: CurrencySwitcherProps) {
  const currency = useCurrencyStore((s) => s.currency);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);
  const fx = useCurrencyStore((s) => s.fx);

  return (
    <label
      className="flex items-center gap-1 rounded-md border border-ppw-stone bg-white px-2 py-1 text-xs"
      title={
        fx.fallback
          ? 'Using fallback exchange rates (FX feed unavailable).'
          : `Live exchange rates · last refresh ${new Date(fx.fetchedAt).toLocaleString()}`
      }
    >
      {!compact && (
        <span className="text-[10px] uppercase tracking-wide text-ppw-slate">Currency</span>
      )}
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as Currency)}
        className="bg-transparent text-xs font-semibold text-ppw-ink focus:outline-none"
      >
        {SUPPORTED_CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {fx.fallback && (
        <span className="text-[9px] text-ppw-coral" title="Live FX feed unavailable">
          •
        </span>
      )}
    </label>
  );
}
