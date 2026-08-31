/**
 * roomLayout — truth table for the attached multi-room geometry.
 *
 * The overlap predicate is the invariant that keeps rooms from being drawn
 * on top of each other, so it gets the harshest coverage: the two payloads
 * that defeat a naive crossing+vertex test (identical stacked rectangles,
 * and a snap-traced sub-rectangle whose vertices all sit ON the host's
 * boundary) each get their own case.
 */
import { describe, it, expect } from 'vitest';
import {
  SNAP_TOL_M,
  findRoomAt,
  isDrawnPolygon,
  nextRectanglePosition,
  snapVertexToRooms,
  strictPolygonsOverlap,
  translatePolygon,
  unionBounds,
  unstackLegacyRooms,
} from '../roomLayout';
import type { Polygon } from '../../lib/geometry';

const R1: Polygon = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }];
/** Shares R1's east wall (x = 5) exactly. */
const R2_ATTACHED: Polygon = [{ x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 4 }, { x: 5, y: 4 }];

describe('isDrawnPolygon / translatePolygon / unionBounds', () => {
  it('a blank room polygon is not drawn', () => {
    expect(isDrawnPolygon([])).toBe(false);
    expect(isDrawnPolygon([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBe(false);
    expect(isDrawnPolygon(R1)).toBe(true);
  });

  it('translatePolygon shifts every vertex and does not mutate the input', () => {
    const moved = translatePolygon(R1, 2, -1);
    expect(moved).toEqual([
      { x: 2, y: -1 }, { x: 7, y: -1 }, { x: 7, y: 3 }, { x: 2, y: 3 },
    ]);
    expect(R1[0]).toEqual({ x: 0, y: 0 });
  });

  it('unionBounds spans every drawn room and ignores blank ones', () => {
    expect(
      unionBounds([
        { id: 'a', polygon: R1 },
        { id: 'b', polygon: R2_ATTACHED },
        { id: 'blank', polygon: [] },
      ]),
    ).toEqual({ minX: 0, minY: 0, maxX: 9, maxY: 4 });
  });

  it('unionBounds is null when nothing is drawn', () => {
    expect(unionBounds([{ id: 'blank', polygon: [] }])).toBeNull();
    expect(unionBounds([])).toBeNull();
  });
});

describe('strictPolygonsOverlap', () => {
  it('shared-edge rectangles PASS (attached rooms are the whole feature)', () => {
    expect(strictPolygonsOverlap(R1, R2_ATTACHED)).toBe(false);
    expect(strictPolygonsOverlap(R2_ATTACHED, R1)).toBe(false);
  });

  it('rooms touching at a single shared VERTEX pass', () => {
    const diagonal: Polygon = [{ x: 5, y: 4 }, { x: 8, y: 4 }, { x: 8, y: 7 }, { x: 5, y: 7 }];
    expect(strictPolygonsOverlap(R1, diagonal)).toBe(false);
  });

  it('fully disjoint rooms pass', () => {
    const far: Polygon = [{ x: 20, y: 20 }, { x: 24, y: 20 }, { x: 24, y: 24 }, { x: 20, y: 24 }];
    expect(strictPolygonsOverlap(R1, far)).toBe(false);
  });

  it('interior overlap REJECTS', () => {
    const overlapping: Polygon = [{ x: 3, y: 1 }, { x: 8, y: 1 }, { x: 8, y: 3 }, { x: 3, y: 3 }];
    expect(strictPolygonsOverlap(R1, overlapping)).toBe(true);
    expect(strictPolygonsOverlap(overlapping, R1)).toBe(true);
  });

  it('IDENTICAL stacked rectangles REJECT (no strict-interior vertex, no crossing)', () => {
    // Every vertex lies ON the other's boundary and no edge pair properly
    // crosses — only the centroid probe catches this. It is the canonical
    // legacy payload: every rectToPolygon room was pinned at the origin.
    expect(strictPolygonsOverlap(R1, [...R1])).toBe(true);
  });

  it('snap-traced SUB-rectangle REJECTS (all vertices on the host boundary)', () => {
    // The user traced along two existing walls; every vertex is boundary-
    // exact, nothing properly crosses, nothing is strictly interior.
    const sub: Polygon = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 4 }, { x: 0, y: 4 }];
    expect(strictPolygonsOverlap(R1, sub)).toBe(true);
    expect(strictPolygonsOverlap(sub, R1)).toBe(true);
  });

  it('a fully CONTAINED room rejects', () => {
    const inner: Polygon = [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 }];
    expect(strictPolygonsOverlap(R1, inner)).toBe(true);
    expect(strictPolygonsOverlap(inner, R1)).toBe(true);
  });

  it('edge crossing WITHOUT a contained vertex rejects (plus/cross shape)', () => {
    const bar: Polygon = [{ x: -1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 2 }, { x: -1, y: 2 }];
    const post: Polygon = [{ x: 1, y: -1 }, { x: 2, y: -1 }, { x: 2, y: 5 }, { x: 1, y: 5 }];
    expect(strictPolygonsOverlap(bar, post)).toBe(true);
  });

  it('a tiny 0.13 m overlap strip rejects (the grid-snap-without-wall-snap bug)', () => {
    // A snap-less build grid-snaps a 5.13 m wall down to 5.0 and the new
    // room bites 0.13 m into the old one. This case is exactly what the
    // P5 e2e assertion turns red on.
    const host: Polygon = [{ x: 0, y: 0 }, { x: 5.13, y: 0 }, { x: 5.13, y: 4 }, { x: 0, y: 4 }];
    const biting: Polygon = [{ x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 4 }, { x: 5, y: 4 }];
    expect(strictPolygonsOverlap(host, biting)).toBe(true);
  });

  it('blank polygons never overlap anything', () => {
    expect(strictPolygonsOverlap([], R1)).toBe(false);
    expect(strictPolygonsOverlap(R1, [])).toBe(false);
  });
});

describe('findRoomAt', () => {
  const rooms = [
    { id: 'r1', polygon: R1 },
    { id: 'r2', polygon: R2_ATTACHED },
    { id: 'blank', polygon: [] as Polygon },
  ];

  it('routes an interior point to its own room', () => {
    expect(findRoomAt({ x: 2, y: 2 }, rooms, 'r1')?.id).toBe('r1');
    expect(findRoomAt({ x: 7, y: 2 }, rooms, 'r1')?.id).toBe('r2');
  });

  it('prefers the ACTIVE room for a point on the SHARED wall', () => {
    // pointInPolygon is boundary-inclusive, so (5, 2) is inside BOTH.
    // The ordering IS the tie-break.
    expect(findRoomAt({ x: 5, y: 2 }, rooms, 'r1')?.id).toBe('r1');
    expect(findRoomAt({ x: 5, y: 2 }, rooms, 'r2')?.id).toBe('r2');
  });

  it('falls back to array order when the active room misses', () => {
    expect(findRoomAt({ x: 5, y: 2 }, rooms, 'blank')?.id).toBe('r1');
    expect(findRoomAt({ x: 5, y: 2 }, rooms, null)?.id).toBe('r1');
  });

  it('returns null outside every room, and skips blank rooms', () => {
    expect(findRoomAt({ x: -1, y: -1 }, rooms, 'r1')).toBeNull();
    expect(findRoomAt({ x: 50, y: 50 }, rooms, 'r1')).toBeNull();
    expect(findRoomAt({ x: 0, y: 0 }, [{ id: 'blank', polygon: [] }], 'blank')).toBeNull();
  });
});

describe('snapVertexToRooms', () => {
  const rooms = [{ id: 'r1', polygon: R1 }];

  it('prefers a VERTEX over an edge when both are in range', () => {
    // (0.1, 0.1) is 0.14 m from the (0,0) corner and 0.1 m from both edges;
    // the corner must win so shared corners stay exact.
    const hit = snapVertexToRooms({ x: 0.1, y: 0.1 }, rooms, SNAP_TOL_M);
    expect(hit).not.toBeNull();
    expect(hit!.kind).toBe('vertex');
    expect(hit!.v).toEqual({ x: 0, y: 0 });
  });

  it('projects perpendicularly onto the nearest EDGE when no vertex is close', () => {
    const hit = snapVertexToRooms({ x: 2.37, y: 0.12 }, rooms, SNAP_TOL_M);
    expect(hit).not.toBeNull();
    expect(hit!.kind).toBe('edge');
    expect(hit!.v.x).toBeCloseTo(2.37, 9);
    expect(hit!.v.y).toBeCloseTo(0, 9);
  });

  it('respects the tolerance — nothing within tol returns null', () => {
    expect(snapVertexToRooms({ x: 2.5, y: 2 }, rooms, SNAP_TOL_M)).toBeNull();
    expect(snapVertexToRooms({ x: 2.5, y: 0.5 }, rooms, SNAP_TOL_M)).toBeNull();
  });

  it('snaps onto an OFF-GRID wall exactly, and that output is not on the grid', () => {
    // This is the ordering guarantee: wall-snap first, and the caller must
    // NOT re-grid-snap the result. 5.13 would grid-snap back to 5.0 and
    // reintroduce a 0.13 m overlap strip.
    const offGrid: Polygon = [
      { x: 0, y: 0 }, { x: 5.13, y: 0 }, { x: 5.13, y: 4 }, { x: 0, y: 4 },
    ];
    const hit = snapVertexToRooms({ x: 5.06, y: 2 }, [{ id: 'a', polygon: offGrid }], SNAP_TOL_M);
    expect(hit).not.toBeNull();
    expect(hit!.v.x).toBeCloseTo(5.13, 9);
    // Explicitly NOT the 0.5 m grid value.
    expect(hit!.v.x).not.toBeCloseTo(5.0, 3);
  });

  it('ignores blank rooms', () => {
    expect(snapVertexToRooms({ x: 0, y: 0 }, [{ id: 'blank', polygon: [] }], SNAP_TOL_M)).toBeNull();
  });
});

describe('nextRectanglePosition', () => {
  it('is (0,0) on a fresh canvas (preserves today behaviour exactly)', () => {
    expect(nextRectanglePosition([], { lengthM: 5, widthM: 4 })).toEqual({ x: 0, y: 0 });
    expect(nextRectanglePosition([{ id: 'blank', polygon: [] }])).toEqual({ x: 0, y: 0 });
  });

  it('anchors flush-RIGHT of the union so the new room shares its east wall', () => {
    expect(nextRectanglePosition([{ id: 'a', polygon: R1 }])).toEqual({ x: 5, y: 0 });
    expect(
      nextRectanglePosition([{ id: 'a', polygon: R1 }, { id: 'b', polygon: R2_ATTACHED }]),
    ).toEqual({ x: 9, y: 0 });
  });

  it('the anchored rectangle does NOT overlap the room it attaches to', () => {
    const anchor = nextRectanglePosition([{ id: 'a', polygon: R1 }]);
    const placed = translatePolygon(
      [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }],
      anchor.x,
      anchor.y,
    );
    expect(strictPolygonsOverlap(R1, placed)).toBe(false);
  });
});

describe('unstackLegacyRooms', () => {
  function legacyProperty() {
    return {
      id: 'p',
      name: 'Legacy',
      activeRoomId: 'a',
      rooms: [
        {
          id: 'a',
          name: 'A',
          polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }] as Polygon,
          placedItems: [{ instanceId: 'i1', productId: 'p1', x: 1, y: 1, rotation: 0 }],
        },
        {
          id: 'b',
          name: 'B',
          polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }] as Polygon,
          placedItems: [{ instanceId: 'i2', productId: 'p2', x: 1, y: 1, rotation: 90 }],
        },
        {
          id: 'c',
          name: 'C',
          polygon: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 }] as Polygon,
          placedItems: [{ instanceId: 'i3', productId: 'p3', x: 2, y: 2, rotation: 180 }],
        },
      ],
    };
  }

  it('re-lays 3 rooms stacked at the origin into a flush-right attached row', () => {
    const out = unstackLegacyRooms(legacyProperty());
    expect(out.rooms[0].polygon).toEqual(legacyProperty().rooms[0].polygon); // room 0 stays
    expect(out.rooms[1].polygon).toEqual([
      { x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 3 }, { x: 5, y: 3 },
    ]);
    expect(out.rooms[2].polygon).toEqual([
      { x: 9, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 3 }, { x: 9, y: 3 },
    ]);
  });

  it('translates placedItems by the SAME delta as their room', () => {
    const out = unstackLegacyRooms(legacyProperty());
    expect(out.rooms[0].placedItems[0]).toMatchObject({ x: 1, y: 1 });
    expect(out.rooms[1].placedItems[0]).toMatchObject({ x: 6, y: 1, rotation: 90 });
    expect(out.rooms[2].placedItems[0]).toMatchObject({ x: 11, y: 2, rotation: 180 });
  });

  it('leaves NO pair overlapping after the un-stack', () => {
    const out = unstackLegacyRooms(legacyProperty());
    for (let i = 0; i < out.rooms.length; i++) {
      for (let j = i + 1; j < out.rooms.length; j++) {
        expect(strictPolygonsOverlap(out.rooms[i].polygon, out.rooms[j].polygon)).toBe(false);
      }
    }
  });

  it('is IDEMPOTENT — running it twice gives the same output', () => {
    const once = unstackLegacyRooms(legacyProperty());
    const twice = unstackLegacyRooms(once);
    expect(twice).toEqual(once);
    // Second pass finds no overlap, so it returns the SAME reference.
    expect(twice).toBe(once);
  });

  it('returns the input BY REFERENCE when nothing overlaps', () => {
    const attached = {
      rooms: [
        { id: 'a', polygon: R1, placedItems: [] },
        { id: 'b', polygon: R2_ATTACHED, placedItems: [] },
      ],
    };
    expect(unstackLegacyRooms(attached)).toBe(attached);
  });

  it('is a no-op with fewer than 2 drawn rooms', () => {
    const one = { rooms: [{ id: 'a', polygon: R1, placedItems: [] }, { id: 'b', polygon: [] as Polygon, placedItems: [] }] };
    expect(unstackLegacyRooms(one)).toBe(one);
  });

  it('carries blank rooms through untouched', () => {
    const withBlank = {
      rooms: [
        { id: 'a', polygon: R1, placedItems: [] },
        { id: 'blank', polygon: [] as Polygon, placedItems: [] },
        { id: 'b', polygon: [...R1], placedItems: [] },
      ],
    };
    const out = unstackLegacyRooms(withBlank);
    expect(out.rooms[1].polygon).toEqual([]);
    expect(out.rooms[2].polygon).toEqual([
      { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 5, y: 4 },
    ]);
  });

  // Doors round 2026-08-31: an upper storey is drawn directly over the
  // ground floor — cross-level coincidence is the storeys FEATURE, and the
  // legacy un-stack used to shred it into an "attached layout".
  it('storeys STACK by design — coincident rooms on different levels are untouched', () => {
    const stacked = {
      rooms: [
        { id: 'g', polygon: R1, placedItems: [] },
        { id: 'up', polygon: [...R1], placedItems: [], levelId: 'up' },
      ],
    };
    expect(unstackLegacyRooms(stacked)).toBe(stacked);
  });

  it('un-stacks ONLY the level that overlaps; stacked upper storeys ride along', () => {
    const mixed = {
      rooms: [
        { id: 'a', polygon: R1, placedItems: [] },
        { id: 'b', polygon: [...R1], placedItems: [] },
        { id: 'up', polygon: [...R1], placedItems: [], levelId: 'up' },
      ],
    };
    const out = unstackLegacyRooms(mixed);
    expect(out.rooms[1].polygon).toEqual([
      { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 5, y: 4 },
    ]);
    // The upper storey stays exactly over the ground floor.
    expect(out.rooms[2].polygon).toEqual(R1);
  });
});
