/**
 * CurrencySwitcher — Week 3.
 *
 * Tiny dropdown that swaps the display currency app-wide. Reads from
 * and writes to `currencyStore`; persists the choice via `saveCurrency`.
 *
 * 2026-08-29 toolbar contract: a 40 px (44 px on mobile) chrome control —
 * paper ground, hairline rim, charcoal 12/500 text, radius 8, 120 ms
 * hover, mint focus ring. The FX-fallback marker is a 6 px CHROME_TEXT_2
 * dot with a title plus visually-hidden "approximate rates" text, not 9 px
 * text (nothing in the chrome is below 11 px). It is NOT terracotta:
 * terracotta is the destructive colour and the dot read as an error badge
 * (polish 2026-08-29).
 */

import { useCurrencyStore } from '../store/currencyStore';
import { SUPPORTED_CURRENCIES } from '../lib/region';
import type { Currency } from '../data/products.schema';
import { CHROME_TEXT_2 } from '../designer/blueprintTheme';

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
      className={`inline-flex h-11 md:h-10 shrink-0 items-center gap-2 rounded-lg border border-ppw-rim bg-ppw-chrome text-[12px] font-medium text-ppw-charcoal transition-colors duration-[120ms] ease-out motion-reduce:transition-none hover:bg-[#f3f1ec] hover:border-[rgba(42,41,38,0.35)] focus-within:ring-[3px] focus-within:ring-[rgba(121,199,173,0.45)] ${
        compact ? 'px-2' : 'px-3'
      }`}
      title={
        fx.fallback
          ? 'Using fallback exchange rates (FX feed unavailable).'
          : `Live exchange rates · last refresh ${new Date(fx.fetchedAt).toLocaleString()}`
      }
    >
      {!compact && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ppw-charcoal">
          Currency
        </span>
      )}
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as Currency)}
        aria-label="Currency"
        className="h-full cursor-pointer bg-transparent text-[12px] font-semibold text-ppw-inkDeep focus:outline-none"
      >
        {SUPPORTED_CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {fx.fallback && (
        <span className="inline-flex shrink-0 items-center" title="Live FX feed unavailable">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: CHROME_TEXT_2 }}
            role="img"
            aria-label="Live FX feed unavailable — using fallback rates"
          />
          <span className="sr-only">approximate rates</span>
        </span>
      )}
    </label>
  );
}
