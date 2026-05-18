/**
 * Sims-Parity DT-11 — gamingV1Flag pure-fn tests.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { isGamingV1Active, GAMING_V1_QUERY_KEY, GAMING_V1_QUERY_VALUE } from '../gamingV1Flag';
import { isBabylonActive } from '../babylon/engineFlag';
import { getDefaultEngine } from '../babylon/defaultEngine';

describe('DT-28 / engine default + override semantics', () => {
  it('default engine is still Konva (soak gate in effect)', () => {
    expect(getDefaultEngine()).toBe('konva');
  });
  it('?engine=babylon overrides the default', () => {
    expect(isBabylonActive('?engine=babylon')).toBe(true);
  });
  it('?engine=konva overrides even after a future default flip', () => {
    expect(isBabylonActive('?engine=konva')).toBe(false);
  });
  it('no explicit engine param respects getDefaultEngine()', () => {
    expect(isBabylonActive('')).toBe(false); // matches default = konva today
  });
});

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
