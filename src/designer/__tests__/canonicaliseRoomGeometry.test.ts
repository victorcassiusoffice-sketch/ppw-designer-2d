/**
 * Winding canonicalisation — doors round 2026-08-31, defect 4.
 *
 * `edgeNormal` is a FIXED left normal, so a door's default swing is only
 * "into the room" when the polygon winds CW in y-down screen space. These
 * tests pin the two guarantees the fix stands on:
 *
 *   1. every canonicalised polygon winds CW (positive shoelace area);
 *   2. when canonicalisation reverses a polygon, its openings are remapped
 *      EXACTLY — the world-space gap span AND the world-space door symbol
 *      (hinge / far jamb / leaf end, i.e. the swing side) are identical to
 *      1e-9. A saved plan cannot move its doors.
 */
import { describe, it, expect } from 'vitest';
import { cursorSideOfEdge, pointAlongEdge, roomEdges, type RoomEdge } from '../wallEdges';
import {
  canonicaliseRoomGeometry,
  doorSymbol,
  isClockwisePolygon,
  openingSpan,
  signedPolygonAreaM2,
  type Opening,
} from '../openings';
import type { Polygon, Vertex } from '../../lib/geometry';

/** 5 x 4 m square, canonical CW winding (y-down). */
const CW_SQUARE: Polygon = [
  { x: 0, y: 0 },
  { x: 5, y: 0 },
  { x: 5, y: 4 },
  { x: 0, y: 4 },
];

/** The same square hand-drawn the other way round (CCW). */
const CCW_SQUARE: Polygon = [
  { x: 0, y: 0 },
  { x: 0, y: 4 },
  { x: 5, y: 4 },
  { x: 5, y: 0 },
];

function door(patch: Partial<Opening> = {}): Opening {
  return {
    id: 'o1',
    edgeIndex: 0,
    offsetM: 2.5,
    widthM: 0.8,
    kind: 'door',
    flipFacing: false,
    flipHand: false,
    ...patch,
  };
}

function edgeByIndex(polygon: Polygon, index: number): RoomEdge {
  const e = roomEdges({ id: 'r', polygon }).find((x) => x.index === index);
  if (!e) throw new Error(`no edge ${index}`);
  return e;
}

/** World-space endpoints of an opening's gap, as an unordered pair. */
function worldGap(polygon: Polygon, o: Opening): [Vertex, Vertex] {
  const edge = edgeByIndex(polygon, o.edgeIndex);
  const { t0, t1 } = openingSpan(o);
  const a = pointAlongEdge(edge, t0);
  const b = pointAlongEdge(edge, t1);
  // Order-insensitive: sort by x then y.
  return a.x < b.x || (a.x === b.x && a.y <= b.y) ? [a, b] : [b, a];
}

function expectVertexClose(a: Vertex, b: Vertex) {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
}

describe('signedPolygonAreaM2 / isClockwisePolygon', () => {
  it('CW (y-down) is positive, CCW negative', () => {
    expect(signedPolygonAreaM2(CW_SQUARE)).toBeCloseTo(20, 9);
    expect(signedPolygonAreaM2(CCW_SQUARE)).toBeCloseTo(-20, 9);
    expect(isClockwisePolygon(CW_SQUARE)).toBe(true);
    expect(isClockwisePolygon(CCW_SQUARE)).toBe(false);
  });

  it('degenerate polygons report zero area', () => {
    expect(signedPolygonAreaM2([])).toBe(0);
    expect(signedPolygonAreaM2([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBe(0);
  });
});

describe('canonicaliseRoomGeometry — winding', () => {
  it('canonicalises a CCW square to CW, keeping the first vertex', () => {
    const canon = canonicaliseRoomGeometry(CCW_SQUARE);
    expect(canon.changed).toBe(true);
    expect(isClockwisePolygon(canon.polygon)).toBe(true);
    expect(canon.polygon).toEqual(CW_SQUARE);
  });

  it('returns a CW polygon untouched, by reference', () => {
    const canon = canonicaliseRoomGeometry(CW_SQUARE);
    expect(canon.changed).toBe(false);
    expect(canon.polygon).toBe(CW_SQUARE);
  });

  it('is idempotent', () => {
    const once = canonicaliseRoomGeometry(CCW_SQUARE, [door({ edgeIndex: 3, offsetM: 1.25 })]);
    const twice = canonicaliseRoomGeometry(once.polygon, once.openings);
    expect(twice.changed).toBe(false);
    expect(twice.polygon).toBe(once.polygon);
  });

  it('a door at 25% of the top wall of a CCW room keeps its EXACT world gap', () => {
    // In the CCW square the top wall (y = 0) is edge 3: (5,0) -> (0,0).
    // 25% along = 1.25 m from (5,0).
    const before = door({ edgeIndex: 3, offsetM: 1.25 });
    const gapBefore = worldGap(CCW_SQUARE, before);

    const canon = canonicaliseRoomGeometry(CCW_SQUARE, [before]);
    expect(canon.openings).toHaveLength(1);
    const after = canon.openings[0];

    // Remapped onto the reversed polygon's top wall, measured from (0,0).
    expect(after.edgeIndex).toBe(0);
    expect(after.offsetM).toBeCloseTo(5 - 1.25, 9);
    expect(after.flipFacing).toBe(true);
    expect(after.flipHand).toBe(true);

    const gapAfter = worldGap(canon.polygon, after);
    expectVertexClose(gapAfter[0], gapBefore[0]);
    expectVertexClose(gapAfter[1], gapBefore[1]);
  });

  it('the WORLD-space door symbol (hinge, far jamb, leaf, swing side) is unchanged', () => {
    const before = door({ edgeIndex: 3, offsetM: 1.25, flipHand: true, flipFacing: true });
    const canon = canonicaliseRoomGeometry(CCW_SQUARE, [before]);
    const after = canon.openings[0];

    const sBefore = doorSymbol(edgeByIndex(CCW_SQUARE, before.edgeIndex), before);
    const sAfter = doorSymbol(edgeByIndex(canon.polygon, after.edgeIndex), after);

    expectVertexClose(sAfter.hinge, sBefore.hinge);
    expectVertexClose(sAfter.farJamb, sBefore.farJamb);
    expectVertexClose(sAfter.leafEnd, sBefore.leafEnd);
  });

  it('passes a malformed / out-of-range opening through untouched for pruneOpenings', () => {
    const stale = door({ edgeIndex: 7 });
    const canon = canonicaliseRoomGeometry(CCW_SQUARE, [stale]);
    expect(canon.openings[0]).toEqual(stale);
  });
});

describe('canonicaliseRoomGeometry — duplicate vertices', () => {
  // Duplicate of (5,0) at index 2: old edge 1 is zero-length, old edge 2 is
  // the east wall. Positional edge indexing would shift every later opening
  // one wall around (defect 9's latent trigger).
  const DUP: Polygon = [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 4 },
    { x: 0, y: 4 },
  ];

  it('drops the duplicate and remaps openings past it', () => {
    const eastDoor = door({ edgeIndex: 2, offsetM: 2 });
    const gapBefore = worldGap(DUP, eastDoor);

    const canon = canonicaliseRoomGeometry(DUP, [eastDoor]);
    expect(canon.changed).toBe(true);
    expect(canon.polygon).toEqual(CW_SQUARE);
    expect(canon.openings[0].edgeIndex).toBe(1);
    expect(canon.openings[0].offsetM).toBeCloseTo(2, 9);

    const gapAfter = worldGap(canon.polygon, canon.openings[0]);
    expectVertexClose(gapAfter[0], gapBefore[0]);
    expectVertexClose(gapAfter[1], gapBefore[1]);
  });

  it('a polygon degenerate after dedupe returns no openings', () => {
    const canon = canonicaliseRoomGeometry(
      [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }],
      [door()],
    );
    expect(canon.changed).toBe(true);
    expect(canon.polygon).toHaveLength(2);
    expect(canon.openings).toEqual([]);
  });
});

describe('cursorSideOfEdge', () => {
  // Top wall of the CW square: (0,0) -> (5,0). Its flipFacing:false normal
  // (-dy, dx) = (0, 1) points INTO the room (y-down).
  const top = edgeByIndex(CW_SQUARE, 0);

  it('+1 on the flipFacing:false side, -1 on the other, 0 on the wall line', () => {
    expect(cursorSideOfEdge(top, { x: 2.5, y: 1 })).toBe(1);
    expect(cursorSideOfEdge(top, { x: 2.5, y: -1 })).toBe(-1);
    expect(cursorSideOfEdge(top, { x: 2.5, y: 0 })).toBe(0);
  });
});
