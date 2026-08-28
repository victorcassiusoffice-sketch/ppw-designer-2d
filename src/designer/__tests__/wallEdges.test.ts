/**
 * Truth table for `wallEdges` — the geometry doors hang off.
 *
 * The fixture is the REAL two-room attached layout the e2e suite seeds, so the
 * shared-wall cases exercise the actual winding the app produces rather than a
 * convenient synthetic one. That matters: the two rooms traverse their shared
 * wall in OPPOSITE directions, which is precisely the case a naive
 * same-direction parallelism test would reject.
 */
import { describe, it, expect } from 'vitest';
import {
  roomEdges,
  nearestEdge,
  collinearOverlap,
  sharedEdgeMap,
  splitEdgeSpans,
  distanceToEdge,
  pointAlongEdge,
  projectOntoEdge,
  edgeKey,
  type EdgeRoom,
} from '../wallEdges';

// The e2e TWO_ROOM_FIXTURE geometry: two 4 m-tall rooms meeting on x = 5.
const R1: EdgeRoom = {
  id: 'r1',
  polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
};
const R2: EdgeRoom = {
  id: 'r2',
  polygon: [{ x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 4 }, { x: 5, y: 4 }],
};

describe('roomEdges', () => {
  it('returns one edge per polygon side, closing last -> first', () => {
    const e = roomEdges(R1);
    expect(e).toHaveLength(4);
    expect(e[0].a).toEqual({ x: 0, y: 0 });
    expect(e[0].b).toEqual({ x: 5, y: 0 });
    // closing edge
    expect(e[3].a).toEqual({ x: 0, y: 4 });
    expect(e[3].b).toEqual({ x: 0, y: 0 });
  });

  it('reports length and unit direction', () => {
    const [top, east] = roomEdges(R1);
    expect(top.lengthM).toBeCloseTo(5, 9);
    expect(top.dx).toBeCloseTo(1, 9);
    expect(top.dy).toBeCloseTo(0, 9);
    expect(east.lengthM).toBeCloseTo(4, 9);
    expect(east.dy).toBeCloseTo(1, 9);
  });

  it('returns nothing for an undrawn polygon', () => {
    expect(roomEdges({ id: 'blank', polygon: [] })).toEqual([]);
    expect(roomEdges({ id: 'line', polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }] })).toEqual([]);
  });

  it('drops a degenerate zero-length edge rather than emitting a NaN direction', () => {
    const dup: EdgeRoom = {
      id: 'dup',
      polygon: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }],
    };
    const edges = roomEdges(dup);
    expect(edges).toHaveLength(3);
    for (const e of edges) {
      expect(Number.isFinite(e.dx)).toBe(true);
      expect(Number.isFinite(e.dy)).toBe(true);
    }
  });
});

describe('projection helpers', () => {
  it('projectOntoEdge / pointAlongEdge round-trip', () => {
    const east = roomEdges(R1)[1]; // (5,0) -> (5,4)
    const p = pointAlongEdge(east, 1.5);
    expect(p).toEqual({ x: 5, y: 1.5 });
    expect(projectOntoEdge(east, p)).toBeCloseTo(1.5, 9);
  });

  it('distanceToEdge clamps beyond the segment ends', () => {
    const top = roomEdges(R1)[0]; // (0,0) -> (5,0)
    // Straight off the end: nearest point is the end vertex, not the line.
    const past = distanceToEdge(top, { x: 8, y: 0 });
    expect(past.offsetM).toBeCloseTo(5, 9);
    expect(past.distanceM).toBeCloseTo(3, 9);
    // Perpendicular from the middle.
    const mid = distanceToEdge(top, { x: 2.5, y: 0.75 });
    expect(mid.offsetM).toBeCloseTo(2.5, 9);
    expect(mid.distanceM).toBeCloseTo(0.75, 9);
  });
});

describe('nearestEdge', () => {
  it('finds the wall under a click and reports where along it', () => {
    const hit = nearestEdge({ x: 2, y: 0.1 }, [R1, R2], 0.3);
    expect(hit).not.toBeNull();
    expect(hit!.edge.roomId).toBe('r1');
    expect(hit!.edge.index).toBe(0);
    expect(hit!.offsetM).toBeCloseTo(2, 9);
  });

  it('returns null beyond the tolerance', () => {
    expect(nearestEdge({ x: 2, y: 1.5 }, [R1, R2], 0.3)).toBeNull();
  });

  it('is deterministic on a SHARED wall, so the door ghost cannot flicker', () => {
    // x=5 is equidistant from r1's east edge and r2's west edge.
    const a = nearestEdge({ x: 5, y: 2 }, [R1, R2], 0.3);
    const b = nearestEdge({ x: 5, y: 2 }, [R1, R2], 0.3);
    expect(a!.edge.roomId).toBe(b!.edge.roomId);
    expect(a!.edge.index).toBe(b!.edge.index);
    // Property order wins the tie.
    expect(a!.edge.roomId).toBe('r1');
  });

  it('ignores undrawn rooms', () => {
    const blank: EdgeRoom = { id: 'blank', polygon: [] };
    const hit = nearestEdge({ x: 2, y: 0.1 }, [blank, R1], 0.3);
    expect(hit!.edge.roomId).toBe('r1');
  });
});

describe('collinearOverlap', () => {
  it('detects a shared wall traversed in OPPOSITE directions (the real case)', () => {
    const e1 = roomEdges(R1)[1]; // (5,0) -> (5,4), pointing +y
    const e2 = roomEdges(R2)[3]; // (5,4) -> (5,0), pointing -y
    expect(e1.dy).toBeCloseTo(1, 9);
    expect(e2.dy).toBeCloseTo(-1, 9);

    const ov = collinearOverlap(e1, e2);
    expect(ov).not.toBeNull();
    expect(ov!.t0).toBeCloseTo(0, 9);
    expect(ov!.t1).toBeCloseTo(4, 9);
  });

  it('is symmetric', () => {
    const e1 = roomEdges(R1)[1];
    const e2 = roomEdges(R2)[3];
    const ab = collinearOverlap(e1, e2)!;
    const ba = collinearOverlap(e2, e1)!;
    expect(ab.t1 - ab.t0).toBeCloseTo(ba.t1 - ba.t0, 9);
  });

  it('rejects parallel walls that are NOT on the same line', () => {
    const west = roomEdges(R1)[3]; // x = 0
    const east = roomEdges(R1)[1]; // x = 5
    expect(collinearOverlap(west, east)).toBeNull();
  });

  it('rejects perpendicular walls', () => {
    const [top, east] = roomEdges(R1);
    expect(collinearOverlap(top, east)).toBeNull();
  });

  it('rejects collinear walls that only touch end-to-end (zero overlap)', () => {
    const a: EdgeRoom = { id: 'a', polygon: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }] };
    const b: EdgeRoom = { id: 'b', polygon: [{ x: 2, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 2 }] };
    const ea = roomEdges(a)[0]; // (0,0)->(2,0)
    const eb = roomEdges(b)[0]; // (2,0)->(5,0)
    expect(collinearOverlap(ea, eb)).toBeNull();
  });

  it('reports a PARTIAL overlap when a short wall meets a long one', () => {
    // A 2 m room attached to the middle of r1's 5 m top wall.
    const small: EdgeRoom = {
      id: 's',
      polygon: [{ x: 1, y: 0 }, { x: 3, y: 0 }, { x: 3, y: -2 }, { x: 1, y: -2 }],
    };
    const top = roomEdges(R1)[0]; // (0,0) -> (5,0)
    const sTop = roomEdges(small)[0]; // (1,0) -> (3,0)
    const ov = collinearOverlap(top, sTop);
    expect(ov).not.toBeNull();
    expect(ov!.t0).toBeCloseTo(1, 9);
    expect(ov!.t1).toBeCloseTo(3, 9);
  });
});

describe('sharedEdgeMap', () => {
  it('links the two rooms across their shared wall, both ways', () => {
    const map = sharedEdgeMap([R1, R2]);

    const r1East = map.get(edgeKey('r1', 1));
    expect(r1East).toHaveLength(1);
    expect(r1East![0]).toMatchObject({ roomId: 'r2', edgeIndex: 3 });

    const r2West = map.get(edgeKey('r2', 3));
    expect(r2West).toHaveLength(1);
    expect(r2West![0]).toMatchObject({ roomId: 'r1', edgeIndex: 1 });
  });

  it('leaves non-shared walls unlinked', () => {
    const map = sharedEdgeMap([R1, R2]);
    expect(map.get(edgeKey('r1', 3))).toBeUndefined(); // r1 west, outer wall
    expect(map.get(edgeKey('r2', 1))).toBeUndefined(); // r2 east, outer wall
  });

  it('is empty for a single room', () => {
    expect(sharedEdgeMap([R1]).size).toBe(0);
  });
});

describe('splitEdgeSpans', () => {
  it('returns the whole wall when there are no openings', () => {
    expect(splitEdgeSpans(4, [])).toEqual([{ t0: 0, t1: 4 }]);
  });

  it('cuts a central opening into two solid runs', () => {
    expect(splitEdgeSpans(4, [{ t0: 1.5, t1: 2.5 }])).toEqual([
      { t0: 0, t1: 1.5 },
      { t0: 2.5, t1: 4 },
    ]);
  });

  it('handles an opening flush to the start or the end', () => {
    expect(splitEdgeSpans(4, [{ t0: 0, t1: 1 }])).toEqual([{ t0: 1, t1: 4 }]);
    expect(splitEdgeSpans(4, [{ t0: 3, t1: 4 }])).toEqual([{ t0: 0, t1: 3 }]);
  });

  it('merges overlapping gaps and tolerates unsorted input', () => {
    expect(splitEdgeSpans(6, [{ t0: 3, t1: 4.5 }, { t0: 1, t1: 3.5 }])).toEqual([
      { t0: 0, t1: 1 },
      { t0: 4.5, t1: 6 },
    ]);
  });

  it('normalises a reversed span', () => {
    expect(splitEdgeSpans(4, [{ t0: 2.5, t1: 1.5 }])).toEqual([
      { t0: 0, t1: 1.5 },
      { t0: 2.5, t1: 4 },
    ]);
  });

  it('clamps a gap that runs past the wall', () => {
    expect(splitEdgeSpans(4, [{ t0: -2, t1: 1 }])).toEqual([{ t0: 1, t1: 4 }]);
    expect(splitEdgeSpans(4, [{ t0: 3, t1: 99 }])).toEqual([{ t0: 0, t1: 3 }]);
  });

  it('returns NOTHING for a fully open wall — a threshold, not an error', () => {
    expect(splitEdgeSpans(4, [{ t0: 0, t1: 4 }])).toEqual([]);
  });

  it('ignores sub-millimetre gaps', () => {
    expect(splitEdgeSpans(4, [{ t0: 2, t1: 2.0000001 }])).toEqual([{ t0: 0, t1: 4 }]);
  });
});
