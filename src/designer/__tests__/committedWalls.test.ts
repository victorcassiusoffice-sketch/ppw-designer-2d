/**
 * CommittedWallsLayer geometry helpers — pure math coverage.
 *
 * Guards the mm→px conversion used to render persistent interior walls
 * (the 2026-07-24 "walls vanish on exit" fix). The React-Konva render itself
 * is exercised by tests/e2e/wall-draw.spec.ts; here we lock the pure geometry.
 */
import { describe, it, expect } from 'vitest';
import { wallLinePoints, wallStrokeWidthPx, segmentLengthM, formatWallLengthM } from '../wallGeometry';
import type { WallSegment } from '../../store/wallStore';

const seg = (over: Partial<WallSegment> = {}): WallSegment => ({
  id: 'w1',
  start: { x_mm: 0, y_mm: 0 },
  end: { x_mm: 2000, y_mm: 1000 },
  thickness_mm: 100,
  height_mm: 2400,
  type: 'full',
  ...over,
});

describe('wallLinePoints', () => {
  it('converts mm endpoints to px at pxPerMetre (mm/1000*pxPerMetre)', () => {
    // 100 px/m: 2000mm → 200px, 1000mm → 100px.
    expect(wallLinePoints(seg(), 100)).toEqual([0, 0, 200, 100]);
  });

  it('scales with pxPerMetre', () => {
    expect(wallLinePoints(seg({ end: { x_mm: 1000, y_mm: 0 } }), 50)).toEqual([0, 0, 50, 0]);
  });
});

describe('wallStrokeWidthPx', () => {
  it('is thickness in px above the 3px floor', () => {
    // 100mm at 100px/m = 10px.
    expect(wallStrokeWidthPx(seg({ thickness_mm: 100 }), 100)).toBe(10);
  });

  it('clamps thin walls to a 3px minimum', () => {
    // 10mm at 100px/m = 1px → floored to 3.
    expect(wallStrokeWidthPx(seg({ thickness_mm: 10 }), 100)).toBe(3);
  });
});

describe('segmentLengthM', () => {
  it('is the Euclidean distance in metres', () => {
    // 3000mm × 4000mm → 5m (3-4-5).
    expect(segmentLengthM({ x_mm: 0, y_mm: 0 }, { x_mm: 3000, y_mm: 4000 })).toBeCloseTo(5, 6);
  });
});

describe('formatWallLengthM', () => {
  it('shows metres to 2dp at or above 1 m', () => {
    expect(formatWallLengthM({ x_mm: 0, y_mm: 0 }, { x_mm: 2500, y_mm: 0 })).toBe('2.50 m');
  });

  it('shows whole centimetres below 1 m', () => {
    expect(formatWallLengthM({ x_mm: 0, y_mm: 0 }, { x_mm: 800, y_mm: 0 })).toBe('80 cm');
  });
});
