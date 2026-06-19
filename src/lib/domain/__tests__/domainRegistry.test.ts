/**
 * Phase 1 foundation — domain registry pure-fn tests.
 * Guards the seam that the airplane + car expansion phases build on.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DOMAIN,
  isDomainId,
  getDomain,
  listDomains,
  listEnabledDomains,
} from '../domainRegistry';

describe('domain registry — Phase 1 foundation', () => {
  it('defaults to wellness-room (no behaviour change for existing users)', () => {
    expect(DEFAULT_DOMAIN).toBe('wellness-room');
    expect(getDomain(DEFAULT_DOMAIN).enabled).toBe(true);
  });

  it('registers all three planned domains', () => {
    const ids = listDomains().map((d) => d.id);
    expect(ids).toEqual(['wellness-room', 'airplane', 'car']);
  });

  it('keeps airplane + car disabled until their phases ship', () => {
    expect(getDomain('airplane').enabled).toBe(false);
    expect(getDomain('car').enabled).toBe(false);
    expect(listEnabledDomains().map((d) => d.id)).toEqual(['wellness-room']);
  });

  it('every domain carries a complete behavioural descriptor', () => {
    for (const d of listDomains()) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.tagline.length).toBeGreaterThan(0);
      expect(d.catalogScope.length).toBeGreaterThan(0);
      expect(d.render.primary2d).toBeTruthy();
    }
  });

  it('isDomainId narrows valid ids and rejects junk', () => {
    expect(isDomainId('car')).toBe(true);
    expect(isDomainId('wellness-room')).toBe(true);
    expect(isDomainId('yacht')).toBe(false);
    expect(isDomainId('')).toBe(false);
    expect(isDomainId('toString')).toBe(false); // proto-pollution guard
  });

  it('getDomain throws on an unknown id', () => {
    // @ts-expect-error — intentionally passing an invalid id
    expect(() => getDomain('spaceship')).toThrow(/Unknown domain/);
  });
});
