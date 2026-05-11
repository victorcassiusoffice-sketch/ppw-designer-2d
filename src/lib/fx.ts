/**
 * FX rates — Week 3.
 *
 * Pulls live USD-base rates from exchangerate.host once per 24 h and
 * caches them in localStorage. If the fetch fails (offline, API down,
 * test env without fetch) we fall back to the constants below.
 *
 * Rates are expressed as "1 USD = N <currency>". The MUR rate is the
 * one the cart math depends on most; the others are convenience for
 * the multi-currency display.
 */

import type { Currency } from '../data/products.schema';

export const FX_CACHE_KEY = 'ppw_fx_v1';
export const FX_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const FALLBACK_RATES_USD: Record<Currency, number> = {
  USD: 1,
  MUR: 45,
  EUR: 0.92,
  GBP: 0.79,
};

export interface FxSnapshot {
  /** ISO timestamp when fetched (ms epoch). */
  fetchedAt: number;
  /** Per-currency rate where rate[X] = how many X equal 1 USD. */
  rates: Record<Currency, number>;
  /** True if these came from the fallback constants. */
  fallback: boolean;
}

const ENDPOINT = 'https://api.exchangerate.host/latest?base=USD&symbols=MUR,EUR,GBP';

function fallbackSnapshot(): FxSnapshot {
  return {
    fetchedAt: Date.now(),
    rates: { ...FALLBACK_RATES_USD },
    fallback: true,
  };
}

function readCache(): FxSnapshot | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(FX_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FxSnapshot;
    if (!parsed || typeof parsed.fetchedAt !== 'number' || !parsed.rates) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(snapshot: FxSnapshot): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(FX_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    /* swallow */
  }
}

function isFresh(snapshot: FxSnapshot, now = Date.now()): boolean {
  return now - snapshot.fetchedAt < FX_CACHE_TTL_MS;
}

/** Test/SSR helper — wipe the cached snapshot. */
export function clearFxCache(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(FX_CACHE_KEY);
  } catch {
    /* swallow */
  }
}

/**
 * Force-fetch a fresh snapshot. Returns the fallback if fetch fails.
 * Exported so tests can drive it directly.
 */
export async function fetchFxSnapshot(
  doFetch: typeof fetch | undefined = typeof fetch !== 'undefined' ? fetch : undefined,
): Promise<FxSnapshot> {
  if (!doFetch) return fallbackSnapshot();
  try {
    const res = await doFetch(ENDPOINT);
    if (!res || !res.ok) return fallbackSnapshot();
    const json = (await res.json()) as { rates?: Record<string, number> };
    const r = json?.rates ?? {};
    // Validate the three we care about exist + are positive numbers.
    if (
      typeof r.MUR !== 'number' || r.MUR <= 0 ||
      typeof r.EUR !== 'number' || r.EUR <= 0 ||
      typeof r.GBP !== 'number' || r.GBP <= 0
    ) {
      return fallbackSnapshot();
    }
    return {
      fetchedAt: Date.now(),
      rates: { USD: 1, MUR: r.MUR, EUR: r.EUR, GBP: r.GBP },
      fallback: false,
    };
  } catch {
    return fallbackSnapshot();
  }
}

/**
 * Cache-first: return the cached snapshot if it's < 24 h old, else
 * fetch + cache. Returns the fallback if the fetch fails.
 */
export async function getFxSnapshot(
  doFetch?: typeof fetch,
): Promise<FxSnapshot> {
  const cached = readCache();
  if (cached && isFresh(cached)) return cached;
  const fresh = await fetchFxSnapshot(doFetch);
  writeCache(fresh);
  return fresh;
}

/** Sync read of the cache — returns fallback if nothing cached. */
export function readFxSnapshotSync(): FxSnapshot {
  const cached = readCache();
  if (cached) return cached;
  return fallbackSnapshot();
}

/**
 * Convert an amount between currencies given a snapshot.
 * Math: amount_in_USD = amount / rate[from]; amount_in_to = amount_in_USD × rate[to].
 */
export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  snapshot: FxSnapshot,
): number {
  if (from === to) return amount;
  const rFrom = snapshot.rates[from];
  const rTo = snapshot.rates[to];
  if (!rFrom || !rTo) return amount;
  const inUSD = amount / rFrom;
  return inUSD * rTo;
}
