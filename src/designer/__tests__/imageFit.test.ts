/** Aspect fix (2026-08-24) — fitImageToFootprint unit suite. */
import { describe, expect, it } from 'vitest';
import { fitImageToFootprint } from '../imageFit';

describe('fitImageToFootprint', () => {
  it('matching-aspect art fills the footprint exactly (no rotation)', () => {
    // 2050×950 art on a 205×95 px footprint — the authored K1 case.
    const f = fitImageToFootprint(2050, 950, 205, 95);
    expect(f.rotationDeg).toBe(0);
    expect(f.drawW).toBe(205);
    expect(f.drawH).toBe(95);
  });

  it('square art on a long footprint is contained, never stretched', () => {
    // 400×400 placeholder on a 205×95 footprint: previously stretched
    // 2.16:1 — now a centred 95×95 square.
    const f = fitImageToFootprint(400, 400, 205, 95);
    expect(f.rotationDeg).toBe(0);
    expect(f.drawW).toBeCloseTo(95);
    expect(f.drawH).toBeCloseTo(95);
  });

  it('portrait art on a landscape footprint rotates 90° to align long axes', () => {
    // 600×1200 (portrait) art, 200×100 (landscape) footprint.
    const f = fitImageToFootprint(600, 1200, 200, 100);
    expect(f.rotationDeg).toBe(90);
    // Post-rotation extents: 1200→along footW, 600→along footH.
    // scale = min(200/1200, 100/600) = 1/6 → draw 100×200 pre-rotation.
    expect(f.drawW).toBeCloseTo(100);
    expect(f.drawH).toBeCloseTo(200);
  });

  it('portrait art matching the rotated aspect snap-fills after rotation', () => {
    // 950×2050 portrait art on a 205×95 landscape footprint.
    const f = fitImageToFootprint(950, 2050, 205, 95);
    expect(f.rotationDeg).toBe(90);
    expect(f.drawW).toBe(95);
    expect(f.drawH).toBe(205);
  });

  it('mildly-off aspect within 2% snaps to exact fill', () => {
    const f = fitImageToFootprint(2020, 950, 205, 95); // 2.13 vs 2.16 → 1.5% off
    expect(f.drawW).toBe(205);
    expect(f.drawH).toBe(95);
  });

  it('wider-than-footprint art is height-limited by width', () => {
    // 4:1 art on a 2:1 footprint → width-bound: draw 200×50.
    const f = fitImageToFootprint(2000, 500, 200, 100);
    expect(f.rotationDeg).toBe(0);
    expect(f.drawW).toBeCloseTo(200);
    expect(f.drawH).toBeCloseTo(50);
  });

  it('degenerate inputs fall back to a plain fill', () => {
    const f = fitImageToFootprint(0, 0, 200, 100);
    expect(f.drawW).toBe(200);
    expect(f.drawH).toBe(100);
  });
});
