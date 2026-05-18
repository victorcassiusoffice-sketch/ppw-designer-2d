/**
 * Sims-Parity DT-11 — gamingV1Flag pure-fn tests.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { isGamingV1Active, GAMING_V1_QUERY_KEY, GAMING_V1_QUERY_VALUE } from '../gamingV1Flag';

describe('gamingV1Flag', () => {
  beforeEach(() => {
    try { if (typeof localStorage !== 'undefined') localStorage.clear(); } catch {}
  });

  it('flag is OFF by default', () => {
    expect(isGamingV1Active('')).toBe(false);
  });
  it('flag is ON when ?ui=gaming-v1 present', () => {
    expect(isGamingV1Active('?ui=gaming-v1')).toBe(true);
  });
  it('flag is OFF for other ui values', () => {
    expect(isGamingV1Active('?ui=classic')).toBe(false);
  });
  it('exports the query key + value constants', () => {
    expect(GAMING_V1_QUERY_KEY).toBe('ui');
    expect(GAMING_V1_QUERY_VALUE).toBe('gaming-v1');
  });
});
