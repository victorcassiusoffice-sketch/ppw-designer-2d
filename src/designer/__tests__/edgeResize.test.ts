import { describe, it, expect } from 'vitest';
import { resizeRoomEdge, MAX_EDGE_M, type ResizeRoom } from '../edgeResize';

/** One 5 x 4 m room at the origin. Edge 0 is the north wall, (0,0)->(5,0). */
const oneRoom = (): ResizeRoom[] => [
  {
    id: 'r1',
    name: 'Room 1',
    polygon: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 0, y: 4 },
    ],
  },
];

/** Two rooms sharing the x = 5 wall exactly. */
const twoAttached = (): ResizeRoom[] => [
  {
    id: 'r1',
    name: 'Room 1',
    polygon: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 0, y: 4 },
    ],
  },
  {
    id: 'r2',
    name: 'Room 2',
    polygon: [
      { x: 5, y: 0 },
      { x: 9, y: 0 },
      { x: 9, y: 4 },
      { x: 5, y: 4 },
    ],
  },
];

describe('resizeRoomEdge', () => {
  it('resizes an edge to exactly the typed length', () => {
    const res = resizeRoomEdge({ rooms: oneRoom(), roomId: 'r1', edgeIndex: 0, newLengthM: 3.47 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const p = res.rooms[0].polygon;
    expect(Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y)).toBeCloseTo(3.47, 6);
    expect(p[1]).toEqual({ x: 3.47, y: 0 });
  });

  it('the anchor chooses which corner moves', () => {
    const res = resizeRoomEdge({
      rooms: oneRoom(), roomId: 'r1', edgeIndex: 0, newLengthM: 3, anchor: 'end',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const p = res.rooms[0].polygon;
    // vertex 1 (5,0) held; vertex 0 moved to (2,0).
    expect(p[1]).toEqual({ x: 5, y: 0 });
    expect(p[0]).toEqual({ x: 2, y: 0 });
  });

  it('moves a SHARED corner in every room that carries it', () => {
    // Shrinking r1's north wall drags the shared (5,0) corner. r2 must follow,
    // or the two rooms stop sharing the wall and silently overlap-or-gap.
    const res = resizeRoomEdge({ rooms: twoAttached(), roomId: 'r1', edgeIndex: 0, newLengthM: 4 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.affectedRoomIds.sort()).toEqual(['r1', 'r2']);
    const r1 = res.rooms.find((r) => r.id === 'r1')!;
    const r2 = res.rooms.find((r) => r.id === 'r2')!;
    const moved = { x: 4, y: 0 };
    expect(r1.polygon[1]).toEqual(moved);
    // r2's copy of that corner moved to identical coordinates.
    expect(r2.polygon[0]).toEqual(moved);
  });

  it('refuses an overlap and leaves the rooms untouched BY REFERENCE', () => {
    // Two SEPARATE rooms with a 1 m gap. Growing r1's north wall from 4 m to
    // 8 m drives it through r2. Deliberately not the attached fixture: there
    // the shared corner propagates and the result is 'degenerate', which is a
    // different refusal and would not exercise the overlap guard.
    const rooms: ResizeRoom[] = [
      {
        id: 'r1', name: 'Room 1',
        polygon: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 4 },
          { x: 0, y: 4 },
        ],
      },
      {
        id: 'r2', name: 'Room 2',
        polygon: [
          { x: 5, y: 0 },
          { x: 9, y: 0 },
          { x: 9, y: 4 },
          { x: 5, y: 4 },
        ],
      },
    ];
    const snapshot = JSON.parse(JSON.stringify(rooms));
    const res = resizeRoomEdge({ rooms, roomId: 'r1', edgeIndex: 0, newLengthM: 8 });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe('overlap');
    // The by-reference check is the one that catches a half-applied edit:
    // an implementation that mutated before validating fails here even
    // though a deep-equal on the returned value might pass.
    expect(rooms[0].polygon).toEqual(snapshot[0].polygon);
    expect(rooms[1].polygon).toEqual(snapshot[1].polygon);
  });

  it('refuses a T-junction rather than tearing the neighbour wall', () => {
    // r2's west wall spans y 0->4 at x=5. r1's corner (5,4) sits ON that wall
    // but is NOT one of r2's corners, so moving it would tear r2 open.
    const rooms: ResizeRoom[] = [
      {
        id: 'r1', name: 'Room 1',
        polygon: [
          { x: 0, y: 2 },
          { x: 5, y: 2 },
          { x: 5, y: 4 },
          { x: 0, y: 4 },
        ],
      },
      {
        id: 'r2', name: 'Studio',
        polygon: [
          { x: 5, y: 0 },
          { x: 9, y: 0 },
          { x: 9, y: 6 },
          { x: 5, y: 6 },
        ],
      },
    ];
    const res = resizeRoomEdge({ rooms, roomId: 'r1', edgeIndex: 1, newLengthM: 1 });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe('shared-conflict');
    expect(res.conflictRoomName).toBe('Studio');
  });

  it('refuses a degenerate result', () => {
    const res = resizeRoomEdge({
      rooms: oneRoom(), roomId: 'r1', edgeIndex: 0, newLengthM: 0.0001,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    // Below the valid range floor, so it never even reaches the geometry.
    expect(res.reason).toBe('out-of-range');
  });

  it('refuses lengths outside the valid range', () => {
    for (const len of [0, -3, MAX_EDGE_M + 1, Number.NaN]) {
      const res = resizeRoomEdge({ rooms: oneRoom(), roomId: 'r1', edgeIndex: 0, newLengthM: len });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.reason).toBe('out-of-range');
    }
  });

  it('honours the active unit as the lower bound', () => {
    // 0.2 m is fine at 10 cm and refused at 1 m.
    expect(
      resizeRoomEdge({ rooms: oneRoom(), roomId: 'r1', edgeIndex: 0, newLengthM: 0.2, stepM: 0.1 }).ok,
    ).toBe(true);
    expect(
      resizeRoomEdge({ rooms: oneRoom(), roomId: 'r1', edgeIndex: 0, newLengthM: 0.2, stepM: 1 }).ok,
    ).toBe(false);
  });

  it('reports not-found for an unknown room or edge', () => {
    expect(resizeRoomEdge({ rooms: oneRoom(), roomId: 'nope', edgeIndex: 0, newLengthM: 3 })).toEqual({
      ok: false, reason: 'not-found',
    });
    expect(resizeRoomEdge({ rooms: oneRoom(), roomId: 'r1', edgeIndex: 99, newLengthM: 3 })).toEqual({
      ok: false, reason: 'not-found',
    });
  });
});
