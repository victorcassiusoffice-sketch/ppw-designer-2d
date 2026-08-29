/**
 * Sims-style wall-aware placement (2026-08-23, reworked 2026-08-29) — unit suite.
 *
 * Room convention in these tests: 5 × 4 m rectangle, origin top-left,
 * y grows DOWN (screen space). Walls: top y=0, right x=5, bottom y=4,
 * left x=0. Front convention: at rotation 0 the object faces +Y
 * (image-bottom / toward the viewer); back is the top edge.
 *
 * Walls are WALL_THICKNESS_M (0.1 m) thick, stroked centred on the polygon
 * edge, so every "flush" coordinate is the INNER FACE: edge ± 0.05 m.
 */
import { describe, expect, it } from 'vitest';
import {
  AXIS_ALIGN_TOL_M,
  WALL_HALF_M,
  WALL_SNAP_GAP_M,
  WALL_THICKNESS_M,
  autoOrientDeg,
  collectWallCandidates,
  findFreeSlotAlongWall,
  freeWallObstacleRects,
  insideInnerFaces,
  isCardinalRotation,
  nearestEdge,
  resolveWallAwarePlacement,
} from '../wallAwarePlacement';
import type { FreeWallLike, WallAwareResult } from '../wallAwarePlacement';
import { rectsOverlap, isRectInsidePolygon } from '../../lib/geometry';
import type { PlacedRect, Polygon } from '../../lib/geometry';

const ROOM: Polygon = [
  { x: 0, y: 0 },
  { x: 5, y: 0 },
  { x: 5, y: 4 },
  { x: 0, y: 4 },
];

// 2 × 1 m item (e.g. a treadmill footprint), length along X at rotation 0.
const FP = { lengthM: 2, widthM: 1 };

// 4 × 3 m room at the origin + a 0.6 × 0.4 m item — the 2026-08-29 spec numbers.
const ROOM4x3: Polygon = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 3 },
  { x: 0, y: 3 },
];
const SMALL = { lengthM: 0.6, widthM: 0.4 };

/** Free-standing wall splitting the 4 × 3 room down x = 2. */
const DIVIDER: FreeWallLike = { a: { x: 2, y: 0 }, b: { x: 2, y: 3 }, thicknessM: 0.1 };

describe('constants', () => {
  it('walls are 0.1 m thick and the inner face is half that inside the edge', () => {
    expect(WALL_THICKNESS_M).toBe(0.1);
    expect(WALL_HALF_M).toBeCloseTo(0.05);
    expect(AXIS_ALIGN_TOL_M).toBe(1e-4);
  });
});

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

  it('treats an edge off-axis by less than 1e-4 as axis-aligned (4 dp vertex rounding)', () => {
    const nearlyStraight: Polygon = [
      { x: 0, y: 0 },
      { x: 4, y: 0.00001 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    expect(nearestEdge(nearlyStraight, { x: 2, y: 0.3 })!.alignment).toBe('horizontal');
    // The pre-2026-08-29 tolerance read the same edge as slanted.
    expect(nearestEdge(nearlyStraight, { x: 2, y: 0.3 }, 1e-9)!.alignment).toBe('slanted');
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

describe('collectWallCandidates', () => {
  it('lists polygon edges first (polygon order) then free walls', () => {
    const cs = collectWallCandidates({
      polygon: ROOM4x3,
      centre: { x: 2.35, y: 1.5 },
      freeWalls: [DIVIDER],
    });
    expect(cs.map((c) => `${c.source}:${c.index}`)).toEqual([
      'polygon:0',
      'polygon:1',
      'polygon:2',
      'polygon:3',
      'free:0',
    ]);
    expect(cs[0].insetM).toBeCloseTo(WALL_HALF_M);
  });

  it('gives a free wall the normal pointing toward the query point (two-sided)', () => {
    const east = collectWallCandidates({
      polygon: [],
      centre: { x: 2.35, y: 1.5 },
      freeWalls: [DIVIDER],
    })[0];
    expect(east.inwardNormal.x).toBeCloseTo(1);
    expect(east.distance).toBeCloseTo(0.35);
    expect(east.insetM).toBeCloseTo(0.05);
    const west = collectWallCandidates({
      polygon: [],
      centre: { x: 1.65, y: 1.5 },
      freeWalls: [DIVIDER],
    })[0];
    expect(west.inwardNormal.x).toBeCloseTo(-1);
  });

  it('uses the free wall thickness for its inset, defaulting to the world constant', () => {
    const thick = collectWallCandidates({
      polygon: [],
      centre: { x: 2.5, y: 1.5 },
      freeWalls: [{ a: { x: 2, y: 0 }, b: { x: 2, y: 3 }, thicknessM: 0.3 }],
    })[0];
    expect(thick.insetM).toBeCloseTo(0.15);
    const bare = collectWallCandidates({
      polygon: [],
      centre: { x: 2.5, y: 1.5 },
      freeWalls: [{ a: { x: 2, y: 0 }, b: { x: 2, y: 3 } }],
    })[0];
    expect(bare.insetM).toBeCloseTo(WALL_HALF_M);
  });
});

describe('resolveWallAwarePlacement (5 × 4 room, 2 × 1 item)', () => {
  it('drops mid-room at rotation 0, grid-snapped', () => {
    const r = resolveWallAwarePlacement({
      centreXm: 2.6,
      centreYm: 2.1,
      fp: FP,
      polygon: ROOM,
      snapStep: 0.5,
    });
    expect(r.wallSnapped).toBe(false);
    expect(r.snappedEdges).toBe(0);
    expect(r.cornerSnapped).toBe(false);
    expect(r.primaryAxis).toBeNull();
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
    expect(r.snappedEdges).toBe(1);
    expect(r.primaryAxis).toBe('x');
    expect(r.rotationDeg).toBe(0);
    // Inner face of the y=0 wall (2026-08-29): edge + WALL_HALF_M, not the edge.
    expect(r.y).toBeCloseTo(0.05);
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
    expect(r.primaryAxis).toBe('y');
    expect(r.rotationDeg).toBe(90);
    // At 90° footprint is 1 wide × 2 tall → flush to the inner face: x = 5 − 0.05 − 1 = 3.95.
    expect(r.x).toBeCloseTo(3.95);
    expect(r.y).toBeCloseTo(1.0);
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
    // Inner face of the y=4 wall: 4 − 0.05 − 1 (footprint depth) = 2.95.
    expect(r.y).toBeCloseTo(2.95);
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
    // Inner face of the x=0 wall: 0 + WALL_HALF_M.
    expect(r.x).toBeCloseTo(0.05);
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
    expect(r.y).toBeCloseTo(0.05); // inner face, not the edge
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

  it('wallInsetM: 0 restores edge-flush (legacy) coordinates', () => {
    const r = resolveWallAwarePlacement({
      centreXm: 2.5,
      centreYm: 0.6,
      fp: FP,
      polygon: ROOM,
      snapStep: 0.5,
      wallInsetM: 0,
    });
    expect(r.y).toBeCloseTo(0);
  });
});

describe('resolveWallAwarePlacement (4 × 3 room, 0.6 × 0.4 item — 2026-08-29 spec)', () => {
  const drop = (
    centreXm: number,
    centreYm: number,
    extra: Partial<Parameters<typeof resolveWallAwarePlacement>[0]> = {},
  ): WallAwareResult =>
    resolveWallAwarePlacement({
      centreXm,
      centreYm,
      fp: SMALL,
      polygon: ROOM4x3,
      snapStep: 0.5,
      ...extra,
    });

  it('top wall drop lands on the inner face y = 0.05', () => {
    const r = drop(2.0, 0.25);
    expect(r.wallSnapped).toBe(true);
    expect(r.rotationDeg).toBe(0);
    expect(r.y).toBeCloseTo(0.05, 9);
    expect(r.x).toBeCloseTo(1.5);
    expect(r.primaryAxis).toBe('x');
    expect(r.cornerSnapped).toBe(false);
  });

  it('left wall drop lands on x = 0.05 with rotation 270', () => {
    const r = drop(0.25, 1.5);
    expect(r.wallSnapped).toBe(true);
    expect(r.rotationDeg).toBe(270);
    expect(r.x).toBeCloseTo(0.05, 9);
    expect(r.y).toBeCloseTo(1.0);
    expect(r.primaryAxis).toBe('y');
  });

  it('corner drop near (0.3, 0.25) touches BOTH faces: x = 0.05 and y = 0.05', () => {
    const r = drop(0.3, 0.25);
    expect(r.cornerSnapped).toBe(true);
    expect(r.snappedEdges).toBe(2);
    expect(r.wallSnapped).toBe(true);
    expect(r.rotationDeg).toBe(0); // top wall is primary (smaller back gap)
    expect(r.x).toBeCloseTo(0.05, 9);
    expect(r.y).toBeCloseTo(0.05, 9);
  });

  it('corner drop in the bottom-right lands against both inner faces', () => {
    const r = drop(3.7, 2.75);
    expect(r.cornerSnapped).toBe(true);
    // Bottom wall is primary (gap 0.05 vs 0.1) → rotation 180, 0.6 wide × 0.4 deep.
    expect(r.rotationDeg).toBe(180);
    expect(r.x + 0.6).toBeCloseTo(3.95, 9);
    expect(r.y + 0.4).toBeCloseTo(2.95, 9);
  });

  it('dropped 0.1 m from the right end of the top wall never overshoots the room: x + w <= 4 − 0.05', () => {
    const r = drop(3.9, 0.25);
    expect(r.wallSnapped).toBe(true);
    const w = r.rotationDeg % 180 === 0 ? 0.6 : 0.4;
    expect(r.x + w).toBeLessThanOrEqual(4 - WALL_HALF_M + 1e-9);
    expect(r.y).toBeCloseTo(0.05, 9);
  });

  it('clamps the along-wall grid snap inside the span (no corner within reach)', () => {
    // 1.0 m item, centre x 3.04: far edge is 0.46 m from the right wall so no
    // corner snap, yet a 1 m grid rounds x to 3.0 → would end at 4.0. Clamp → 2.95.
    const fp = { lengthM: 1.0, widthM: 0.4 };
    const clamped = resolveWallAwarePlacement({
      centreXm: 3.04,
      centreYm: 0.25,
      fp,
      polygon: ROOM4x3,
      snapStep: 1,
    });
    expect(clamped.cornerSnapped).toBe(false);
    expect(clamped.snappedEdges).toBe(1);
    expect(clamped.x).toBeCloseTo(2.95, 9);
    expect(clamped.y).toBeCloseTo(0.05, 9);
    const unclamped = resolveWallAwarePlacement({
      centreXm: 3.04,
      centreYm: 0.25,
      fp,
      polygon: ROOM4x3,
      snapStep: 1,
      clampAlongWall: false,
    });
    expect(unclamped.x).toBeCloseTo(3.0, 9);
  });

  it('centres an object longer than the primary wall span on that span', () => {
    // 1 m free-wall stub; 2 m item. Grid would give x = 1.25; centring gives 1.0.
    const stub: FreeWallLike = { a: { x: 1.5, y: 1.5 }, b: { x: 2.5, y: 1.5 }, thicknessM: 0.1 };
    const r = resolveWallAwarePlacement({
      centreXm: 2.2,
      centreYm: 1.8,
      fp: { lengthM: 2, widthM: 0.4 },
      polygon: ROOM4x3,
      snapStep: 0.25,
      freeWalls: [stub],
    });
    expect(r.wallSnapped).toBe(true);
    expect(r.rotationDeg).toBe(0); // centre is below the stub → back to its south face
    expect(r.y).toBeCloseTo(1.55, 9);
    expect(r.x).toBeCloseTo(1.0, 9);
  });

  it('a rotated (90) item dragged mid-room keeps 90 when userRotationDeg is null', () => {
    const r = drop(2.0, 1.5, { userRotationDeg: null, currentRotationDeg: 90 });
    expect(r.wallSnapped).toBe(false);
    expect(r.rotationDeg).toBe(90);
    // 0.4 wide × 0.6 tall at 90° → top-left (1.8, 1.2) → (2.0, 1.0)
    expect(r.x).toBeCloseTo(2.0);
    expect(r.y).toBeCloseTo(1.0);
  });

  it('a new mid-room drop (no current rotation) faces the viewer at 0', () => {
    expect(drop(2.0, 1.5).rotationDeg).toBe(0);
    expect(drop(2.0, 1.5, { userRotationDeg: null }).rotationDeg).toBe(0);
  });

  it('userRotationDeg beats currentRotationDeg mid-room', () => {
    expect(drop(2.0, 1.5, { userRotationDeg: 180, currentRotationDeg: 90 }).rotationDeg).toBe(180);
  });

  it('asserts the 0.45 m threshold on both sides', () => {
    // backGap = centreY − depth/2 = centreY − 0.2
    const inside = drop(2.0, 0.65); // gap 0.45 → snaps
    expect(inside.wallSnapped).toBe(true);
    expect(inside.y).toBeCloseTo(0.05, 9);
    const outside = drop(2.0, 0.651); // gap 0.451 → free-standing
    expect(outside.wallSnapped).toBe(false);
    expect(outside.y).toBeCloseTo(0.5);
  });

  it('flushes to a free wall: centre (2.35, 1.5) → x = 2.05, rotation 270 (back to its east face)', () => {
    const r = drop(2.35, 1.5, { freeWalls: [DIVIDER] });
    expect(r.wallSnapped).toBe(true);
    expect(r.rotationDeg).toBe(270);
    expect(r.x).toBeCloseTo(2.05, 9);
    expect(r.y).toBeCloseTo(1.0);
    expect(r.primaryAxis).toBe('y');
  });

  it('flushes to the other side of the same free wall with the mirrored rotation', () => {
    const r = drop(1.65, 1.5, { freeWalls: [DIVIDER] });
    expect(r.wallSnapped).toBe(true);
    expect(r.rotationDeg).toBe(90);
    // West face at x = 1.95; item is 0.4 wide at 90° → x = 1.55.
    expect(r.x).toBeCloseTo(1.55, 9);
  });

  it('a free wall + a room wall make a corner', () => {
    const r = drop(2.3, 0.25, { freeWalls: [DIVIDER] });
    expect(r.cornerSnapped).toBe(true);
    expect(r.y).toBeCloseTo(0.05, 9); // top wall primary
    expect(r.x).toBeCloseTo(2.05, 9); // divider's east face
  });

  it('a slanted free wall never snaps', () => {
    const slanted: FreeWallLike = { a: { x: 1, y: 1 }, b: { x: 3, y: 2 } };
    const r = drop(2.0, 1.9, { freeWalls: [slanted] });
    expect(r.wallSnapped).toBe(false);
    expect(r.rotationDeg).toBe(0);
  });

  it('snaps to an edge that is off-axis by less than 1e-4', () => {
    const nearlyStraight: Polygon = [
      { x: 0, y: 0 },
      { x: 4, y: 0.00001 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    const r = resolveWallAwarePlacement({
      centreXm: 2.0,
      centreYm: 0.25,
      fp: SMALL,
      polygon: nearlyStraight,
      snapStep: 0.5,
    });
    expect(r.wallSnapped).toBe(true);
    expect(r.y).toBeCloseTo(0.05, 3);
  });

  it('works with no polygon at all (outdoor / unbounded) using free walls only', () => {
    const r = resolveWallAwarePlacement({
      centreXm: 2.35,
      centreYm: 1.5,
      fp: SMALL,
      polygon: [],
      snapStep: 0.5,
      freeWalls: [DIVIDER],
    });
    expect(r.wallSnapped).toBe(true);
    expect(r.x).toBeCloseTo(2.05, 9);
    const free = resolveWallAwarePlacement({
      centreXm: 2.35,
      centreYm: 1.5,
      fp: SMALL,
      polygon: [],
      snapStep: 0.5,
    });
    expect(free.wallSnapped).toBe(false);
  });
});

describe('findFreeSlotAlongWall', () => {
  const fitsIn = (polygon: Polygon, others: PlacedRect[]) => (rect: PlacedRect) =>
    isRectInsidePolygon(rect, polygon) && !others.some((o) => rectsOverlap(rect, o));

  it('slides past a blocking item along the top wall and keeps y flush', () => {
    const resolved = resolveWallAwarePlacement({
      centreXm: 2.0,
      centreYm: 0.25,
      fp: SMALL,
      polygon: ROOM4x3,
      snapStep: 0.5,
    });
    expect(resolved.x).toBeCloseTo(1.5);
    const blocker: PlacedRect = { x: 1.5, y: 0.05, w: 0.6, h: 0.4 };
    const slot = findFreeSlotAlongWall({
      resolved,
      w: 0.6,
      h: 0.4,
      step: 0.5,
      fits: fitsIn(ROOM4x3, [blocker]),
    });
    expect(slot).not.toBeNull();
    // 1.5 blocked, 2.0 and 1.0 overlap the blocker, 2.5 is the nearest free slot.
    expect(slot!.x).toBeCloseTo(2.5);
    expect(slot!.y).toBeCloseTo(0.05, 9);
  });

  it('slides along a vertical wall (primaryAxis y) keeping x flush', () => {
    const resolved = resolveWallAwarePlacement({
      centreXm: 0.25,
      centreYm: 1.5,
      fp: SMALL,
      polygon: ROOM4x3,
      snapStep: 0.5,
    });
    const blocker: PlacedRect = { x: 0.05, y: 1.0, w: 0.4, h: 0.6 };
    const slot = findFreeSlotAlongWall({
      resolved,
      w: 0.4,
      h: 0.6,
      step: 0.5,
      fits: fitsIn(ROOM4x3, [blocker]),
    });
    expect(slot).not.toBeNull();
    expect(slot!.x).toBeCloseTo(0.05, 9);
    expect(slot!.y).not.toBeCloseTo(1.0);
    expect(rectsOverlap({ x: slot!.x, y: slot!.y, w: 0.4, h: 0.6 }, blocker)).toBe(false);
  });

  it('returns the resolved position itself when it already fits', () => {
    const resolved = resolveWallAwarePlacement({
      centreXm: 2.0,
      centreYm: 0.25,
      fp: SMALL,
      polygon: ROOM4x3,
      snapStep: 0.5,
    });
    const slot = findFreeSlotAlongWall({
      resolved,
      w: 0.6,
      h: 0.4,
      step: 0.5,
      fits: fitsIn(ROOM4x3, []),
    });
    expect(slot).toEqual({ x: resolved.x, y: resolved.y });
  });

  it('returns null when free-standing, when nothing fits within maxSlideM, or for a bad step', () => {
    const free = resolveWallAwarePlacement({
      centreXm: 2.0,
      centreYm: 1.5,
      fp: SMALL,
      polygon: ROOM4x3,
      snapStep: 0.5,
    });
    expect(
      findFreeSlotAlongWall({ resolved: free, w: 0.6, h: 0.4, step: 0.5, fits: () => true }),
    ).toBeNull();
    const snapped = resolveWallAwarePlacement({
      centreXm: 2.0,
      centreYm: 0.25,
      fp: SMALL,
      polygon: ROOM4x3,
      snapStep: 0.5,
    });
    expect(
      findFreeSlotAlongWall({ resolved: snapped, w: 0.6, h: 0.4, step: 0.5, fits: () => false }),
    ).toBeNull();
    expect(
      findFreeSlotAlongWall({ resolved: snapped, w: 0.6, h: 0.4, step: 0, fits: () => true }),
    ).toBeNull();
    // Only the far end is free but it is beyond a 1 m slide.
    const farOnly = (rect: PlacedRect) => rect.x >= 3.3;
    expect(
      findFreeSlotAlongWall({
        resolved: snapped,
        w: 0.6,
        h: 0.4,
        step: 0.5,
        maxSlideM: 1,
        fits: farOnly,
      }),
    ).toBeNull();
    expect(
      findFreeSlotAlongWall({ resolved: snapped, w: 0.6, h: 0.4, step: 0.5, fits: farOnly })!.x,
    ).toBeCloseTo(3.5);
  });
});

describe('freeWallObstacleRects', () => {
  it('turns a vertical wall into its 0.1 m band: { x: 1.95, y: 0, w: 0.1, h: 3 }', () => {
    const [rect] = freeWallObstacleRects([DIVIDER]);
    expect(rect.x).toBeCloseTo(1.95, 9);
    expect(rect.y).toBeCloseTo(0, 9);
    expect(rect.w).toBeCloseTo(0.1, 9);
    expect(rect.h).toBeCloseTo(3, 9);
    expect(rect.instanceId).toBe('wall:0');
  });

  it('turns a horizontal wall into its band regardless of point order', () => {
    const [rect] = freeWallObstacleRects([{ a: { x: 3, y: 1 }, b: { x: 1, y: 1 }, thicknessM: 0.2 }]);
    expect(rect).toMatchObject({ x: 1, w: 2, h: 0.2, instanceId: 'wall:0' });
    expect(rect.y).toBeCloseTo(0.9, 9);
  });

  it('uses the default thickness when a wall has none, and keeps original indices', () => {
    const rects = freeWallObstacleRects([
      { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } }, // degenerate: skipped, never an obstacle
      { a: { x: 1, y: 1 }, b: { x: 1, y: 2 } },
    ]);
    expect(rects).toHaveLength(1);
    expect(rects[0].instanceId).toBe('wall:1');
    expect(rects[0].w).toBeCloseTo(WALL_THICKNESS_M, 9);
    const custom = freeWallObstacleRects([{ a: { x: 1, y: 1 }, b: { x: 1, y: 2 } }], 0.3);
    expect(custom[0].w).toBeCloseTo(0.3, 9);
  });

  it('uses the grown bounding box for a slanted wall', () => {
    const [rect] = freeWallObstacleRects([{ a: { x: 1, y: 1 }, b: { x: 3, y: 2 }, thicknessM: 0.1 }]);
    expect(rect.x).toBeCloseTo(0.95, 9);
    expect(rect.y).toBeCloseTo(0.95, 9);
    expect(rect.w).toBeCloseTo(2.1, 9);
    expect(rect.h).toBeCloseTo(1.1, 9);
  });

  it('is a real obstacle for the collision helpers', () => {
    const [band] = freeWallObstacleRects([DIVIDER]);
    // An item straddling x = 2 collides; one flush on the east face does not.
    expect(rectsOverlap({ x: 1.8, y: 1, w: 0.6, h: 0.4 }, band)).toBe(true);
    expect(rectsOverlap({ x: 2.05, y: 1, w: 0.6, h: 0.4 }, band)).toBe(false);
  });
});

/**
 * Vic 2026-08-29: "The snap on feature of the objects doesn't align
 * horizontally flush to the wall, only vertical and therefore you can't
 * align an object in the corner." Root cause (verified by real drags): the
 * engage test measured the gap with the object's depth AFTER auto-orient
 * (its short side) while the user drags it at its CURRENT facing. These
 * pin the fix: engage on the current extent, corners keep the facing,
 * free-standing drops never sit in the wall band.
 */
describe('engage on the object as dragged (2026-08-29 corner fix)', () => {
  // 2.05 × 0.95 treadmill — the K1 NordicTrack footprint.
  const TREADMILL = { lengthM: 2.05, widthM: 0.95 };

  it('a landscape item pushed against the LEFT wall engages and flushes to x = 0.05', () => {
    // Current rotation 0: long side along X. Left edge touching the wall
    // line → centre x = 1.025. Old backGap = 1.025 − 0.475 = 0.55 > 0.45.
    const r = resolveWallAwarePlacement({
      centreXm: 1.025,
      centreYm: 2,
      fp: TREADMILL,
      polygon: ROOM,
      snapStep: 0.5,
      currentRotationDeg: 0,
    });
    expect(r.wallSnapped).toBe(true);
    expect(r.primaryAxis).toBe('y');
    expect(r.x).toBeCloseTo(WALL_HALF_M, 6);
    // Turned to face into the room from the left wall.
    expect(r.rotationDeg === 90 || r.rotationDeg === 270).toBe(true);
  });

  it('… and with its edge 0.2 m off the wall (the gesture Vic makes)', () => {
    const r = resolveWallAwarePlacement({
      centreXm: 0.2 + 1.025,
      centreYm: 2,
      fp: TREADMILL,
      polygon: ROOM,
      snapStep: 0.5,
      currentRotationDeg: 0,
    });
    expect(r.wallSnapped).toBe(true);
    expect(r.x).toBeCloseTo(WALL_HALF_M, 6);
  });

  it('the same push on the RIGHT wall flushes to the far inner face', () => {
    const r = resolveWallAwarePlacement({
      centreXm: 5 - 0.2 - 1.025,
      centreYm: 2,
      fp: TREADMILL,
      polygon: ROOM,
      snapStep: 0.5,
      currentRotationDeg: 0,
    });
    expect(r.wallSnapped).toBe(true);
    const { w } = rotatedFootprintOf(TREADMILL, r.rotationDeg);
    expect(r.x + w).toBeCloseTo(5 - WALL_HALF_M, 6);
  });

  it('a portrait item (rotation 90) pushed against the TOP wall engages too', () => {
    const r = resolveWallAwarePlacement({
      centreXm: 2.5,
      centreYm: 0.2 + 1.025,
      fp: TREADMILL,
      polygon: ROOM,
      snapStep: 0.5,
      currentRotationDeg: 90,
    });
    expect(r.wallSnapped).toBe(true);
    expect(r.y).toBeCloseTo(WALL_HALF_M, 6);
  });

  it('pushing a wall-flush item into the corner keeps its facing (corner never spins it)', () => {
    // Flush on the TOP wall at rotation 0 (2.05 wide), slid into the
    // top-left corner: both walls are within reach. The wall it already
    // faces (top → rotation 0) stays primary; the left wall is secondary.
    const r = resolveWallAwarePlacement({
      centreXm: 0.05 + 1.025 - 0.1,
      centreYm: 0.05 + 0.475,
      fp: TREADMILL,
      polygon: ROOM,
      snapStep: 0.5,
      currentRotationDeg: 0,
    });
    expect(r.cornerSnapped).toBe(true);
    expect(r.rotationDeg).toBe(0);
    expect(r.x).toBeCloseTo(WALL_HALF_M, 6);
    expect(r.y).toBeCloseTo(WALL_HALF_M, 6);
  });

  it('a free-standing drop is clamped inside the inner faces, never in the wall band', () => {
    // Mid-room in y, but the grid would put x at 0 (5 cm into the wall)
    // for a drop whose gap is beyond the engage distance? Use a SMALL item
    // 1 m from the wall: free-standing, and the grid says x = 0.3 → fine.
    // Then a drop whose grid position overruns the far wall.
    const r = resolveWallAwarePlacement({
      centreXm: 5 - 0.6 - 0.3, // grid → x = 3.5, x + 2.05 = 5.55 > 4.95
      centreYm: 2,
      fp: TREADMILL,
      polygon: ROOM,
      snapStep: 0.5,
      currentRotationDeg: 0,
      userRotationDeg: 0, // Shift held: no auto-orient, may stay free-standing
    });
    expect(r.x + 2.05).toBeLessThanOrEqual(5 - WALL_HALF_M + 1e-6);
    expect(r.x).toBeGreaterThanOrEqual(WALL_HALF_M - 1e-6);
  });

  it('insideInnerFaces: edge-touching is NOT inside (5 cm wall band)', () => {
    expect(insideInnerFaces({ x: 0, y: 1, w: 1, h: 1 }, ROOM)).toBe(false);
    expect(insideInnerFaces({ x: 0.05, y: 1, w: 1, h: 1 }, ROOM)).toBe(true);
    expect(insideInnerFaces({ x: 3.95, y: 1, w: 1, h: 1 }, ROOM)).toBe(true);
    expect(insideInnerFaces({ x: 3.96, y: 1, w: 1, h: 1 }, ROOM)).toBe(false);
    expect(insideInnerFaces({ x: -5, y: -5, w: 1, h: 1 }, [])).toBe(true);
  });

  it('an edge exactly 1e-4 off-axis is still axis-aligned', () => {
    const edgeCase: Polygon = [
      { x: 0, y: 0 },
      { x: 5, y: 0.0001 },
      { x: 5, y: 4 },
      { x: 0, y: 4 },
    ];
    expect(nearestEdge(edgeCase, { x: 2.5, y: 0.3 })!.alignment).toBe('horizontal');
  });
});

function rotatedFootprintOf(fp: { lengthM: number; widthM: number }, deg: number) {
  const r = ((deg % 360) + 360) % 360;
  return r === 90 || r === 270 ? { w: fp.widthM, h: fp.lengthM } : { w: fp.lengthM, h: fp.widthM };
}
