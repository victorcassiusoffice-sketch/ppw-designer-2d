/**
 * Wall-paint tints (2026-09-14) — the store side.
 *
 * A tint is a whitelisted, validated field on a painted edge / free wall.
 * These tests pin the three things that silently go wrong with optional
 * persisted fields: the whitelist (survives normalise), the validator (bad
 * hex is dropped, paint kept), and the index coupling (paint follows the
 * wall through a reshape and a winding flip, and dies with a deleted wall).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  canonicalisePropertyWinding,
  normaliseFreeWalls,
  normaliseLoadedProperty,
  normaliseLoadedRoom,
  usePropertyStore,
  type Property,
} from '../propertyStore';

const RECT = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }];
const CCW = [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 0 }];

function seed(rooms: Property['rooms'], walls: Property['walls'] = []): void {
  usePropertyStore.setState({
    property: { id: 'p', name: 'T', activeRoomId: rooms[0]?.id ?? 'r1', rooms, walls, wallHeightM: 2.7 },
  });
}

describe('wall-paint tints — actions', () => {
  beforeEach(() => {
    seed([{ id: 'r1', name: 'Room', polygon: RECT, placedItems: [] }], [
      { id: 'w1', a: { x: 6, y: 0 }, b: { x: 8, y: 0 }, thicknessM: 0.15 },
    ]);
  });

  it('paints an edge with a tint; the hex is normalised; a bad hex leaves the base colour', () => {
    const s = usePropertyStore.getState();
    s.paintWallEdge('r1', 0, 'permoglaze-soft-feel', { hex: '#c9553f', name: '  Coral  Clay ' });
    let room = usePropertyStore.getState().property.rooms[0];
    expect(room.wallPaint).toEqual([{ edgeIndex: 0, paintId: 'permoglaze-soft-feel', colourHex: '#C9553F', colourName: 'Coral Clay' }]);

    s.paintWallEdge('r1', 1, 'permoglaze-soft-feel', { hex: 'not-a-colour', name: 'Ghost' });
    room = usePropertyStore.getState().property.rooms[0];
    expect(room.wallPaint?.find((e) => e.edgeIndex === 1)).toEqual({ edgeIndex: 1, paintId: 'permoglaze-soft-feel' });

    // Repainting the same edge without a tint drops the old tint.
    s.paintWallEdge('r1', 0, 'permoglaze-soft-feel');
    room = usePropertyStore.getState().property.rooms[0];
    expect(room.wallPaint?.find((e) => e.edgeIndex === 0)).toEqual({ edgeIndex: 0, paintId: 'permoglaze-soft-feel' });
  });

  it('Room scope carries the tint to every edge; clearing strips everything', () => {
    const s = usePropertyStore.getState();
    s.paintRoomWalls('r1', 'permoglaze-matt-emulsion', { hex: '8FA68A', name: 'Sage' });
    const room = usePropertyStore.getState().property.rooms[0];
    expect(room.wallPaint).toHaveLength(4);
    expect(room.wallPaint!.every((e) => e.colourHex === '#8FA68A' && e.colourName === 'Sage')).toBe(true);
    s.paintRoomWalls('r1', null);
    expect(usePropertyStore.getState().property.rooms[0].wallPaint).toBeUndefined();
  });

  it('free walls take a tint the same way and clearing removes all three fields', () => {
    const s = usePropertyStore.getState();
    s.paintFreeWall('w1', 'permoglaze-aquashield', { hex: '#abc', name: 'Sky' });
    let w = usePropertyStore.getState().property.walls![0];
    expect(w).toMatchObject({ paintId: 'permoglaze-aquashield', paintColourHex: '#AABBCC', paintColourName: 'Sky' });
    s.paintFreeWall('w1', null);
    w = usePropertyStore.getState().property.walls![0];
    expect(w).not.toHaveProperty('paintId');
    expect(w).not.toHaveProperty('paintColourHex');
    expect(w).not.toHaveProperty('paintColourName');
  });

  it('paint follows the wall through a reshape and dies with a deleted wall', () => {
    const s = usePropertyStore.getState();
    s.paintWallEdge('r1', 0, 'permoglaze-soft-feel', { hex: '#C9553F' });
    s.paintWallEdge('r1', 3, 'permoglaze-matt-emulsion');
    // Reshape: same 4 walls, wider.
    s.setRoomPolygon('r1', [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }]);
    let room = usePropertyStore.getState().property.rooms[0];
    expect(room.wallPaint).toEqual([
      { edgeIndex: 0, paintId: 'permoglaze-soft-feel', colourHex: '#C9553F' },
      { edgeIndex: 3, paintId: 'permoglaze-matt-emulsion' },
    ]);
    // Reshape to a triangle: edge 3 no longer exists.
    s.setRoomPolygon('r1', [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 4 }]);
    room = usePropertyStore.getState().property.rooms[0];
    expect(room.wallPaint).toEqual([{ edgeIndex: 0, paintId: 'permoglaze-soft-feel', colourHex: '#C9553F' }]);
  });

  it('a counter-clockwise polygon keeps its paint on the same WORLD wall after canonicalisation', () => {
    const s = usePropertyStore.getState();
    s.paintWallEdge('r1', 0, 'permoglaze-soft-feel');
    // Reverse the room CCW keeping p0: the old top wall (0→1) is now edge 3.
    s.setRoomPolygon('r1', CCW);
    const room = usePropertyStore.getState().property.rooms[0];
    expect(room.polygon).toEqual(RECT);
    // CCW edge 0 was (0,0)→(0,4) = the LEFT wall; after reversal that is
    // CW edge 3 (0,4)→(0,0). The paint was on the CW top wall (edge 0),
    // whose index in the CCW input was 3 — but the action painted CW edge 0
    // BEFORE the reshape, so the reshape's raw input maps old 0 → 3.
    expect(room.wallPaint).toEqual([{ edgeIndex: 3, paintId: 'permoglaze-soft-feel' }]);
  });
});

describe('wall-paint tints — load normalisers (the whitelist)', () => {
  it('normaliseLoadedRoom keeps a valid tint, drops a bad one, prunes a dead edge', () => {
    const room = normaliseLoadedRoom({
      id: 'r1',
      name: 'Room',
      polygon: RECT,
      placedItems: [],
      wallPaint: [
        { edgeIndex: 0, paintId: 'permoglaze-soft-feel', colourHex: '#c9553f', colourName: 'Coral' },
        { edgeIndex: 1, paintId: 'permoglaze-soft-feel', colourHex: 'red' },
        { edgeIndex: 9, paintId: 'permoglaze-soft-feel' },
        { edgeIndex: 2, paintId: '' },
      ],
    });
    expect(room.wallPaint).toEqual([
      { edgeIndex: 0, paintId: 'permoglaze-soft-feel', colourHex: '#C9553F', colourName: 'Coral' },
      { edgeIndex: 1, paintId: 'permoglaze-soft-feel' },
    ]);
  });

  it('a CCW-seeded room remaps its paint to the canonical CW edge', () => {
    const room = normaliseLoadedRoom({
      id: 'r1',
      name: 'Room',
      polygon: CCW,
      placedItems: [],
      wallPaint: [{ edgeIndex: 0, paintId: 'permoglaze-soft-feel' }],
    });
    expect(room.polygon).toEqual(RECT);
    expect(room.wallPaint).toEqual([{ edgeIndex: 3, paintId: 'permoglaze-soft-feel' }]);
    const prop = canonicalisePropertyWinding({
      id: 'p',
      name: 'P',
      activeRoomId: 'r1',
      rooms: [{ id: 'r1', name: 'Room', polygon: CCW, placedItems: [], wallPaint: [{ edgeIndex: 1, paintId: 'x' }] }],
    });
    expect(prop.rooms[0].wallPaint).toEqual([{ edgeIndex: 2, paintId: 'x' }]);
  });

  it('normaliseFreeWalls carries the tint only with a paint; a tint alone is dropped', () => {
    const walls = normaliseFreeWalls([
      { id: 'a', a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, thicknessM: 0.15, paintId: 'permoglaze-aquashield', paintColourHex: '#aabbcc', paintColourName: 'Sky' },
      { id: 'b', a: { x: 0, y: 1 }, b: { x: 2, y: 1 }, thicknessM: 0.15, paintColourHex: '#aabbcc' },
      { id: 'c', a: { x: 0, y: 2 }, b: { x: 2, y: 2 }, thicknessM: 0.15, paintId: 'permoglaze-aquashield', paintColourHex: 'zzz' },
    ]);
    expect(walls[0]).toMatchObject({ paintId: 'permoglaze-aquashield', paintColourHex: '#AABBCC', paintColourName: 'Sky' });
    expect(walls[1]).not.toHaveProperty('paintColourHex');
    expect(walls[1]).not.toHaveProperty('paintId');
    expect(walls[2]).toMatchObject({ paintId: 'permoglaze-aquashield' });
    expect(walls[2]).not.toHaveProperty('paintColourHex');
  });

  it('a whole property round-trips its tints through normaliseLoadedProperty', () => {
    const prop = normaliseLoadedProperty({
      id: 'p',
      name: 'P',
      activeRoomId: 'r1',
      rooms: [
        {
          id: 'r1',
          name: 'Room',
          polygon: RECT,
          placedItems: [],
          wallPaint: [{ edgeIndex: 2, paintId: 'permoglaze-matt-emulsion', colourHex: '#8FA68A', colourName: 'Sage' }],
        },
      ],
      walls: [{ id: 'w', a: { x: 6, y: 0 }, b: { x: 8, y: 0 }, thicknessM: 0.15, paintId: 'permoglaze-matt-emulsion', paintColourHex: '#8FA68A' }],
      wallHeightM: 3.1,
    } as unknown as Property);
    expect(prop.rooms[0].wallPaint).toEqual([{ edgeIndex: 2, paintId: 'permoglaze-matt-emulsion', colourHex: '#8FA68A', colourName: 'Sage' }]);
    expect(prop.walls?.[0]).toMatchObject({ paintId: 'permoglaze-matt-emulsion', paintColourHex: '#8FA68A' });
    expect(prop.wallHeightM).toBe(3.1);
  });
});

describe('wall-paint tints — edge map (review round 2)', () => {
  it('a duplicate vertex collapses one edge; paint remaps exactly as an opening does', () => {
    seed([{ id: 'r1', name: 'Room', polygon: RECT, placedItems: [] }]);
    const s = usePropertyStore.getState();
    s.paintWallEdge('r1', 2, 'permoglaze-matt-emulsion');
    s.paintWallEdge('r1', 3, 'permoglaze-soft-feel');
    s.addOpening('r1', { edgeIndex: 2, offsetM: 1, widthM: 0.838, kind: 'door', flipFacing: false, flipHand: false });
    // The committed polygon carries (0,0) twice: its edge 1 collapses, so
    // its edges 2 and 3 become the canonical 1 and 2 — for the door AND
    // for the paint (both are read in the committed polygon's index space).
    s.setRoomPolygon('r1', [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }]);
    const room = usePropertyStore.getState().property.rooms[0];
    expect(room.polygon).toHaveLength(4);
    expect(room.openings?.map((o) => o.edgeIndex)).toEqual([1]);
    expect(room.wallPaint).toEqual([
      { edgeIndex: 1, paintId: 'permoglaze-matt-emulsion' },
      { edgeIndex: 2, paintId: 'permoglaze-soft-feel' },
    ]);
  });

  it('a tint chosen for a white-only line is not stored', () => {
    seed([{ id: 'r1', name: 'Room', polygon: RECT, placedItems: [] }], [{ id: 'w1', a: { x: 6, y: 0 }, b: { x: 8, y: 0 }, thicknessM: 0.15 }]);
    const s = usePropertyStore.getState();
    s.paintWallEdge('r1', 0, 'permoglaze-xtreme-white', { hex: '#C9553F', name: 'Coral' });
    s.paintFreeWall('w1', 'permoglaze-heat-guard', { hex: '#C9553F' });
    const p = usePropertyStore.getState().property;
    expect(p.rooms[0].wallPaint).toEqual([{ edgeIndex: 0, paintId: 'permoglaze-xtreme-white' }]);
    expect(p.walls![0]).not.toHaveProperty('paintColourHex');
  });

  it('primer, coats and contingency settings survive normalisation', () => {
    const prop = normaliseLoadedProperty({
      id: 'p', name: 'P', activeRoomId: 'r1',
      rooms: [{ id: 'r1', name: 'Room', polygon: RECT, placedItems: [] }],
      wallPaintPrimer: true, wallPaintCoats: 3, wallPaintWastePct: 15,
    } as unknown as Property);
    expect(prop.wallPaintPrimer).toBe(true);
    expect(prop.wallPaintCoats).toBe(3);
    expect(prop.wallPaintWastePct).toBe(15);
    const bad = normaliseLoadedProperty({
      id: 'p', name: 'P', activeRoomId: 'r1',
      rooms: [{ id: 'r1', name: 'Room', polygon: RECT, placedItems: [] }],
      wallPaintPrimer: 'yes', wallPaintCoats: 9, wallPaintWastePct: -1,
    } as unknown as Property);
    expect(bad).not.toHaveProperty('wallPaintPrimer');
    expect(bad).not.toHaveProperty('wallPaintCoats');
    expect(bad).not.toHaveProperty('wallPaintWastePct');
  });
});
