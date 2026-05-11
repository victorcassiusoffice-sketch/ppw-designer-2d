/**
 * Region detection — Week 3.
 *
 * Detects the user's region from navigator.language + IANA timezone with
 * a localStorage override. Returns a 2-letter ISO-3166 code where we can
 * guess one, else falls back to 'MU' (Mauritius — the default market).
 *
 * Region drives:
 *   - Default currency in the TopBar switcher
 *   - Country dropdown default on the checkout form
 *   - Future: region-filtered product palette
 */

import type { Currency } from '../data/products.schema';

export const REGION_STORAGE_KEY = 'ppw_region_v1';
export const CURRENCY_STORAGE_KEY = 'ppw_currency_v1';

/** Supported currencies in the UI. */
export const SUPPORTED_CURRENCIES: Currency[] = ['MUR', 'USD', 'EUR', 'GBP'];

/** ISO-3166 alpha-2 country codes we explicitly map. */
export type CountryCode = string;

/**
 * Hard-coded country → default currency mapping. We keep it small and
 * obvious; anything not listed falls back to USD.
 */
const COUNTRY_TO_CURRENCY: Record<string, Currency> = {
  MU: 'MUR',
  // Eurozone
  FR: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR',
  PT: 'EUR', IE: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR',
  // GBP
  GB: 'GBP', UK: 'GBP',
  // USD / similar
  US: 'USD', CA: 'USD', AU: 'USD', NZ: 'USD',
  ZA: 'USD', AE: 'USD', SG: 'USD', IN: 'USD',
};

/**
 * Map an IANA timezone string to a likely country code. Covers the
 * common cases for our buyer regions; anything else returns null.
 */
function tzToCountry(tz: string): CountryCode | null {
  const lower = tz.toLowerCase();
  if (lower.includes('mauritius') || lower.includes('indian/mauritius')) return 'MU';
  if (lower.startsWith('europe/london')) return 'GB';
  if (lower.startsWith('europe/dublin')) return 'IE';
  if (lower.startsWith('europe/paris')) return 'FR';
  if (lower.startsWith('europe/berlin')) return 'DE';
  if (lower.startsWith('europe/madrid')) return 'ES';
  if (lower.startsWith('europe/rome')) return 'IT';
  if (lower.startsWith('europe/amsterdam')) return 'NL';
  if (lower.startsWith('europe/brussels')) return 'BE';
  if (lower.startsWith('europe/lisbon')) return 'PT';
  if (lower.startsWith('europe/')) return 'EU'; // catch-all eurozone-ish
  if (lower.startsWith('america/los_angeles')) return 'US';
  if (lower.startsWith('america/new_york')) return 'US';
  if (lower.startsWith('america/chicago')) return 'US';
  if (lower.startsWith('america/denver')) return 'US';
  if (lower.startsWith('america/phoenix')) return 'US';
  if (lower.startsWith('america/toronto')) return 'CA';
  if (lower.startsWith('america/vancouver')) return 'CA';
  if (lower.startsWith('australia/')) return 'AU';
  if (lower.startsWith('pacific/auckland')) return 'NZ';
  if (lower.startsWith('africa/johannesburg')) return 'ZA';
  if (lower.startsWith('asia/dubai')) return 'AE';
  if (lower.startsWith('asia/singapore')) return 'SG';
  if (lower.startsWith('asia/kolkata') || lower.startsWith('asia/calcutta')) return 'IN';
  return null;
}

/**
 * Parse an ISO locale ("en-MU", "fr_FR", "en") and return the country
 * portion as ISO-3166-alpha-2 if present.
 */
function localeToCountry(locale: string | undefined): CountryCode | null {
  if (!locale) return null;
  const parts = locale.replace('_', '-').split('-');
  if (parts.length < 2) return null;
  const tail = parts[parts.length - 1];
  if (tail.length === 2) return tail.toUpperCase();
  return null;
}

export interface DetectionInput {
  language?: string;
  timeZone?: string;
  /** Optional saved override (from localStorage). */
  override?: CountryCode | null;
}

/**
 * Pure detection helper — used directly by unit tests so navigator
 * can be mocked without standing up jsdom globals.
 */
export function detectRegionFrom(input: DetectionInput): CountryCode {
  if (input.override && input.override.length === 2) return input.override.toUpperCase();
  const fromLocale = localeToCountry(input.language);
  if (fromLocale && COUNTRY_TO_CURRENCY[fromLocale]) return fromLocale;
  const fromTz = input.timeZone ? tzToCountry(input.timeZone) : null;
  if (fromTz) return fromTz;
  if (fromLocale) return fromLocale;
  return 'MU';
}

/**
 * Detect region in a browser context. Reads `navigator.language` and the
 * resolved IANA timezone, plus the localStorage override if present.
 * Returns 'MU' if neither yields a match.
 */
export function detectRegion(): CountryCode {
  let override: string | null = null;
  if (typeof localStorage !== 'undefined') {
    try {
      override = localStorage.getItem(REGION_STORAGE_KEY);
    } catch {
      override = null;
    }
  }
  const language =
    typeof navigator !== 'undefined' ? navigator.language : undefined;
  let timeZone: string | undefined;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    timeZone = undefined;
  }
  return detectRegionFrom({ language, timeZone, override });
}

/** Default currency for a given country code. */
export function currencyForCountry(country: CountryCode): Currency {
  return COUNTRY_TO_CURRENCY[country.toUpperCase()] ?? 'USD';
}

/**
 * Persist a user-chosen region. Best-effort — silently no-ops if
 * localStorage is unavailable (Node test env, private mode, …).
 */
export function saveRegion(country: CountryCode): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(REGION_STORAGE_KEY, country.toUpperCase());
  } catch {
    /* swallow */
  }
}

export function loadSavedCurrency(): Currency | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (raw && (SUPPORTED_CURRENCIES as string[]).includes(raw)) return raw as Currency;
  } catch {
    /* swallow */
  }
  return null;
}

export function saveCurrency(currency: Currency): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  } catch {
    /* swallow */
  }
}

/** Resolve a starting currency given environment + saved choice. */
export function resolveInitialCurrency(): Currency {
  const saved = loadSavedCurrency();
  if (saved) return saved;
  return currencyForCountry(detectRegion());
}

/**
 * Display label / symbol helpers — used by the currency switcher and
 * the cart totals row.
 */
export const CURRENCY_SYMBOL: Record<Currency, string> = {
  MUR: 'Rs',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export const CURRENCY_LOCALE: Record<Currency, string> = {
  MUR: 'en-MU',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
};

/**
 * Country options used by the checkout form's country dropdown. Order:
 * Mauritius first (the default market), then alphabetised.
 */
export const COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: 'MU', label: 'Mauritius' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'AU', label: 'Australia' },
  { code: 'BE', label: 'Belgium' },
  { code: 'CA', label: 'Canada' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'DE', label: 'Germany' },
  { code: 'ES', label: 'Spain' },
  { code: 'FR', label: 'France' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'IE', label: 'Ireland' },
  { code: 'IN', label: 'India' },
  { code: 'IT', label: 'Italy' },
  { code: 'KE', label: 'Kenya' },
  { code: 'MG', label: 'Madagascar' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'PT', label: 'Portugal' },
  { code: 'SC', label: 'Seychelles' },
  { code: 'SG', label: 'Singapore' },
  { code: 'US', label: 'United States' },
  { code: 'ZA', label: 'South Africa' },
];
