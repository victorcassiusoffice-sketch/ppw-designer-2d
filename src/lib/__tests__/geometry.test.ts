/**
 * Vitest - geometry utility unit tests.
 * Week 1/2: rotatedFootprint, snapToGrid, screenToRoom,
 * isInsideRoom, rectsOverlap, collidesWithAny, validatePlacement,
 * resolveDragTarget.
 * Week 2.5: polygon helpers (pointInPolygon, isRectInsidePolygon,
 * polygonPerimeter, polygonArea, isClosingPolygon, rectToPolygon,
 * polygonBounds, distance, pointOnSegment).
 */
import { describe, it, expect } from 'vitest';
import {
  cmToM,
  rotatedFootprint,
  snapToGrid,
  screenToRoom,
  isInsideRoom,
  rectsOverlap,
  collidesWithAny,
  validatePlacement,
  resolveDragTarget,
  pointInPolygon,
  pointOnSegment,
  isRectInsidePolygon,
  polygonArea,
  polygonPerimeter,
  polygonBounds,
  isClosingPolygon,
  rectToPolygon,
  distance,
} from '../geometry';
import type { Polygon } from '../geometry';

describe('cmToM', () => {
  it('divides by 100', () => {
    expect(cmToM(100)).toBe(1);
    expect(cmToM(170)).toBeCloseTo(1.7, 6);
  });
});

describe('rotatedFootprint', () => {
  const fp = { lengthM: 1.7, widthM: 0.8 };
  it('returns input dims for 0deg', () => {
    expect(rotatedFootprint(fp, 0)).toEqual({ w: 1.7, h: 0.8 });
  });
  it('swaps for 90deg', () => {
    expect(rotatedFootprint(fp, 90)).toEqual({ w: 0.8, h: 1.7 });
  });
  it('returns input dims for 180deg', () => {
    expect(rotatedFootprint(fp, 180)).toEqual({ w: 1.7, h: 0.8 });
  });
  it('swaps for 270deg', () => {
    expect(rotatedFootprint(fp, 270)).toEqual({ w: 0.8, h: 1.7 });
  });
  it('handles negative angles by normalising', () => {
    expect(rotatedFootprint(fp, -90)).toEqual({ w: 0.8, h: 1.7 });
    expect(rotatedFootprint(fp, -180)).toEqual({ w: 1.7, h: 0.8 });
  });
  it('handles wrap-around angles', () => {
    expect(rotatedFootprint(fp, 450)).toEqual({ w: 0.8, h: 1.7 });
  });
  it('grows to the true rotated AABB at 45° (free-rotate)', () => {
    // Previously fell through to the unrotated size, so the collision
    // box was smaller than the drawn art at diagonal angles.
    const d = (1.7 + 0.8) * Math.SQRT1_2;
    const r = rotatedFootprint(fp, 45);
    expect(r.w).toBeCloseTo(d, 6);
    expect(r.h).toBeCloseTo(d, 6);
  });
  it('AABB at 30° matches |L·cos|+|W·sin| × |L·sin|+|W·cos|', () => {
    const rad = (30 * Math.PI) / 180;
    const r = rotatedFootprint(fp, 30);
    expect(r.w).toBeCloseTo(1.7 * Math.cos(rad) + 0.8 * Math.sin(rad), 6);
    expect(r.h).toBeCloseTo(1.7 * Math.sin(rad) + 0.8 * Math.cos(rad), 6);
  });
});

describe('snapToGrid', () => {
  it('snaps to default 0.5m', () => {
    expect(snapToGrid(0.24)).toBe(0);
    expect(snapToGrid(0.26)).toBe(0.5);
    expect(snapToGrid(0.74)).toBe(0.5);
    expect(snapToGrid(0.76)).toBe(1);
  });
  it('respects custom step', () => {
    expect(snapToGrid(0.13, 0.1)).toBeCloseTo(0.1, 6);
    expect(snapToGrid(0.17, 0.1)).toBeCloseTo(0.2, 6);
  });
  it('snaps negative values', () => {
    expect(snapToGrid(-0.24) + 0).toBe(0);
    expect(snapToGrid(-0.6)).toBe(-0.5);
    expect(snapToGrid(-0.8)).toBe(-1);
  });
});

describe('screenToRoom', () => {
  const containerRect = { left: 100, top: 50 };
  const pxPerMetre = 100;

  it('inverts identity viewport', () => {
    const v = { x: 0, y: 0, scale: 1 };
    const { xM, yM } = screenToRoom(200, 150, containerRect, v, pxPerMetre);
    expect(xM).toBeCloseTo(1, 6);
    expect(yM).toBeCloseTo(1, 6);
  });

  it('inverts translation', () => {
    const v = { x: 50, y: 25, scale: 1 };
    const { xM, yM } = screenToRoom(200, 150, containerRect, v, pxPerMetre);
    expect(xM).toBeCloseTo(0.5, 6);
    expect(yM).toBeCloseTo(0.75, 6);
  });

  it('inverts uniform scale', () => {
    const v = { x: 0, y: 0, scale: 2 };
    const { xM, yM } = screenToRoom(200, 150, containerRect, v, pxPerMetre);
    expect(xM).toBeCloseTo(0.5, 6);
    expect(yM).toBeCloseTo(0.5, 6);
  });

  it('inverts compound translate+scale', () => {
    const v = { x: 60, y: 40, scale: 0.5 };
    const { xM, yM } = screenToRoom(260, 190, containerRect, v, pxPerMetre);
    expect(xM).toBeCloseTo(2, 6);
    expect(yM).toBeCloseTo(2, 6);
  });

  it('respects custom px-per-metre', () => {
    const v = { x: 0, y: 0, scale: 1 };
    const { xM, yM } = screenToRoom(200, 150, containerRect, v, 200);
    expect(xM).toBeCloseTo(0.5, 6);
    expect(yM).toBeCloseTo(0.5, 6);
  });
});

describe('isInsideRoom (rectangular legacy API)', () => {
  const room = { lengthM: 5, widthM: 4 };
  it('accepts a rect entirely inside', () => {
    expect(isInsideRoom({ x: 1, y: 1, w: 1, h: 1 }, room)).toBe(true);
  });
  it('accepts a rect touching the wall (closed interval)', () => {
    expect(isInsideRoom({ x: 0, y: 0, w: 5, h: 4 }, room)).toBe(true);
  });
  it('rejects a rect crossing the right wall', () => {
    expect(isInsideRoom({ x: 4.5, y: 1, w: 1, h: 1 }, room)).toBe(false);
  });
  it('rejects a rect crossing the bottom wall', () => {
    expect(isInsideRoom({ x: 1, y: 3.5, w: 1, h: 1 }, room)).toBe(false);
  });
  it('rejects a rect with negative origin', () => {
    expect(isInsideRoom({ x: -0.1, y: 1, w: 1, h: 1 }, room)).toBe(false);
  });
});

describe('rectsOverlap', () => {
  it('returns true for overlapping rects', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 })).toBe(true);
  });
  it('returns false for touching-but-not-overlapping rects', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 })).toBe(false);
  });
  it('returns false for disjoint rects', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 1, h: 1 }, { x: 5, y: 5, w: 1, h: 1 })).toBe(false);
  });
  it('returns true for fully contained rects', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 5, h: 5 }, { x: 1, y: 1, w: 1, h: 1 })).toBe(true);
  });
});

describe('collidesWithAny', () => {
  const others = [
    { x: 0, y: 0, w: 1, h: 1, instanceId: 'a' },
    { x: 3, y: 3, w: 1, h: 1, instanceId: 'b' },
  ];
  it('detects collision with one of many', () => {
    expect(collidesWithAny({ x: 0.5, y: 0.5, w: 1, h: 1 }, others)).toBe(true);
  });
  it('returns false when no collision', () => {
    expect(collidesWithAny({ x: 1.5, y: 1.5, w: 1, h: 1 }, others)).toBe(false);
  });
  it('honours ignoreInstanceId', () => {
    expect(collidesWithAny({ x: 0, y: 0, w: 1, h: 1 }, others, 'a')).toBe(false);
  });
});

describe('validatePlacement', () => {
  const room = { lengthM: 5, widthM: 4 };
  const others = [{ x: 1, y: 1, w: 1, h: 1, instanceId: 'a' }];

  it('returns ok for valid placement', () => {
    expect(validatePlacement({ x: 3, y: 0, w: 1, h: 1 }, others, room)).toEqual({ ok: true });
  });
  it('returns out-of-bounds for off-floor placement', () => {
    expect(validatePlacement({ x: 4.5, y: 0, w: 1, h: 1 }, others, room)).toEqual({
      ok: false,
      reason: 'out-of-bounds',
    });
  });
  it('returns collision for overlap', () => {
    expect(validatePlacement({ x: 1.5, y: 1.5, w: 1, h: 1 }, others, room)).toEqual({
      ok: false,
      reason: 'collision',
    });
  });
  it('lets the same instance overlap itself when ignored', () => {
    expect(validatePlacement({ x: 1, y: 1, w: 1, h: 1 }, others, room, 'a')).toEqual({ ok: true });
  });
});

describe('resolveDragTarget - drag -> collision -> snapback (Patch 1)', () => {
  const room = { lengthM: 5, widthM: 4 };
  const others = [
    { x: 1, y: 1, w: 1, h: 1, instanceId: 'a' },
    { x: 3, y: 3, w: 1, h: 1, instanceId: 'b' },
  ];

  it('snaps to grid on a valid drag and returns the new coords', () => {
    const result = resolveDragTarget({
      candidateX: 0.12,
      candidateY: 0.08,
      w: 1,
      h: 1,
      others,
      room,
      ignoreInstanceId: 'b',
    });
    expect(result).toEqual({ ok: true, x: 0, y: 0 });
  });

  it('returns collision when dropped on top of another item (caller snaps back)', () => {
    const result = resolveDragTarget({
      candidateX: 1.2,
      candidateY: 1.1,
      w: 1,
      h: 1,
      others,
      room,
      ignoreInstanceId: 'b',
    });
    expect(result).toEqual({ ok: false, reason: 'collision' });
  });

  it('returns out-of-bounds when dropped past the wall', () => {
    const result = resolveDragTarget({
      candidateX: 4.8,
      candidateY: 0,
      w: 1,
      h: 1,
      others,
      room,
      ignoreInstanceId: 'b',
    });
    expect(result).toEqual({ ok: false, reason: 'out-of-bounds' });
  });

  it('ignores the moving item itself in collision checks', () => {
    const result = resolveDragTarget({
      candidateX: 3,
      candidateY: 3,
      w: 1,
      h: 1,
      others,
      room,
      ignoreInstanceId: 'b',
    });
    expect(result).toEqual({ ok: true, x: 3, y: 3 });
  });
});

// =====================================================================
// Week 2.5 - Polygon helpers
// =====================================================================

describe('rectToPolygon - migration helper', () => {
  it('returns a 4-vertex polygon for a 5x4 m room', () => {
    expect(rectToPolygon({ lengthM: 5, widthM: 4 })).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 0, y: 4 },
    ]);
  });

  it('lengthM maps to +x extent, widthM to +y extent', () => {
    const p = rectToPolygon({ lengthM: 10, widthM: 3 });
    expect(p[0]).toEqual({ x: 0, y: 0 });
    expect(p[1]).toEqual({ x: 10, y: 0 });
    expect(p[2]).toEqual({ x: 10, y: 3 });
    expect(p[3]).toEqual({ x: 0, y: 3 });
  });
});

describe('distance', () => {
  it('returns 0 for identical points', () => {
    expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBeCloseTo(0, 6);
  });
  it('computes Euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5, 6);
  });
});

describe('pointOnSegment', () => {
  it('returns true for a midpoint on a horizontal segment', () => {
    expect(pointOnSegment({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(true);
  });
  it('returns false for an off-segment point', () => {
    expect(pointOnSegment({ x: 1, y: 0.5 }, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(false);
  });
  it('returns true for endpoint', () => {
    expect(pointOnSegment({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(true);
  });
});

describe('pointInPolygon - convex (triangle)', () => {
  const triangle: Polygon = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 2, y: 3 },
  ];

  it('returns true for an interior point', () => {
    expect(pointInPolygon({ x: 2, y: 1 }, triangle)).toBe(true);
  });
  it('returns true for a vertex', () => {
    expect(pointInPolygon({ x: 0, y: 0 }, triangle)).toBe(true);
  });
  it('returns true for an edge midpoint', () => {
    expect(pointInPolygon({ x: 2, y: 0 }, triangle)).toBe(true);
  });
  it('returns false for an exterior point', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, triangle)).toBe(false);
  });
  it('returns false just outside the apex', () => {
    expect(pointInPolygon({ x: 2, y: 3.5 }, triangle)).toBe(false);
  });
});

describe('pointInPolygon - concave (L-shape)', () => {
  const lShape: Polygon = [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 3 },
    { x: 6, y: 3 },
    { x: 6, y: 6 },
    { x: 0, y: 6 },
  ];

  it('returns true for a point inside the bottom rectangle', () => {
    expect(pointInPolygon({ x: 1, y: 1 }, lShape)).toBe(true);
  });
  it('returns true for a point inside the right arm', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, lShape)).toBe(true);
  });
  it('returns false for a point in the cut-out corner', () => {
    expect(pointInPolygon({ x: 5, y: 1 }, lShape)).toBe(false);
  });
});

describe('isRectInsidePolygon - triangle / L-shape', () => {
  const triangle: Polygon = [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 3, y: 6 },
  ];

  it('accepts a small rect at the base of the triangle', () => {
    expect(isRectInsidePolygon({ x: 2, y: 0.5, w: 1, h: 1 }, triangle)).toBe(true);
  });
  it('rejects a rect whose top corners poke past the slanted edge', () => {
    expect(isRectInsidePolygon({ x: 4.5, y: 1, w: 1, h: 1 }, triangle)).toBe(false);
  });

  const lShape: Polygon = [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 3 },
    { x: 6, y: 3 },
    { x: 6, y: 6 },
    { x: 0, y: 6 },
  ];

  it('accepts a rect inside the left arm of an L-room', () => {
    expect(isRectInsidePolygon({ x: 0.5, y: 4, w: 1, h: 1 }, lShape)).toBe(true);
  });
  it('rejects a rect that crosses the L cut-out boundary', () => {
    expect(isRectInsidePolygon({ x: 2.5, y: 0.5, w: 1, h: 1 }, lShape)).toBe(false);
  });
});

describe('polygonPerimeter & polygonArea', () => {
  it('returns 0 perimeter and 0 area for empty / degenerate polygons', () => {
    expect(polygonPerimeter([])).toBe(0);
    expect(polygonArea([])).toBe(0);
    expect(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
  });

  it('matches the expected values for a 5x4 rectangle', () => {
    const r = rectToPolygon({ lengthM: 5, widthM: 4 });
    expect(polygonPerimeter(r)).toBeCloseTo(18, 6);
    expect(polygonArea(r)).toBeCloseTo(20, 6);
  });

  it('matches the expected values for a unit square', () => {
    const sq: Polygon = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(polygonPerimeter(sq)).toBeCloseTo(4, 6);
    expect(polygonArea(sq)).toBeCloseTo(1, 6);
  });

  it('matches the expected values for a 3-4-5 right triangle', () => {
    const tri: Polygon = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 3 },
    ];
    expect(polygonPerimeter(tri)).toBeCloseTo(12, 6);
    expect(polygonArea(tri)).toBeCloseTo(6, 6);
  });

  it('computes a correct area for the L-shape (6x6 minus 3x3 cut-out)', () => {
    const lShape: Polygon = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 6, y: 3 },
      { x: 6, y: 6 },
      { x: 0, y: 6 },
    ];
    expect(polygonArea(lShape)).toBeCloseTo(27, 6);
  });
});

describe('polygonBounds', () => {
  it('returns zero-bounds for empty polygon', () => {
    expect(polygonBounds([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });
  it('returns the AABB of a polygon', () => {
    const lShape: Polygon = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 6, y: 3 },
      { x: 6, y: 6 },
      { x: 0, y: 6 },
    ];
    expect(polygonBounds(lShape)).toEqual({ minX: 0, minY: 0, maxX: 6, maxY: 6 });
  });
});

describe('isClosingPolygon - self-closing detection', () => {
  const partial: Polygon = [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 4 },
  ];

  it('returns false when fewer than 3 vertices present', () => {
    expect(isClosingPolygon([{ x: 0, y: 0 }], { x: 0, y: 0 })).toBe(false);
    expect(isClosingPolygon([{ x: 0, y: 0 }, { x: 1, y: 0 }], { x: 0, y: 0 })).toBe(false);
  });

  it('returns true when candidate is within default 0.4 m of the first vertex', () => {
    expect(isClosingPolygon(partial, { x: 0.2, y: 0.2 })).toBe(true);
  });

  it('returns false when candidate is farther than the threshold', () => {
    expect(isClosingPolygon(partial, { x: 1, y: 1 })).toBe(false);
  });

  it('respects a custom threshold', () => {
    expect(isClosingPolygon(partial, { x: 0.7, y: 0 }, 0.8)).toBe(true);
    expect(isClosingPolygon(partial, { x: 0.7, y: 0 }, 0.6)).toBe(false);
  });
});

// =====================================================================
// Week 2.5 - Polygon-aware validatePlacement (concave correctness)
// =====================================================================

describe('validatePlacement - polygon room (concave)', () => {
  const uShape: Polygon = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
    { x: 4, y: 2 },
    { x: 4, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 4 },
    { x: 0, y: 4 },
  ];

  it('accepts a 1x1 item placed inside the left arm', () => {
    expect(validatePlacement({ x: 0.5, y: 0.5, w: 1, h: 1 }, [], uShape)).toEqual({ ok: true });
  });

  it('rejects a 1x1 item that lands in the notch cut-out', () => {
    expect(validatePlacement({ x: 2.5, y: 0.5, w: 1, h: 1 }, [], uShape)).toEqual({
      ok: false,
      reason: 'out-of-bounds',
    });
  });

  it('accepts a 1x1 item in the bottom strip below the notch', () => {
    expect(validatePlacement({ x: 2.5, y: 2.5, w: 1, h: 1 }, [], uShape)).toEqual({ ok: true });
  });
});
