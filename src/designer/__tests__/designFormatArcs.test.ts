/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  normaliseLoadedProperty,
  usePropertyStore,
  type Property,
} from '../../store/propertyStore';
import { arcGeometry, type WallArc, type XY } from '../arcSegment';
import { canonicaliseRoomGeometry, signedPolygonAreaM2 } from '../openings';
import { designFileText, readDesignFile } from '../designFile';

type Loose = Record<string, unknown>;
const P = (x: number, y: number): XY => ({ x, y });
const open = (value: unknown) => normaliseLoadedProperty(value as Property) as unknown as Loose;
const near = (got: XY, want: XY) => {
  expect(got.x).toBeCloseTo(want.x, 9);
  expect(got.y).toBeCloseTo(want.y, 9);
};

/** The middle point of every curved edge of a room, by the wall it is on: where the arc is in the world. */
function arcMiddles(room: Loose): XY[] {
  const polygon = room.polygon as XY[];
  return ((room.wallArcs as WallArc[] | undefined) ?? [])
    .map(
      (arc) =>
        arcGeometry(
          polygon[arc.edgeIndex],
          polygon[(arc.edgeIndex + 1) % polygon.length],
          arc.bulge,
        )!.middle,
    )
    .sort((p, q) => p.x - q.x || p.y - q.y);
}

// One square, its corners in the two possible orders. Which of the two the app keeps is its own rule; the tests
// below ask the app which, so they hold whichever it is.
const ONE_WAY = [P(0, 0), P(6, 0), P(6, 4), P(0, 4)];
const OTHER_WAY = [P(0, 0), P(0, 4), P(6, 4), P(6, 0)];
const KEPT = canonicaliseRoomGeometry(ONE_WAY).changed ? OTHER_WAY : ONE_WAY;
const TURNED = KEPT === ONE_WAY ? OTHER_WAY : ONE_WAY;

const design = (rooms: unknown[], more: Loose = {}) => ({
  id: 'arcs',
  name: 'House with curved walls',
  activeRoomId: 'r1',
  rooms,
  ...more,
});

describe('a curved wall in a design (format version 2)', () => {
  it('the test stands on a sound footing: one order is kept as it is, the other is turned round', () => {
    expect(canonicaliseRoomGeometry(KEPT).changed).toBe(false);
    expect(canonicaliseRoomGeometry(KEPT).reversed).toBe(false);
    expect(canonicaliseRoomGeometry(TURNED).changed).toBe(true);
    expect(canonicaliseRoomGeometry(TURNED).reversed).toBe(true);
    expect(Math.sign(signedPolygonAreaM2(KEPT))).toBe(-Math.sign(signedPolygonAreaM2(TURNED)));
  });

  it("a room's curved edges are kept, checked one by one", () => {
    const opened = open(
      design([
        {
          id: 'r1',
          name: 'Room',
          polygon: KEPT,
          placedItems: [],
          wallArcs: [
            { edgeIndex: 0, bulge: 0.3 },
            { edgeIndex: 2, bulge: -0.5 },
            { edgeIndex: 2, bulge: 0.9 },
            { edgeIndex: 7, bulge: 0.2 },
            { edgeIndex: 1, bulge: 0 },
            { edgeIndex: 3, bulge: 1e9 },
          ],
        },
      ]),
    );
    expect((opened.rooms as Loose[])[0].wallArcs).toEqual([
      { edgeIndex: 0, bulge: 0.3 },
      { edgeIndex: 2, bulge: -0.5 },
    ]);
  });

  it('a room without curved edges has no such key, as before', () => {
    const plain = open(design([{ id: 'r1', name: 'Room', polygon: KEPT, placedItems: [] }]));
    expect('wallArcs' in (plain.rooms as Loose[])[0]).toBe(false);
    const none = open(
      design([{ id: 'r1', name: 'Room', polygon: KEPT, placedItems: [], wallArcs: 'x' }]),
    );
    expect('wallArcs' in (none.rooms as Loose[])[0]).toBe(false);
  });

  it('an outline that is turned round on open keeps each arc on its wall, bowing to the same side', () => {
    const stored = {
      id: 'r1',
      name: 'Room',
      polygon: TURNED,
      placedItems: [],
      wallArcs: [
        { edgeIndex: 1, bulge: 0.4 },
        { edgeIndex: 3, bulge: -0.25 },
      ],
    };
    const before = arcMiddles(stored);
    const room = (open(design([stored])).rooms as Loose[])[0];
    expect(room.polygon).not.toEqual(TURNED);
    const after = arcMiddles(room);
    expect(after).toHaveLength(2);
    after.forEach((middle, i) => near(middle, before[i]));
    // The sign of each bulge changed, because its edge now runs the other way.
    expect((room.wallArcs as WallArc[]).map((a) => Math.sign(a.bulge)).sort()).toEqual([-1, 1]);
    expect((room.wallArcs as WallArc[]).map((a) => Math.abs(a.bulge)).sort()).toEqual([0.25, 0.4]);
  });

  it('a double corner in the outline: the arcs follow their edges, the arc of the edge that is gone goes', () => {
    const doubled = [KEPT[0], KEPT[1], KEPT[1], KEPT[2], KEPT[3]];
    const stored = {
      id: 'r1',
      name: 'Room',
      polygon: doubled,
      placedItems: [],
      wallArcs: [
        { edgeIndex: 0, bulge: 0.3 },
        { edgeIndex: 1, bulge: 0.8 }, // the edge between the two same corners
        { edgeIndex: 4, bulge: -0.2 },
      ],
    };
    const room = (open(design([stored])).rooms as Loose[])[0];
    expect(room.polygon).toEqual(KEPT);
    expect(room.wallArcs).toEqual([
      { edgeIndex: 0, bulge: 0.3 },
      { edgeIndex: 3, bulge: -0.2 },
    ]);
  });

  it('a free wall keeps its bulge; a bulge out of range leaves the wall straight and keeps the wall', () => {
    const opened = open(
      design([{ id: 'r1', name: 'Room', polygon: KEPT, placedItems: [] }], {
        walls: [
          { id: 'w1', a: P(1, 1), b: P(4, 1), thicknessM: 0.1, bulge: 0.5 },
          { id: 'w2', a: P(1, 2), b: P(4, 2), thicknessM: 0.1, bulge: 999 },
          { id: 'w3', a: P(1, 3), b: P(4, 3), thicknessM: 0.1, bulge: 'round' },
          { id: 'w4', a: P(1, 3.5), b: P(4, 3.5), thicknessM: 0.1 },
        ],
      }),
    );
    const walls = opened.walls as Loose[];
    expect(walls.map((w) => w.id)).toEqual(['w1', 'w2', 'w3', 'w4']);
    expect(walls[0].bulge).toBe(0.5);
    for (const wall of walls.slice(1)) expect('bulge' in wall).toBe(false);
  });

  it('opening again changes nothing more, and a file gives the same back', () => {
    const once = open(
      design(
        [
          {
            id: 'r1',
            name: 'Room',
            polygon: TURNED,
            placedItems: [],
            wallArcs: [{ edgeIndex: 1, bulge: 0.4 }],
          },
        ],
        { walls: [{ id: 'w1', a: P(1, 1), b: P(4, 1), thicknessM: 0.1, bulge: -0.5 }] },
      ),
    );
    expect(open(once)).toEqual(once);
    expect(open(readDesignFile(JSON.parse(designFileText(once)))!.property)).toEqual(once);
  });
});

describe('a curved wall when this app changes or reloads the room', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('a reload from the browser storage turns the outline round and keeps the arc on its wall', async () => {
    const stored = {
      id: 'r1',
      name: 'Room',
      polygon: TURNED,
      placedItems: [],
      wallArcs: [{ edgeIndex: 1, bulge: 0.4 }],
    };
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({
        state: { property: design([stored]), showGrid: true, pxPerMetre: 100 },
        version: 2,
      }),
    );
    await usePropertyStore.persist.rehydrate();
    const room = usePropertyStore.getState().property.rooms[0] as unknown as Loose;
    expect(room.polygon).toEqual(KEPT);
    near(arcMiddles(room)[0], arcMiddles(stored)[0]);
    expect((room.wallArcs as WallArc[])[0].bulge).toBe(-0.4);
  });

  it('a new outline given to the room: its arcs follow, by the same rule as its paint', () => {
    usePropertyStore.getState().loadProperty(
      design([
        {
          id: 'r1',
          name: 'Room',
          polygon: KEPT,
          placedItems: [],
          wallArcs: [
            { edgeIndex: 0, bulge: 0.3 },
            { edgeIndex: 3, bulge: -0.2 },
          ],
        },
      ]) as unknown as Property,
    );
    // The same room, one corner pulled out: four edges still, each arc stays on its edge.
    const pulled = [KEPT[0], KEPT[1], P(KEPT[2].x + 1, KEPT[2].y + 1), KEPT[3]];
    usePropertyStore.getState().setRoomPolygon('r1', pulled);
    let room = usePropertyStore.getState().property.rooms[0] as unknown as Loose;
    expect(room.wallArcs).toEqual([
      { edgeIndex: 0, bulge: 0.3 },
      { edgeIndex: 3, bulge: -0.2 },
    ]);
    // A triangle now: the outline has no edge 3 any more, and that arc goes with it.
    usePropertyStore.getState().setRoomPolygon('r1', [KEPT[0], KEPT[1], KEPT[2]]);
    room = usePropertyStore.getState().property.rooms[0] as unknown as Loose;
    const kept = (room.wallArcs as WallArc[] | undefined) ?? [];
    expect(kept.every((arc) => arc.edgeIndex < 3)).toBe(true);
    expect(kept.some((arc) => Math.abs(arc.bulge) === 0.3)).toBe(true);
    expect(kept.some((arc) => Math.abs(arc.bulge) === 0.2)).toBe(false);
  });
});
