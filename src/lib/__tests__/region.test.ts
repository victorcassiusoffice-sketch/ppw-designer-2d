/**
 * Region detection — Week 3 unit tests.
 */
import { describe, it, expect } from 'vitest';
import {
  detectRegionFrom,
  currencyForCountry,
  COUNTRY_OPTIONS,
} from '../region';

describe('detectRegionFrom', () => {
  it('respects the override when provided', () => {
    expect(detectRegionFrom({ override: 'fr' })).toBe('FR');
    expect(detectRegionFrom({ override: 'MU' })).toBe('MU');
  });

  it('reads the country from a language tag', () => {
    expect(detectRegionFrom({ language: 'en-GB' })).toBe('GB');
    expect(detectRegionFrom({ language: 'fr-FR' })).toBe('FR');
    expect(detectRegionFrom({ language: 'en-MU' })).toBe('MU');
  });

  it('falls back to the timezone if language has no region', () => {
    expect(detectRegionFrom({ language: 'en', timeZone: 'Indian/Mauritius' })).toBe('MU');
    expect(detectRegionFrom({ language: 'en', timeZone: 'Europe/London' })).toBe('GB');
    expect(detectRegionFrom({ language: 'en', timeZone: 'America/New_York' })).toBe('US');
  });

  it('defaults to MU when nothing matches', () => {
    expect(detectRegionFrom({ language: 'en', timeZone: 'Antarctica/Casey' })).toBe('MU');
    expect(detectRegionFrom({})).toBe('MU');
  });

  it('returns uppercase ISO-3166-alpha-2 country codes', () => {
    expect(detectRegionFrom({ language: 'fr-fr' })).toBe('FR');
    expect(detectRegionFrom({ override: 'gb' })).toBe('GB');
  });
});

describe('currencyForCountry', () => {
  it('maps the obvious cases', () => {
    expect(currencyForCountry('MU')).toBe('MUR');
    expect(currencyForCountry('FR')).toBe('EUR');
    expect(currencyForCountry('GB')).toBe('GBP');
    expect(currencyForCountry('US')).toBe('USD');
  });

  it('falls back to USD for unknowns', () => {
    expect(currencyForCountry('XX')).toBe('USD');
  });
});

describe('COUNTRY_OPTIONS', () => {
  it('starts with Mauritius', () => {
    expect(COUNTRY_OPTIONS[0].code).toBe('MU');
  });

  it('covers at least the obvious markets', () => {
    const codes = new Set(COUNTRY_OPTIONS.map((c) => c.code));
    for (const c of ['MU', 'GB', 'US', 'FR', 'AU', 'IN', 'ZA']) {
      expect(codes.has(c)).toBe(true);
    }
  });
});
