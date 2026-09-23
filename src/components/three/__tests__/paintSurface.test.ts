import { describe, expect, it } from 'vitest';
import { paintAlbedoByte, paintHeightField, paintRoughnessByte } from '../surfaces';

describe('paint wall stipple', () => {
  it('builds a normalised roller field whose albedo stays near white', () => {
    const height = paintHeightField(64);
    expect(height.length).toBe(64 * 64);
    let sum = 0;
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of height) {
      sum += v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
    expect(hi - lo).toBeGreaterThan(0.5);
    const mean = sum / height.length;
    expect(mean).toBeGreaterThan(0.35);
    expect(mean).toBeLessThan(0.65);

    const bytes = Array.from(height, (v) => paintAlbedoByte(v, 6));
    expect(Math.min(...bytes)).toBeGreaterThanOrEqual(243);
    expect(Math.max(...bytes)).toBeLessThanOrEqual(255);
    const byteMean = bytes.reduce((a, b) => a + b, 0) / bytes.length;
    expect(byteMean).toBeGreaterThan(244);
    expect(byteMean).toBeLessThan(254);
  });

  it('modulates roughness around the finish instead of replacing it', () => {
    expect(paintRoughnessByte(0)).toBe(Math.round(0.84 * 255));
    expect(paintRoughnessByte(1)).toBe(255);
    expect(paintRoughnessByte(0.5)).toBeGreaterThan(220);
    expect(paintRoughnessByte(0.5)).toBeLessThan(255);
  });
});
