/** @vitest-environment jsdom */
/**
 * A curved wall stays on ITS wall through the edits that rebuild an outline themselves: a part of a wall removed,
 * rooms made from walls that close, "Pull curve", and a roof slab that follows the room under it. Each test
 * places an arc, runs the edit and asks where the arc is now: on the same two ends, through the same middle
 * point, or (only where the test says so) gone. An arc that is left on its old edge number while corners were
 * put in before it fails these tests.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { usePropertyStore, type Property, type Room } from '../../store/propertyStore';
import { arcGeometry, type WallArc } from '../arcSegment';
import { inferConnectedRooms } from '../connectedWallRooms';
import type { FreeWall } from '../freeWalls';
import { ROOF_LEVEL_ID } from '../levels';
import { removeBuildTarget } from '../removeBuildTarget';
import { roofRoomIdFor, syncRoofRooms } from '../roof';
import { bendAt, bendRefusal, commitBend } from '../surfaceActions';

const v = (x: number, y: number) => ({ x, y });
const box = (x: number, y: number, w: number, h: number) => [
  v(x, y),
  v(x + w, y),
  v(x + w, y + h),
  v(x, y + h),
];
const room = (id: string, polygon: Room['polygon'], wallArcs?: WallArc[]): Room => ({
  id,
  name: id,
  polygon,
  placedItems: [],
  ...(wallArcs ? { wallArcs } : {}),
});
const wall = (
  id: string,
  a: Room['polygon'][0],
  b: Room['polygon'][0],
  bulge?: number,
): FreeWall => ({
  id,
  a,
  b,
  thicknessM: 0.12,
  levelId: 'ground',
  ...(bulge === undefined ? {} : { bulge }),
});

/** Where a curved wall is, free of edge numbers and of which way the outline runs: its ends and its middle. */
interface Where {
  ends: string;
  middle: { x: number; y: number };
}
const key = (p: { x: number; y: number }) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
function where(a: { x: number; y: number }, b: { x: number; y: number }, bulge: number): Where {
  const arc = arcGeometry(a, b, bulge);
  if (!arc) throw new Error('not an arc');
  return { ends: [key(a), key(b)].sort().join(' | '), middle: arc.middle };
}
function arcsOfRoom(r: Room): Where[] {
  return (r.wallArcs ?? []).map((arc) => {
    const a = r.polygon[arc.edgeIndex];
    const b = r.polygon[(arc.edgeIndex + 1) % r.polygon.length];
    expect(a, `arc on edge ${arc.edgeIndex} of ${r.id}: no such corner`).toBeDefined();
    return where(a, b, arc.bulge);
  });
}
function expectSamePlace(now: Where, before: Where) {
  expect(now.ends).toBe(before.ends);
  expect(now.middle.x).toBeCloseTo(before.middle.x, 9);
  expect(now.middle.y).toBeCloseTo(before.middle.y, 9);
}
const prop = () => usePropertyStore.getState().property;
function load(rooms: Room[], walls: FreeWall[] = []) {
  usePropertyStore.getState().resetToDefault();
  usePropertyStore.setState({
    property: { ...prop(), site: undefined, activeRoomId: rooms[0].id, rooms, walls },
  });
}
const roomById = (id: string) => prop().rooms.find((r) => r.id === id)!;

beforeEach(() => usePropertyStore.getState().resetToDefault());

describe('a part of a wall removed', () => {
  it('keeps a curve on its wall when corners are put into the outline before it', () => {
    // The neighbour is shorter than the wall it shares: taking its wall out opens the MIDDLE of the long wall,
    // which puts two new corners into the big room's outline, before the curved edges.
    load([
      room('big', box(0, 0, 8, 6), [
        { edgeIndex: 2, bulge: 0.3 },
        { edgeIndex: 3, bulge: -0.15 },
      ]),
      room('small', [v(2, -3), v(6, -3), v(6, 0), v(2, 0)], [{ edgeIndex: 0, bulge: 0.2 }]),
    ]);
    const before = arcsOfRoom(roomById('big'));
    const beforeSmall = arcsOfRoom(roomById('small'));
    expect(
      removeBuildTarget({ kind: 'wall', hit: { kind: 'edge', roomId: 'small', edgeIndex: 2 } }).ok,
    ).toBe(true);
    const big = roomById('big');
    expect(big.polygon).toHaveLength(6);
    expect(big.removedWallEdges).toEqual([1]);
    const now = arcsOfRoom(big);
    expect(now).toHaveLength(2);
    expectSamePlace(now[0], before[0]);
    expectSamePlace(now[1], before[1]);
    expectSamePlace(arcsOfRoom(roomById('small'))[0], beforeSmall[0]);
  });

  it('keeps the curve of an outline whose curved wall is taken out: the floor keeps its shape', () => {
    load([room('big', box(0, 0, 8, 6), [{ edgeIndex: 2, bulge: 0.3 }])]);
    const before = arcsOfRoom(roomById('big'));
    expect(
      removeBuildTarget({ kind: 'wall', hit: { kind: 'edge', roomId: 'big', edgeIndex: 2 } }).ok,
    ).toBe(true);
    const big = roomById('big');
    expect(big.removedWallEdges).toEqual([2]);
    expect(big.polygon).toEqual(box(0, 0, 8, 6));
    expectSamePlace(arcsOfRoom(big)[0], before[0]);
  });

  it('takes a curved wall out of both rooms that share it, and out of no other', () => {
    // 'below' shares the curved wall (the same arc, run the other way: the sign is turned). 'chord' has a
    // STRAIGHT wall on the straight line between the curve's ends: that is another wall.
    load([
      room('big', box(0, 0, 8, 6), [{ edgeIndex: 2, bulge: 0.3 }]),
      room('below', [v(0, 6), v(8, 6), v(8, 9), v(0, 9)], [{ edgeIndex: 0, bulge: -0.3 }]),
      room('chord', [v(0, 6), v(8, 6), v(8, 12), v(0, 12)]),
    ]);
    expect(
      removeBuildTarget({ kind: 'wall', hit: { kind: 'edge', roomId: 'big', edgeIndex: 2 } }).ok,
    ).toBe(true);
    expect(roomById('big').removedWallEdges).toEqual([2]);
    expect(roomById('below').removedWallEdges).toEqual([0]);
    expect(roomById('below').wallArcs).toEqual([{ edgeIndex: 0, bulge: -0.3 }]);
    expect(roomById('chord').removedWallEdges ?? []).toEqual([]);
    expect(roomById('chord').polygon).toHaveLength(4);
  });

  it('does not cut a curved wall when a straight wall on the line between its ends is removed', () => {
    load([
      room('big', box(0, 0, 8, 6), [{ edgeIndex: 2, bulge: 0.3 }]),
      room('short', [v(2, 6), v(6, 6), v(6, 9), v(2, 9)]),
    ]);
    const before = arcsOfRoom(roomById('big'));
    expect(
      removeBuildTarget({ kind: 'wall', hit: { kind: 'edge', roomId: 'short', edgeIndex: 0 } }).ok,
    ).toBe(true);
    const big = roomById('big');
    expect(big.polygon).toEqual(box(0, 0, 8, 6));
    expect(big.removedWallEdges ?? []).toEqual([]);
    expectSamePlace(arcsOfRoom(big)[0], before[0]);
    expect(roomById('short').removedWallEdges).toEqual([0]);
  });
});

describe('rooms made from walls that close', () => {
  const property = (rooms: Room[], walls: FreeWall[]): Property => ({
    id: 'p',
    name: 'House',
    activeRoomId: rooms[0]?.id ?? '',
    rooms,
    walls,
  });
  const infer = (p: Property) => {
    let n = 0;
    return inferConnectedRooms(p, 'ground', () => `new-${n++}`);
  };
  const allArcs = (p: Property) => p.rooms.flatMap(arcsOfRoom);

  it('gives each half of a split room the curves of its own walls, and no other', () => {
    const start = property(
      [
        room('big', box(0, 0, 8, 6), [
          { edgeIndex: 1, bulge: 0.2 },
          { edgeIndex: 3, bulge: 0.35 },
        ]),
      ],
      [wall('w', v(4, 0), v(4, 6))],
    );
    const before = allArcs(start);
    const next = infer(start);
    expect(next.rooms).toHaveLength(2);
    const now = allArcs(next);
    expect(now).toHaveLength(2);
    for (const arc of before) expectSamePlace(now.find((n) => n.ends === arc.ends)!, arc);
    // One curve each: the right wall in one half, the left wall in the other.
    expect(next.rooms.map((r) => r.wallArcs?.length)).toEqual([1, 1]);
  });

  it('does not split a room with a wall that would cut a curved wall in two', () => {
    const start = property(
      [room('big', box(0, 0, 8, 6), [{ edgeIndex: 1, bulge: 0.2 }])],
      [wall('w', v(0, 3), v(8, 3))],
    );
    const next = infer(start);
    expect(next.rooms).toHaveLength(1);
    expect(next.rooms[0].polygon).toEqual(box(0, 0, 8, 6));
    expect(next.rooms[0].wallArcs).toEqual([{ edgeIndex: 1, bulge: 0.2 }]);
    expect(next.walls).toEqual(start.walls);
  });

  it('makes a room from walls that close and keeps the curve of the wall that was curved', () => {
    const walls = [
      wall('top', v(10, 0), v(14, 0)),
      wall('curved', v(14, 0), v(14, 4), 0.25),
      wall('bottom', v(14, 4), v(10, 4)),
      wall('left', v(10, 4), v(10, 0)),
    ];
    const next = infer(property([], walls));
    expect(next.rooms).toHaveLength(1);
    expect(next.walls).toEqual([]);
    const now = arcsOfRoom(next.rooms[0]);
    expect(now).toHaveLength(1);
    expectSamePlace(now[0], where(v(14, 0), v(14, 4), 0.25));
  });

  it('keeps a curved wall whole when only a part of it would become the edge of a room', () => {
    const walls = [
      wall('top', v(10, 0), v(14, 0)),
      wall('curved', v(14, -2), v(14, 6), 0.25),
      wall('bottom', v(14, 4), v(10, 4)),
      wall('left', v(10, 4), v(10, 0)),
    ];
    const start = property([], walls);
    const next = infer(start);
    expect(next.rooms).toHaveLength(0);
    expect(next.walls).toEqual(walls);
  });

  it('gives a room built against a curved wall that wall, run the other way', () => {
    const start = property(
      [room('first', box(0, 0, 4, 4), [{ edgeIndex: 1, bulge: 0.2 }])],
      [wall('a', v(4, 0), v(7, 0)), wall('b', v(7, 0), v(7, 4)), wall('c', v(7, 4), v(4, 4))],
    );
    const next = infer(start);
    expect(next.rooms).toHaveLength(2);
    expect(next.rooms[0]).toBe(start.rooms[0]);
    const now = arcsOfRoom(next.rooms[1]);
    expect(now).toHaveLength(1);
    expectSamePlace(now[0], where(v(4, 0), v(4, 4), 0.2));
  });

  it('leaves a straight wall alone that lies on the line between the ends of a curved wall', () => {
    // A room is made elsewhere on the storey, so the left-over walls are worked out again.
    const start = property(
      [room('first', box(0, 0, 4, 4), [{ edgeIndex: 1, bulge: 0.2 }])],
      [
        wall('on-the-chord', v(4, 0), v(4, 4)),
        wall('a', v(10, 0), v(13, 0)),
        wall('b', v(13, 0), v(13, 3)),
        wall('c', v(13, 3), v(10, 3)),
        wall('d', v(10, 3), v(10, 0)),
      ],
    );
    const next = infer(start);
    expect(next.rooms).toHaveLength(2);
    expect(next.walls?.map((w) => w.id)).toEqual(['on-the-chord']);
    expect(next.walls?.[0]).toEqual(start.walls?.[0]);
  });
});

describe('"Pull curve"', () => {
  it('keeps a curve on its wall when a straight wall before it is pulled', () => {
    load([
      room('big', box(0, 0, 8, 6), [{ edgeIndex: 2, bulge: 0.3 }]),
      room('above', [v(0, -3), v(8, -3), v(8, 0), v(0, 0)], [{ edgeIndex: 3, bulge: 0.1 }]),
    ]);
    const before = arcsOfRoom(roomById('big'));
    const beforeAbove = arcsOfRoom(roomById('above'));
    const edge = bendAt(
      prop(),
      { kind: 'wall', hit: { kind: 'edge', roomId: 'big', edgeIndex: 0 } },
      v(4, 0),
    )!;
    expect(bendRefusal(prop(), edge)).toBeNull();
    expect(commitBend(edge, v(4, -1))).toBe(true);
    const big = roomById('big');
    expect(big.polygon.length).toBeGreaterThan(4);
    expectSamePlace(arcsOfRoom(big)[0], before[0]);
    // The room on the other side of the pulled wall took the same new corners.
    expect(roomById('above').polygon.length).toBe(big.polygon.length);
    expectSamePlace(arcsOfRoom(roomById('above'))[0], beforeAbove[0]);
  });

  it('refuses a wall that is already a true curve, with a plain line', () => {
    load([room('big', box(0, 0, 8, 6), [{ edgeIndex: 0, bulge: 0.3 }])]);
    const before = structuredClone(prop());
    const edge = bendAt(
      prop(),
      { kind: 'wall', hit: { kind: 'edge', roomId: 'big', edgeIndex: 0 } },
      v(4, 0),
    )!;
    expect(bendRefusal(prop(), edge)).toMatch(/already curved/);
    expect(commitBend(edge, v(4, -1))).toBe(false);
    expect(prop()).toEqual(before);
  });

  it('refuses a wall whose other room holds it as a curve', () => {
    load([
      room('big', box(0, 0, 8, 6)),
      room('above', [v(0, -3), v(8, -3), v(8, 0), v(0, 0)], [{ edgeIndex: 2, bulge: 0.2 }]),
    ]);
    const before = structuredClone(prop());
    const edge = bendAt(
      prop(),
      { kind: 'wall', hit: { kind: 'edge', roomId: 'big', edgeIndex: 0 } },
      v(4, 0),
    )!;
    expect(bendRefusal(prop(), edge)).toMatch(/already curved/);
    expect(commitBend(edge, v(4, -1))).toBe(false);
    expect(prop()).toEqual(before);
  });

  it('refuses a free wall that is already a true curve', () => {
    load([room('big', box(0, 0, 8, 6))], [wall('curved', v(1, 1), v(7, 1), 0.25)]);
    const before = structuredClone(prop());
    const edge = bendAt(
      prop(),
      { kind: 'wall', hit: { kind: 'free', wallId: 'curved' } },
      v(4, 1),
    )!;
    expect(bendRefusal(prop(), edge)).toMatch(/already curved/);
    expect(commitBend(edge, v(4, 2))).toBe(false);
    expect(prop()).toEqual(before);
  });
});

describe('a roof slab that takes the outline of the room under it', () => {
  const levels = [
    { id: 'ground', name: 'Ground floor', index: 0 },
    { id: ROOF_LEVEL_ID, name: 'Roof', index: 1, kind: 'roof' as const },
  ];
  const slab = (polygon: Room['polygon']): Room => ({
    ...room(roofRoomIdFor('big'), polygon, [{ edgeIndex: 2, bulge: 0.3 }]),
    name: 'big',
    kind: 'roof',
    levelId: ROOF_LEVEL_ID,
  });
  const house = (rooms: Room[]): Property => ({
    id: 'p',
    name: 'House',
    activeRoomId: 'big',
    rooms,
    levels,
  });

  it('keeps its own curves while its outline stays as it is', () => {
    const start = house([room('big', box(0, 0, 8, 6)), slab(box(0, 0, 8, 6))]);
    expect(syncRoofRooms(start)).toBe(start);
  });

  it('loses curves that named the edges of an outline it no longer has', () => {
    // The room under it has five corners now; the slab's curve was on edge 2 of four.
    const five = [v(0, 0), v(4, 0), v(8, 0), v(8, 6), v(0, 6)];
    const next = syncRoofRooms(house([room('big', five), slab(box(0, 0, 8, 6))]));
    const roof = next.rooms.find((r) => r.kind === 'roof')!;
    expect(roof.polygon).toEqual(five);
    expect(roof.wallArcs).toBeUndefined();
  });
});
