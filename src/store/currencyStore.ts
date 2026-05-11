/**
 * currencyStore — Week 3.
 *
 * Holds the user's selected display currency and the most recent FX
 * snapshot. The cart store reads this store to compute per-currency
 * totals; the TopBar switcher writes the active currency; the FX
 * snapshot is refreshed by `useFxBootstrap()` on app boot.
 */

import { create } from 'zustand';
import type { Currency } from '../data/products.schema';
import {
  resolveInitialCurrency,
  saveCurrency,
} from '../lib/region';
import {
  type FxSnapshot,
  getFxSnapshot,
  readFxSnapshotSync,
} from '../lib/fx';

interface CurrencyState {
  /** Currently displayed currency throughout the app. */
  currency: Currency;
  /** Most recent FX snapshot (cached or fresh — never null). */
  fx: FxSnapshot;
  /** True if a fetch is currently in flight. */
  loading: boolean;

  setCurrency: (c: Currency) => void;
  refreshFx: (doFetch?: typeof fetch) => Promise<void>;
}

export const useCurrencyStore = create<CurrencyState>((set) => ({
  currency: resolveInitialCurrency(),
  fx: readFxSnapshotSync(),
  loading: false,

  setCurrency: (c) => {
    saveCurrency(c);
    set({ currency: c });
  },

  refreshFx: async (doFetch) => {
    set({ loading: true });
    try {
      const fresh = await getFxSnapshot(doFetch);
      set({ fx: fresh, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));

/**
 * Component-mount hook — kicks off a refresh on first paint. Safe to
 * call from multiple components; only the first one with a stale cache
 * will hit the network.
 */
export function bootstrapFx(): void {
  const { refreshFx } = useCurrencyStore.getState();
  // Fire-and-forget; promise rejections are swallowed inside refreshFx.
  void refreshFx();
}
