import { describe, it, expect } from 'vitest';
import { SNAP_STEP_MM, snapToGrid } from '../useGridSnap';

describe('DT-12 / snapToGrid', () => {
  it('snaps 250 to 500 (nearest 50 cm)', () => {
    const r = snapToGrid({ xMm: 250, yMm: 600 });
    expect(r.xMm).toBe(500);
    expect(r.yMm).toBe(500);
    expect(r.snapped).toBe(true);
  });
  it('returns same position when already on the grid', () => {
    const r = snapToGrid({ xMm: 1000, yMm: 500 });
    expect(r.xMm).toBe(1000);
    expect(r.yMm).toBe(500);
    expect(r.snapped).toBe(false);
  });
  it('rounds down for x.499', () => {
    const r = snapToGrid({ xMm: 249, yMm: 0 });
    expect(r.xMm).toBe(0);
  });
  it('rounds up for x.500', () => {
    const r = snapToGrid({ xMm: 250, yMm: 0 });
    expect(r.xMm).toBe(500);
  });
  it('freeFloat bypasses snap', () => {
    const r = snapToGrid({ xMm: 247, yMm: 313, freeFloat: true });
    expect(r.xMm).toBe(247);
    expect(r.yMm).toBe(313);
    expect(r.snapped).toBe(false);
  });
  it('honours custom step', () => {
    const r = snapToGrid({ xMm: 130, yMm: 80, stepMm: 100 });
    expect(r.xMm).toBe(100);
    expect(r.yMm).toBe(100);
  });
  it('SNAP_STEP_MM is locked at 500 (V-GAME-3 = 50 cm)', () => {
    expect(SNAP_STEP_MM).toBe(500);
  });
});
