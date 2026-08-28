import { describe, it, expect } from 'vitest';
import {
  zoneForMaterial,
  tileAt,
  tileRect,
  tilesCoveringPolygon,
  tilesInDragRect,
  dragRectTileCount,
  tileIntersectsPolygon,
  tileFullyInsidePolygon,
  runsToSet,
  setToRuns,
  countTiles,
  pruneZone,
  floorTileOrder,
  type FloorZone,
} from '../floorTiles';
import type { Polygon } from '../../lib/geometry';

/** 5 x 4 m room at the origin — the repo's own two-room fixture, room 1. */
const ROOM: Polygon = [
  { x: 0, y: 0 },
  { x: 5, y: 0 },
  { x: 5, y: 4 },
  { x: 0, y: 4 },
];

/** Gym interlock: 0.92 x 0.92 m, so it does NOT divide 5 x 4 evenly. */
const gymZone = (): FloorZone => zoneForMaterial('gym-interlock', 0.92, 0.92, ROOM);
/** A 1 m tile, which does divide evenly. */
const oneMetreZone = (): FloorZone => zoneForMaterial('outdoor-1m', 1, 1, ROOM);

describe('lattice', () => {
  it('anchors to the room bbox corner, not world zero', () => {
    const offset: Polygon = [
      { x: 3.13, y: 2.07 },
      { x: 8.13, y: 2.07 },
      { x: 8.13, y: 6.07 },
      { x: 3.13, y: 6.07 },
    ];
    const z = zoneForMaterial('m', 0.92, 0.92, offset);
    expect(z.originM).toEqual({ x: 3.13, y: 2.07 });
    // The first tile starts exactly at the room's corner, so a room drawn at
    // an arbitrary snapped coordinate does not begin with a ragged part tile.
    expect(tileAt(z, { x: 3.13, y: 2.07 })).toEqual({ row: 0, col: 0 });
  });

  it('maps world points to tile indices', () => {
    const z = oneMetreZone();
    expect(tileAt(z, { x: 0.5, y: 0.5 })).toEqual({ row: 0, col: 0 });
    expect(tileAt(z, { x: 2.5, y: 1.5 })).toEqual({ row: 1, col: 2 });
    expect(tileRect(z, 1, 2)).toEqual({ x: 2, y: 1, w: 1, h: 1 });
  });
});

describe('coverage rule — intersection, not centre-inside', () => {
  it('covers the WHOLE room even when tiles do not divide evenly', () => {
    // THE commercial assertion. 5 x 4 m at 0.92 m needs ceil(5/0.92) = 6
    // columns and ceil(4/0.92) = 5 rows = 30 tiles. A centre-inside rule
    // yields 5 x 4 = 20 and leaves a bare margin against two walls, which
    // would quote the customer 10 tiles short of a floor that fits.
    const z = gymZone();
    const tiles = tilesCoveringPolygon(z, ROOM);
    expect(tiles).toHaveLength(30);

    const cols = new Set(tiles.map((t) => t.col));
    const rows = new Set(tiles.map((t) => t.row));
    expect(cols.size).toBe(6);
    expect(rows.size).toBe(5);
  });

  it('a boundary tile counts as covered', () => {
    const z = gymZone();
    // Column 5 spans x 4.60–5.52, mostly OUTSIDE the 5 m wall. Its centre is
    // at 5.06, outside the room — a centre test drops it.
    const rect = tileRect(z, 0, 5);
    expect(rect.x).toBeCloseTo(4.6, 6);
    expect(tileIntersectsPolygon(rect, ROOM)).toBe(true);
    expect(tileFullyInsidePolygon(rect, ROOM)).toBe(false);
  });

  it('a tile fully outside is not covered', () => {
    const z = gymZone();
    expect(tileIntersectsPolygon(tileRect(z, 0, 20), ROOM)).toBe(false);
  });

  it('divides exactly when the tile fits the room', () => {
    const z = oneMetreZone();
    expect(tilesCoveringPolygon(z, ROOM)).toHaveLength(20);
    // ...and every one of them is a whole tile, so there is nothing to cut.
    const order = floorTileOrder({ ...z, runs: setToRuns(new Set(tilesCoveringPolygon(z, ROOM).map((t) => `${t.row},${t.col}`))) }, ROOM);
    expect(order.wholeTiles).toBe(20);
    expect(order.cutTiles).toBe(0);
    expect(order.unitsToOrder).toBe(20);
  });
});

describe('drag rectangle', () => {
  it('covers the same tiles dragged in any direction', () => {
    const z = oneMetreZone();
    const a = { x: 0.5, y: 0.5 };
    const b = { x: 2.5, y: 2.5 };
    const forward = tilesInDragRect(z, a, b, ROOM);
    const backward = tilesInDragRect(z, b, a, ROOM);
    expect(forward).toHaveLength(9);
    expect(new Set(backward.map((t) => `${t.row},${t.col}`))).toEqual(
      new Set(forward.map((t) => `${t.row},${t.col}`)),
    );
  });

  it('is clipped to the room', () => {
    const z = oneMetreZone();
    // Drag well past the far wall; only tiles touching the room survive.
    const tiles = tilesInDragRect(z, { x: 0.5, y: 0.5 }, { x: 20, y: 20 }, ROOM);
    expect(tiles.length).toBe(20);
  });

  it('counts a pending drag in O(1) without building the list', () => {
    const z = oneMetreZone();
    // 21 x 21 indices — the guard that stops a runaway drag being attempted.
    expect(dragRectTileCount(z, { x: 0.5, y: 0.5 }, { x: 20.5, y: 20.5 })).toBe(441);
  });
});

describe('run-length codec', () => {
  it('round-trips a set of tiles', () => {
    const set = new Set(['0,0', '0,1', '0,2', '0,5', '1,3']);
    const runs = setToRuns(set);
    expect(runsToSet(runs)).toEqual(set);
  });

  it('compresses contiguous columns into one run', () => {
    const set = new Set(['0,0', '0,1', '0,2', '0,3']);
    // one triple: [row, start, length]
    expect(setToRuns(set)).toEqual([0, 0, 4]);
  });

  it('splits a row on a gap', () => {
    expect(setToRuns(new Set(['0,0', '0,1', '0,4']))).toEqual([0, 0, 2, 0, 4, 1]);
  });

  it('counts tiles straight from the runs', () => {
    expect(countTiles([0, 0, 4, 1, 2, 3])).toBe(7);
  });

  it('is compact for a full room', () => {
    const z = oneMetreZone();
    const runs = setToRuns(new Set(tilesCoveringPolygon(z, ROOM).map((t) => `${t.row},${t.col}`)));
    // 20 tiles in 4 rows = 4 runs = 12 numbers, not 20 objects.
    expect(runs).toHaveLength(12);
    expect(countTiles(runs)).toBe(20);
  });
});

describe('pruneZone', () => {
  it('drops tiles left outside after the room is reshaped', () => {
    const z = oneMetreZone();
    const full: FloorZone = {
      ...z,
      runs: setToRuns(new Set(tilesCoveringPolygon(z, ROOM).map((t) => `${t.row},${t.col}`))),
    };
    expect(countTiles(full.runs)).toBe(20);

    // Shrink the room to 3 x 4.
    const smaller: Polygon = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 4 },
      { x: 0, y: 4 },
    ];
    const pruned = pruneZone(full, smaller);
    expect(countTiles(pruned.runs)).toBe(12);
    // Without pruning those 8 tiles persist invisibly and are still priced.
  });

  it('is idempotent', () => {
    const z = oneMetreZone();
    const full: FloorZone = {
      ...z,
      runs: setToRuns(new Set(tilesCoveringPolygon(z, ROOM).map((t) => `${t.row},${t.col}`))),
    };
    const once = pruneZone(full, ROOM);
    expect(pruneZone(once, ROOM).runs).toEqual(once.runs);
  });
});

describe('floorTileOrder — what the customer is billed', () => {
  it('separates whole tiles from cut tiles and adds an allowance on the cuts only', () => {
    const z = gymZone();
    const covered = tilesCoveringPolygon(z, ROOM);
    const zone: FloorZone = {
      ...z,
      runs: setToRuns(new Set(covered.map((t) => `${t.row},${t.col}`))),
    };
    const order = floorTileOrder(zone, ROOM);

    // 6 x 5 lattice over a 5 x 4 room: the last column and last row are cut.
    expect(order.wholeTiles + order.cutTiles).toBe(30);
    expect(order.cutTiles).toBeGreaterThan(0);
    // Allowance is on the cut tiles, NOT on the whole floor.
    expect(order.unitsToOrder).toBe(
      order.wholeTiles + order.cutTiles + Math.ceil(order.cutTiles * 0.1),
    );
    // And it never under-orders what the room physically needs.
    expect(order.unitsToOrder).toBeGreaterThanOrEqual(30);
  });

  it('adds no allowance when nothing is cut', () => {
    const z = oneMetreZone();
    const zone: FloorZone = {
      ...z,
      runs: setToRuns(new Set(tilesCoveringPolygon(z, ROOM).map((t) => `${t.row},${t.col}`))),
    };
    const order = floorTileOrder(zone, ROOM);
    expect(order.cutTiles).toBe(0);
    expect(order.unitsToOrder).toBe(order.wholeTiles);
  });

  it('reports covered area as context, never as the price basis', () => {
    const z = oneMetreZone();
    const zone: FloorZone = {
      ...z,
      runs: setToRuns(new Set(tilesCoveringPolygon(z, ROOM).map((t) => `${t.row},${t.col}`))),
    };
    // 20 whole 1 m tiles over a 20 m2 room.
    expect(floorTileOrder(zone, ROOM).coveredM2).toBeCloseTo(20, 2);
  });
});
