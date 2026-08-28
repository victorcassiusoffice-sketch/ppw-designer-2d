/**
 * Surface slots + wall-mounted items (2026-08-24) — unit suite.
 * Room: 5 × 4 m rectangle, origin top-left, y down (screen space).
 */
import { describe, expect, it } from 'vitest';
import {
  SURFACE_SUB_GRID_M,
  WALL_ITEM_RANGE_M,
  findSurfaceUnder,
  placementKind,
  resolveSurfaceItemPlacement,
  resolveWallItemPlacement,
} from '../attachmentPlacement';
import type { Polygon } from '../../lib/geometry';

const ROOM: Polygon = [
  { x: 0, y: 0 },
  { x: 5, y: 0 },
  { x: 5, y: 4 },
  { x: 0, y: 4 },
];

// Floating shelf: 0.8 × 0.2 m.
const SHELF = { lengthM: 0.8, widthM: 0.2 };
// Console table footprint at rotation 0: 1.2 × 0.4 m.
const TABLE = { instanceId: 'table-1', x: 1.0, y: 2.0, w: 1.2, h: 0.4 };
// Diffuser: 0.15 × 0.15 m.
const DIFFUSER = { lengthM: 0.15, widthM: 0.15 };

describe('placementKind', () => {
  it('defaults to floor', () => {
    expect(placementKind(undefined)).toBe('floor');
    expect(placementKind({})).toBe('floor');
    expect(placementKind({ placement: 'wall' })).toBe('wall');
    expect(placementKind({ placement: 'surface' })).toBe('surface');
  });
});

describe('resolveWallItemPlacement', () => {
  it('snaps flush to the top wall, facing into the room', () => {
    const r = resolveWallItemPlacement({
      centreXm: 2.5,
      centreYm: 0.8,
      fp: SHELF,
      polygon: ROOM,
      snapStep: 0.5,
    });
    expect(r.ok).toBe(true);
    expect(r.rotationDeg).toBe(0);
    expect(r.y).toBeCloseTo(0);
    expect(r.x).toBeCloseTo(2.0); // grid-snapped along the wall
  });

  it('snaps to the right wall rotated 90 with the footprint swapped', () => {
    const r = resolveWallItemPlacement({
      centreXm: 4.4,
      centreYm: 2.0,
      fp: SHELF,
      polygon: ROOM,
      snapStep: 0.5,
    });
    expect(r.ok).toBe(true);
    expect(r.rotationDeg).toBe(90);
    // At 90° the shelf is 0.2 wide × 0.8 tall → flush: x = 5 − 0.2.
    expect(r.x).toBeCloseTo(4.8);
  });

  it('refuses when no wall is within range', () => {
    const r = resolveWallItemPlacement({
      centreXm: 2.5,
      centreYm: 2.0, // 2 m from every wall > WALL_ITEM_RANGE_M
      fp: SHELF,
      polygon: ROOM,
      snapStep: 0.5,
    });
    expect(WALL_ITEM_RANGE_M).toBeLessThan(2);
    expect(r.ok).toBe(false);
  });

  it('refuses slanted walls', () => {
    const slanted: Polygon = [
      { x: 0, y: 0 },
      { x: 5, y: 1 },
      { x: 5, y: 4 },
      { x: 0, y: 4 },
    ];
    const r = resolveWallItemPlacement({
      centreXm: 2.0,
      centreYm: 0.7,
      fp: SHELF,
      polygon: slanted,
      snapStep: 0.5,
    });
    expect(r.ok).toBe(false);
  });
});

describe('findSurfaceUnder', () => {
  it('finds the surface containing the point', () => {
    expect(findSurfaceUnder({ x: 1.5, y: 2.2 }, [TABLE])?.instanceId).toBe('table-1');
  });
  it('returns null off-surface', () => {
    expect(findSurfaceUnder({ x: 3.0, y: 3.0 }, [TABLE])).toBeNull();
  });
  it('prefers the last (topmost-rendered) surface on overlap', () => {
    const top = { instanceId: 'table-2', x: 1.1, y: 2.1, w: 1.2, h: 0.4 };
    expect(findSurfaceUnder({ x: 1.5, y: 2.2 }, [TABLE, top])?.instanceId).toBe('table-2');
  });
});

describe('resolveSurfaceItemPlacement', () => {
  it('seats the item on the surface sub-grid', () => {
    const r = resolveSurfaceItemPlacement({
      centreXm: 1.53,
      centreYm: 2.18,
      fp: DIFFUSER,
      rotationDeg: 0,
      surface: TABLE,
    });
    expect(r.ok).toBe(true);
    expect(r.parentInstanceId).toBe('table-1');
    // Relative offset is a multiple of the 0.1 m sub-grid.
    const relX = (r.x - TABLE.x) / SURFACE_SUB_GRID_M;
    const relY = (r.y - TABLE.y) / SURFACE_SUB_GRID_M;
    expect(relX).toBeCloseTo(Math.round(relX));
    expect(relY).toBeCloseTo(Math.round(relY));
  });

  it('clamps fully inside the surface at the edges', () => {
    const r = resolveSurfaceItemPlacement({
      centreXm: TABLE.x + TABLE.w + 0.3, // way past the right edge
      centreYm: TABLE.y - 0.2, // above the top edge
      fp: DIFFUSER,
      rotationDeg: 0,
      surface: TABLE,
    });
    expect(r.ok).toBe(true);
    expect(r.x).toBeCloseTo(TABLE.x + TABLE.w - 0.15);
    expect(r.y).toBeCloseTo(TABLE.y);
  });

  it('refuses an item bigger than the surface', () => {
    const r = resolveSurfaceItemPlacement({
      centreXm: 1.5,
      centreYm: 2.2,
      fp: { lengthM: 2.0, widthM: 1.0 },
      rotationDeg: 0,
      surface: TABLE,
    });
    expect(r.ok).toBe(false);
  });
});
