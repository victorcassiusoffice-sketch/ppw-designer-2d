/**
 * Sims-style wall-aware placement (2026-08-23) — unit suite.
 *
 * Room convention in these tests: 5 × 4 m rectangle, origin top-left,
 * y grows DOWN (screen space). Walls: top y=0, right x=5, bottom y=4,
 * left x=0. Front convention: at rotation 0 the object faces +Y
 * (image-bottom / toward the viewer); back is the top edge.
 */
import { describe, expect, it } from 'vitest';
import {
  WALL_SNAP_GAP_M,
  autoOrientDeg,
  isCardinalRotation,
  nearestEdge,
  resolveWallAwarePlacement,
} from '../wallAwarePlacement';
import type { Polygon } from '../../lib/geometry';

const ROOM: Polygon = [
  { x: 0, y: 0 },
  { x: 5, y: 0 },
  { x: 5, y: 4 },
  { x: 0, y: 4 },
];

// 2 × 1 m item (e.g. a treadmill footprint), length along X at rotation 0.
const FP = { lengthM: 2, widthM: 1 };

describe('nearestEdge', () => {
  it('finds the top wall with an inward (downward) normal', () => {
    const e = nearestEdge(ROOM, { x: 2.5, y: 0.4 });
    expect(e).not.toBeNull();
    expect(e!.alignment).toBe('horizontal');
    expect(e!.distance).toBeCloseTo(0.4);
    expect(e!.inwardNormal.x).toBeCloseTo(0);
    expect(e!.inwardNormal.y).toBeCloseTo(1);
  });

  it('finds the right wall with an inward (leftward) normal', () => {
    const e = nearestEdge(ROOM, { x: 4.7, y: 2 });
    expect(e!.alignment).toBe('vertical');
    expect(e!.inwardNormal.x).toBeCloseTo(-1);
    expect(e!.inwardNormal.y).toBeCloseTo(0);
  });

  it('returns null for a degenerate polygon', () => {
    expect(nearestEdge([{ x: 0, y: 0 }], { x: 1, y: 1 })).toBeNull();
  });
});

describe('autoOrientDeg', () => {
  it('faces into the room from each wall (front_edge=bottom default)', () => {
    expect(autoOrientDeg({ x: 0, y: 1 })).toBe(0); // top wall → face down
    expect(autoOrientDeg({ x: -1, y: 0 })).toBe(90); // right wall → face left
    expect(autoOrientDeg({ x: 0, y: -1 })).toBe(180); // bottom wall → face up
    expect(autoOrientDeg({ x: 1, y: 0 })).toBe(270); // left wall → face right
  });

  it('offsets by the product front_edge convention', () => {
    // Art whose front is the image TOP: from the top wall it must show
    // its top edge to the room → rotate 180 relative to the default.
    expect(autoOrientDeg({ x: 0, y: 1 }, 'top')).toBe(180);
    expect(autoOrientDeg({ x: -1, y: 0 }, 'left')).toBe(0);
  });
});

describe('isCardinalRotation', () => {
  it('accepts 90° multiples and rejects free angles', () => {
    expect(isCardinalRotation(0)).toBe(true);
    expect(isCardinalRotation(270)).toBe(true);
    expect(isCardinalRotation(-90)).toBe(true);
    expect(isCardinalRotation(45)).toBe(false);
    expect(isCardinalRotation(15)).toBe(false);
  });
});

describe('resolveWallAwarePlacement', () => {
  it('drops mid-room at rotation 0, grid-snapped', () => {
    const r = resolveWallAwarePlacement({
      centreXm: 2.6,
      centreYm: 2.1,
      fp: FP,
      polygon: ROOM,
      snapStep: 0.5,
    });
    expect(r.wallSnapped).toBe(false);
    expect(r.rotationDeg).toBe(0);
    // 2×1 footprint centred at (2.6, 2.1) → top-left (1.6, 1.6) → snapped (1.5, 1.5)
    expect(r.x).toBeCloseTo(1.5);
    expect(r.y).toBeCloseTo(1.5);
  });

  it('snaps flush to the TOP wall facing down (rotation 0)', () => {
    const r = resolveWallAwarePlacement({
      centreXm: 2.5,
      centreYm: 0.6, // back edge would be at 0.1 → within the snap gap
      fp: FP,
      polygon: ROOM,
      snapStep: 0.5,
    });
    expect(r.wallSnapped).toBe(true);
    expect(r.rotationDeg).toBe(0);
    expect(r.y).toBeCloseTo(0); // flush against y=0
    expect(r.x).toBeCloseTo(1.5); // grid along the wall
  });

  it('snaps flush to the RIGHT wall facing left (rotation 90, footprint swapped)', () => {
    const r = resolveWallAwarePlacement({
      centreXm: 4.6,
      centreYm: 2.0,
      fp: FP,
      polygon: ROOM,
      snapStep: 0.5,
    });
    expect(r.wallSnapped).toBe(true);
    expect(r.rotationDeg).toBe(90);
    // At 90° footprint is 1 wide × 2 tall → flush: x = 5 − 1 = 4.
    expect(r.x).toBeCloseTo(4);
  });

  it('snaps flush to the BOTTOM wall facing up (rotation 180)', () => {
    const r = resolveWallAwarePlacement({
      centreXm: 2.5,
      centreYm: 3.5,
      fp: FP,
      polygon: ROOM,
      snapStep: 0.5,
    });
    expect(r.wallSnapped).toBe(true);
    expect(r.rotationDeg).toBe(180);
    expect(r.y).toBeCloseTo(3); // 4 − 1 (footprint depth)
  });

  it('snaps flush to the LEFT wall facing right (rotation 270)', () => {
    const r = resolveWallAwarePlacement({
      centreXm: 0.4,
      centreYm: 2.0,
      fp: FP,
      polygon: ROOM,
      snapStep: 0.5,
    });
    expect(r.wallSnapped).toBe(true);
    expect(r.rotationDeg).toBe(270);
    expect(r.x).toBeCloseTo(0);
  });

  it('respects an explicit user rotation but still snaps flush', () => {
    const r = resolveWallAwarePlacement({
      centreXm: 2.5,
      centreYm: 0.6,
      fp: FP,
      polygon: ROOM,
      snapStep: 0.5,
      userRotationDeg: 180,
    });
    expect(r.rotationDeg).toBe(180); // user facing kept
    expect(r.wallSnapped).toBe(true);
    expect(r.y).toBeCloseTo(0);
  });

  it('does not wall-snap beyond the gap threshold', () => {
    const r = resolveWallAwarePlacement({
      // Back edge gap = 1.0 − 0.5 = 0.5 > WALL_SNAP_GAP_M
      centreXm: 2.5,
      centreYm: 1.0 + FP.widthM / 2 + WALL_SNAP_GAP_M / 2,
      fp: FP,
      polygon: ROOM,
      snapStep: 0.5,
    });
    void r;
    const far = resolveWallAwarePlacement({
      centreXm: 2.5,
      centreYm: 2.0,
      fp: FP,
      polygon: ROOM,
      snapStep: 0.5,
    });
    expect(far.wallSnapped).toBe(false);
    expect(far.rotationDeg).toBe(0);
  });

  it('never auto-rotates on a slanted wall (orientation falls back to 0)', () => {
    const slanted: Polygon = [
      { x: 0, y: 0 },
      { x: 5, y: 1 },
      { x: 5, y: 4 },
      { x: 0, y: 4 },
    ];
    const r = resolveWallAwarePlacement({
      centreXm: 2.5,
      centreYm: 0.9,
      fp: FP,
      polygon: slanted,
      snapStep: 0.5,
    });
    expect(r.wallSnapped).toBe(false);
    expect(r.rotationDeg).toBe(0);
  });
});
