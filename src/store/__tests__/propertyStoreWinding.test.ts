/**
 * propertyStore — polygon winding canonicalisation (doors 2026-08-31,
 * defect 4) and the duplicate-vertex hardening of `cleanPolygon` (defect 9).
 *
 * The store-level guarantee under test: EVERY path that writes a polygon
 * into the store (draw-commit via setRoomPolygon / addRoom, the save-file
 * load via normaliseLoadedRoom, the localStorage rehydrate via
 * canonicalisePropertyWinding) stores it CW — and when that means reversing
 * a CCW polygon that already carries openings, each opening keeps its EXACT
 * world-space gap.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  usePropertyStore,
  normaliseLoadedRoom,
  canonicalisePropertyWinding,
  cleanPolygon,
  roomOpenings,
  type Property,
} from '../propertyStore';
import {
  isClockwisePolygon,
  openingSpan,
  signedPolygonAreaM2,
  type Opening,
} from '../../designer/openings';
import { pointAlongEdge, roomEdges } from '../../designer/wallEdges';
import type { Polygon, Vertex } from '../../lib/geometry';

const CCW_SQUARE: Polygon = [
  { x: 0, y: 0 },
  { x: 0, y: 4 },
  { x: 5, y: 4 },
  { x: 5, y: 0 },
];

const DOOR_ON_CCW_TOP: Opening = {
  id: 'd1',
  // Top wall (y = 0) of the CCW square is edge 3: (5,0) -> (0,0).
  edgeIndex: 3,
  offsetM: 1.25,
  widthM: 0.8,
  kind: 'door',
  flipFacing: false,
  flipHand: false,
};

/** World-space endpoints of an opening's gap, sorted for order-insensitivity. */
function worldGap(polygon: Polygon, o: Opening): [Vertex, Vertex] {
  const edge = roomEdges({ id: 'r', polygon }).find((e) => e.index === o.edgeIndex)!;
  const { t0, t1 } = openingSpan(o);
  const a = pointAlongEdge(edge, t0);
  const b = pointAlongEdge(edge, t1);
  return a.x < b.x || (a.x === b.x && a.y <= b.y) ? [a, b] : [b, a];
}

beforeEach(() => {
  usePropertyStore.getState().resetToDefault();
});

describe('draw-commit canonicalises winding', () => {
  it('setRoomPolygon stores a CCW polygon as CW, same area', () => {
    const ps = usePropertyStore.getState();
    const id = ps.property.rooms[0].id;
    ps.setRoomPolygon(id, CCW_SQUARE);
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === id)!;
    expect(isClockwisePolygon(room.polygon)).toBe(true);
    expect(signedPolygonAreaM2(room.polygon)).toBeCloseTo(20, 9);
  });

  it('addRoom({polygon}) stores a CCW free-draw as CW', () => {
    const id = usePropertyStore.getState().addRoom({ name: 'Drawn', polygon: CCW_SQUARE });
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === id)!;
    expect(isClockwisePolygon(room.polygon)).toBe(true);
  });

  it('setRoomPolygon drops a duplicate vertex', () => {
    const ps = usePropertyStore.getState();
    const id = ps.property.rooms[0].id;
    ps.setRoomPolygon(id, [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 0, y: 4 },
    ]);
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === id)!;
    expect(room.polygon).toHaveLength(4);
    expect(isClockwisePolygon(room.polygon)).toBe(true);
  });
});

describe('load path canonicalises winding and remaps openings exactly', () => {
  it('normaliseLoadedRoom: CCW room + door round-trips to the same world gap', () => {
    const gapBefore = worldGap(CCW_SQUARE, DOOR_ON_CCW_TOP);

    const room = normaliseLoadedRoom({
      id: 'r1',
      name: 'Studio',
      polygon: CCW_SQUARE,
      placedItems: [],
      openings: [DOOR_ON_CCW_TOP],
    });

    expect(isClockwisePolygon(room.polygon)).toBe(true);
    expect(roomOpenings(room)).toHaveLength(1);
    const after = roomOpenings(room)[0];
    expect(after.edgeIndex).toBe(0);
    expect(after.offsetM).toBeCloseTo(3.75, 9);

    const gapAfter = worldGap(room.polygon, after);
    expect(gapAfter[0].x).toBeCloseTo(gapBefore[0].x, 9);
    expect(gapAfter[0].y).toBeCloseTo(gapBefore[0].y, 9);
    expect(gapAfter[1].x).toBeCloseTo(gapBefore[1].x, 9);
    expect(gapAfter[1].y).toBeCloseTo(gapBefore[1].y, 9);
  });

  it('canonicalisePropertyWinding (rehydrate hook) fixes CCW rooms, keeps doors', () => {
    const property: Property = {
      id: 'p1',
      name: 'P',
      activeRoomId: 'r1',
      rooms: [
        {
          id: 'r1',
          name: 'Room 1',
          polygon: CCW_SQUARE,
          placedItems: [],
          openings: [DOOR_ON_CCW_TOP],
        },
      ],
    };
    const gapBefore = worldGap(CCW_SQUARE, DOOR_ON_CCW_TOP);

    const out = canonicalisePropertyWinding(property);
    expect(out).not.toBe(property);
    const room = out.rooms[0];
    expect(isClockwisePolygon(room.polygon)).toBe(true);
    const after = roomOpenings(room)[0];
    const gapAfter = worldGap(room.polygon, after);
    expect(gapAfter[0].x).toBeCloseTo(gapBefore[0].x, 9);
    expect(gapAfter[1].x).toBeCloseTo(gapBefore[1].x, 9);
    expect(gapAfter[0].y).toBeCloseTo(gapBefore[0].y, 9);
    expect(gapAfter[1].y).toBeCloseTo(gapBefore[1].y, 9);
  });

  it('canonicalisePropertyWinding returns an already-canonical property by reference', () => {
    const property: Property = {
      id: 'p1',
      name: 'P',
      activeRoomId: 'r1',
      rooms: [
        {
          id: 'r1',
          name: 'Room 1',
          polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
          placedItems: [],
        },
      ],
    };
    expect(canonicalisePropertyWinding(property)).toBe(property);
  });
});

describe('cleanPolygon — duplicate vertices', () => {
  it('drops a CONSECUTIVE duplicate vertex mid-polygon', () => {
    expect(
      cleanPolygon([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 4 },
        { x: 0, y: 4 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 0, y: 4 },
    ]);
  });

  it('still drops a trailing duplicate-of-first vertex', () => {
    expect(
      cleanPolygon([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 4 },
        { x: 0, y: 0 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
    ]);
  });

  it('returns a clean polygon by reference', () => {
    const p: Polygon = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }];
    expect(cleanPolygon(p)).toBe(p);
  });
});
