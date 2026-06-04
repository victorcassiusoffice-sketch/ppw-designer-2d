/**
 * Sims-Parity DT-11 — gamingV1Flag pure-fn tests.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { isGamingV1Active, GAMING_V1_QUERY_KEY, GAMING_V1_QUERY_VALUE } from '../gamingV1Flag';

// DT-28 engine default/override tests removed with the Babylon viewer (P1-1,
// 2026-06-04). Konva is now the only engine — there is no engine flag to test.

describe('gamingV1Flag — V4 default-ON', () => {
  beforeEach(() => {
    try { if (typeof localStorage !== 'undefined') localStorage.clear(); } catch {}
  });

  it('flag is ON by default (V4 Vic action 2026-05-18)', () => {
    expect(isGamingV1Active('')).toBe(true);
  });
  it('flag stays ON when ?ui=gaming-v1 explicit', () => {
    expect(isGamingV1Active('?ui=gaming-v1')).toBe(true);
  });
  it('flag is OFF when ?ui=classic explicit', () => {
    expect(isGamingV1Active('?ui=classic')).toBe(false);
  });
  it('flag is ON for unrelated ui values (defaults to on)', () => {
    expect(isGamingV1Active('?ui=other')).toBe(true);
  });
  it('exports the query key + value constants', () => {
    expect(GAMING_V1_QUERY_KEY).toBe('ui');
    expect(GAMING_V1_QUERY_VALUE).toBe('gaming-v1');
  });
});
