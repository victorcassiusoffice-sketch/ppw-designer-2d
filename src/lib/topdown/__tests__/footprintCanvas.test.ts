/**
 * footprintCanvas — deterministic scale-contract coverage.
 *
 * The whole point of the module is that the footprint canvas dimensions are
 * a pure function of the product's real cm, at a fixed px/cm. If these
 * numbers drift, every stored normalised asset silently mis-scales on the
 * 0.5 m grid — so the contract is pinned here.
 */
import { describe, it, expect } from 'vitest';
import {
  PX_PER_CM,
  footprintCanvasPx,
  containFit,
  nearestGenRatio,
  FootprintError,
} from '../footprintCanvas';

describe('footprintCanvasPx', () => {
  it('maps cm → px at the fixed scale (60×40 cm → 600×400 px @10px/cm)', () => {
    const c = footprintCanvasPx(60, 40);
    expect(PX_PER_CM).toBe(10);
    expect(c.wPx).toBe(600);
    expect(c.hPx).toBe(400);
    expect(c.pxPerCm).toBe(10);
  });

  it('rounds fractional cm to whole px', () => {
    expect(footprintCanvasPx(60.04, 39.96).wPx).toBe(600);
    expect(footprintCanvasPx(60.04, 39.96).hPx).toBe(400);
  });

  it('honours a custom px/cm', () => {
    const c = footprintCanvasPx(60, 40, 5);
    expect(c.wPx).toBe(300);
    expect(c.hPx).toBe(200);
  });

  it('rejects non-finite / out-of-range dimensions', () => {
    expect(() => footprintCanvasPx(0, 40)).toThrow(FootprintError);
    expect(() => footprintCanvasPx(60, 0)).toThrow(FootprintError);
    expect(() => footprintCanvasPx(NaN, 40)).toThrow(FootprintError);
    expect(() => footprintCanvasPx(60, 99999)).toThrow(FootprintError);
  });
});

describe('containFit', () => {
  it('scales down to fit and centres (wide src in square box)', () => {
    const r = containFit({ width: 200, height: 100 }, { width: 100, height: 100 });
    expect(r.width).toBe(100);
    expect(r.height).toBe(50);
    expect(r.offsetX).toBe(0);
    expect(r.offsetY).toBe(25);
  });

  it('preserves aspect (tall src)', () => {
    const r = containFit({ width: 100, height: 400 }, { width: 200, height: 200 });
    expect(r.width).toBe(50);
    expect(r.height).toBe(200);
    expect(r.offsetX).toBe(75);
    expect(r.offsetY).toBe(0);
  });

  it('rejects non-positive dimensions', () => {
    expect(() => containFit({ width: 0, height: 10 }, { width: 10, height: 10 })).toThrow(FootprintError);
  });
});

describe('nearestGenRatio', () => {
  it('picks square for ~1:1 footprints', () => {
    expect(nearestGenRatio(100, 100)).toBe('1024:1024');
    expect(nearestGenRatio(105, 100)).toBe('1024:1024');
  });

  it('picks a landscape ratio for wide footprints (200×90 treadmill)', () => {
    expect(nearestGenRatio(200, 90)).toBe('1920:1080');
  });

  it('picks a portrait ratio for deep-narrow footprints', () => {
    expect(nearestGenRatio(90, 200)).toBe('1080:1920');
  });

  it('defaults to square on bad input', () => {
    expect(nearestGenRatio(0, 0)).toBe('1024:1024');
    expect(nearestGenRatio(NaN, 5)).toBe('1024:1024');
  });
});
