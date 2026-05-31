import { describe, it, expect } from 'vitest';
import { computeZoomScale, ZOOM_MIN_SCALE, ZOOM_MAX_SCALE } from '../zoom';

// M5 (Customer-UI fix 2026-05-31) — wheel zoom used to leave the scale
// pinned. computeZoomScale is the pure core the functional setViewport now
// uses; these lock its behaviour.
describe('M5 — computeZoomScale (wheel zoom)', () => {
  it('wheel up (deltaY < 0) raises scale above 1, within [0.3, 3]', () => {
    const s = computeZoomScale(1, -100, ZOOM_MIN_SCALE, ZOOM_MAX_SCALE);
    expect(s).toBeGreaterThan(1);
    expect(s).toBeLessThanOrEqual(ZOOM_MAX_SCALE);
  });

  it('wheel down (deltaY > 0) lowers scale, clamped at min', () => {
    const s = computeZoomScale(1, 100, ZOOM_MIN_SCALE, ZOOM_MAX_SCALE);
    expect(s).toBeLessThan(1);
    expect(s).toBeGreaterThanOrEqual(ZOOM_MIN_SCALE);
  });

  it('clamps at the max bound on repeated wheel-up', () => {
    let s = 1;
    for (let i = 0; i < 50; i++) s = computeZoomScale(s, -100, ZOOM_MIN_SCALE, ZOOM_MAX_SCALE);
    expect(s).toBe(ZOOM_MAX_SCALE);
  });

  it('clamps at the min bound on repeated wheel-down', () => {
    let s = 1;
    for (let i = 0; i < 50; i++) s = computeZoomScale(s, 100, ZOOM_MIN_SCALE, ZOOM_MAX_SCALE);
    expect(s).toBe(ZOOM_MIN_SCALE);
  });

  it('is a no-op-direction-consistent monotonic step', () => {
    const up = computeZoomScale(1, -1);
    const down = computeZoomScale(1, 1);
    expect(up).toBeGreaterThan(down);
  });
});
