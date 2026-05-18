/**
 * Sims-Parity DT-29 — xrMeasure pure-fn tests.
 */
import { describe, it, expect } from 'vitest';
import {
  buildXrMeasureResult,
  distanceMm,
  floorSpanMm,
  isWebXRArAvailable,
} from '../xrMeasure';

describe('DT-29 / xrMeasure', () => {
  it('distanceMm: 1 m → 1000 mm', () => {
    expect(distanceMm({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBe(1000);
  });
  it('distanceMm: 3-4-5 triangle', () => {
    expect(distanceMm({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(5000);
  });
  it('floorSpanMm ignores y-axis', () => {
    expect(floorSpanMm({ x: 0, y: 1.5, z: 0 }, { x: 1, y: 0, z: 0 })).toBe(1000);
    expect(floorSpanMm({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 })).toBeCloseTo(Math.sqrt(2) * 1000, 4);
  });
  it('buildXrMeasureResult shapes the packet correctly', () => {
    const r = buildXrMeasureResult({ x: 0, y: 0, z: 0 }, { x: 0.8, y: 0, z: 0 });
    expect(r.mode).toBe('two-tap-floor');
    expect(r.widthMm).toBe(800);
    expect(r.anchorA).toEqual({ x: 0, y: 0, z: 0 });
    expect(r.anchorB).toEqual({ x: 0.8, y: 0, z: 0 });
  });
  it('isWebXRArAvailable: returns false in node/jsdom (no navigator.xr)', async () => {
    expect(await isWebXRArAvailable()).toBe(false);
  });
});
