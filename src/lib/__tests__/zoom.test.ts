import { describe, it, expect } from 'vitest';
import { computeZoomScale, pinchPlanViewport, zoomViewportAt, ZOOM_MIN_SCALE, ZOOM_MAX_SCALE } from '../zoom';

// M5 (Customer-UI fix 2026-05-31) — wheel zoom used to leave the scale
// pinned. computeZoomScale is the pure core the functional setViewport now
// uses; these lock its behaviour.
describe('M5 — computeZoomScale (wheel zoom)', () => {
  it('holds the exact world anchor through 100 phone button zoom cycles', () => {
    const initial = {x:-220, y:80, scale:0.4};
    const anchor = {x:165,y:240};
    let viewport = initial;
    for (let n=0;n<100;n++) {
      viewport = zoomViewportAt(viewport,1.12,anchor);
      viewport = zoomViewportAt(viewport,1/1.12,anchor);
    }
    expect(viewport.x).toBeCloseTo(initial.x,10);
    expect(viewport.y).toBeCloseTo(initial.y,10);
    expect(viewport.scale).toBeCloseTo(initial.scale,10);
  });
  it('keeps a pinched world point under the moving fingers and reverses after scale saturation', () => {
    const start = {viewport:{x:-100,y:30,scale:0.8}, midpoint:{x:160,y:220}, distance:100};
    const next = pinchPlanViewport(start,{x:190,y:260},180);
    expect((190-next.x)/next.scale).toBeCloseTo((160-start.viewport.x)/start.viewport.scale,10);
    expect((260-next.y)/next.scale).toBeCloseTo((220-start.viewport.y)/start.viewport.scale,10);
    expect(pinchPlanViewport(start,start.midpoint,10000).scale).toBe(ZOOM_MAX_SCALE);
    expect(pinchPlanViewport(start,start.midpoint,100)).toEqual(start.viewport);
  });
  it('wheel up (deltaY < 0) raises scale above 1, within the allowed range', () => {
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

  it('can pull back from the old 30% limit to view the whole site', () => {
    let scale = 0.3;
    for (let i = 0; i < 60; i++) scale = computeZoomScale(scale, 100);
    expect(scale).toBe(0.04);
    expect(computeZoomScale(scale, -100)).toBeGreaterThan(scale);
  });
});
