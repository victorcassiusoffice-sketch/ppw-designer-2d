import { describe, expect, it } from 'vitest';
import { fitPlanViewport } from '../fitPlanViewport';
import { computeZoomScale, ZOOM_MIN_SCALE } from '../zoom';

describe('whole-building plan fit', () => {
  it('fits all 11.5 × 8.5 m on a 390 px phone after the 59 px construction rail', () => {
    const bounds = { minX: 0, minY: 0, maxX: 1150, maxY: 850 };
    const fit = fitPlanViewport(bounds, 390 - 59, 540)!;
    expect(fit.scale).toBeLessThan(0.3);
    expect(fit.x).toBeCloseTo(40);
    expect(fit.x + bounds.maxX * fit.scale).toBeCloseTo(331 - 40);
    expect(fit.y).toBeGreaterThanOrEqual(40);
    expect(fit.y + bounds.maxY * fit.scale).toBeLessThanOrEqual(540 - 40);
    const zoomed = computeZoomScale(fit.scale, -1, Math.min(ZOOM_MIN_SCALE, fit.scale));
    expect(zoomed).toBeCloseTo(fit.scale * 1.08);
    expect(computeZoomScale(zoomed, 1, fit.scale)).toBeCloseTo(fit.scale);
  });
  it('centres offset buildings and accounts for right/bottom panels before fitting', () => {
    const bounds = { minX: -400, minY: 250, maxX: 1600, maxY: 1750 };
    const fit = fitPlanViewport(bounds, 1280 - 320, 720 - 180)!;
    const left = fit.x + bounds.minX * fit.scale, right = fit.x + bounds.maxX * fit.scale;
    const top = fit.y + bounds.minY * fit.scale, bottom = fit.y + bounds.maxY * fit.scale;
    expect(left).toBeGreaterThanOrEqual(40); expect(right).toBeLessThanOrEqual(920);
    expect(top).toBeCloseTo(40); expect(bottom).toBeCloseTo(500);
    expect(left + right).toBeCloseTo(960); expect(top + bottom).toBeCloseTo(540);
  });
  it('keeps ordinary rooms at 100% maximum and ignores unmeasured canvases', () => {
    const bounds = { minX: 0, minY: 0, maxX: 300, maxY: 400 };
    expect(fitPlanViewport(bounds, 1000, 800)?.scale).toBe(1);
    expect(fitPlanViewport(bounds, 0, 800)).toBeNull();
    expect(fitPlanViewport(bounds, 1000, Number.NaN)).toBeNull();
    expect(fitPlanViewport({ ...bounds, maxX: 0 }, 1000, 800)).toBeNull();
  });
});
