/**
 * propertyStore — Week 2.5 unit tests.
 *
 * Covers:
 *   - default property has a single rectangle room
 *   - addRoom / addRectangleRoom appends and switches active
 *   - removeRoom switches active to the next room, refuses last-room delete
 *   - renameRoom and renameProperty
 *   - setRoomPolygon mutates the active room shape
 *   - addItem / removeItem / updateItem only touch the active room
 *   - loadProperty migrates a legacy rectangle room shape to a polygon
 *   - normaliseLoadedRoom auto-fills polygon from {lengthM,widthM}
 *   - every re-seed path opens BLANK (Vic 2026-08-25, complaint 1)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  usePropertyStore,
  normaliseLoadedProperty,
  normaliseLoadedRoom,
  normaliseSite,
  itemLightOn,
  SITE_MAX_M,
  SITE_MIN_M,
} from '../propertyStore';
import { rectToPolygon, polygonArea } from '../../lib/geometry';
import { activeLevelIdOf, isOutdoorRoom, levelsOf, roomLevelId } from '../../designer/levels';
import { runToFreeWalls } from '../../designer/freeWalls';

beforeEach(() => {
  usePropertyStore.getState().resetToDefault();
});

describe('propertyStore — defaults', () => {
  // Blank-canvas-on-open (2026-06-09, Vic): a fresh start / resetToDefault
  // opens onto ONE empty room (no polygon) so the customer draws their own
  // room first, Sims-style. The room still exists (the model never allows
  // zero rooms) — it just has no walls yet.
  it('starts with one empty (un-drawn) room', () => {
    const { property } = usePropertyStore.getState();
    expect(property.rooms).toHaveLength(1);
    expect(property.rooms[0].polygon).toHaveLength(0);
    expect(property.rooms[0].placedItems).toHaveLength(0);
    expect(property.activeRoomId).toBe(property.rooms[0].id);
  });
});

describe('addRoom / addRectangleRoom', () => {
  it('appends a rectangle room and switches active', () => {
    const id = usePropertyStore.getState().addRectangleRoom('Studio', { lengthM: 6, widthM: 3 });
    const { property } = usePropertyStore.getState();
    expect(property.rooms).toHaveLength(2);
    expect(property.activeRoomId).toBe(id);
    const newRoom = property.rooms.find((r) => r.id === id);
    expect(newRoom?.name).toBe('Studio');
    expect(polygonArea(newRoom!.polygon)).toBeCloseTo(18, 6);
  });

  it('addRoom with a custom polygon uses it directly', () => {
    const id = usePropertyStore.getState().addRoom({
      name: 'Triangle',
      polygon: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 2, y: 3 },
      ],
    });
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === id);
    expect(room?.polygon).toHaveLength(3);
    expect(polygonArea(room!.polygon)).toBeCloseTo(6, 6);
  });
});

describe('setActiveRoom', () => {
  it('switches the active room id', () => {
    const newId = usePropertyStore.getState().addRectangleRoom('B', { lengthM: 4, widthM: 4 });
    const { property: before } = usePropertyStore.getState();
    const firstId = before.rooms[0].id;
    usePropertyStore.getState().setActiveRoom(firstId);
    expect(usePropertyStore.getState().property.activeRoomId).toBe(firstId);
    usePropertyStore.getState().setActiveRoom(newId);
    expect(usePropertyStore.getState().property.activeRoomId).toBe(newId);
  });

  it('ignores unknown room ids', () => {
    const before = usePropertyStore.getState().property.activeRoomId;
    usePropertyStore.getState().setActiveRoom('does-not-exist');
    expect(usePropertyStore.getState().property.activeRoomId).toBe(before);
  });
});

describe('removeRoom', () => {
  it('removes the room and refocuses to the first remaining', () => {
    const idB = usePropertyStore.getState().addRectangleRoom('B', { lengthM: 4, widthM: 4 });
    const { property: before } = usePropertyStore.getState();
    const idA = before.rooms[0].id;
    usePropertyStore.getState().removeRoom(idA);
    const after = usePropertyStore.getState().property;
    expect(after.rooms).toHaveLength(1);
    expect(after.activeRoomId).toBe(idB);
  });

  // Blank start (Vic 2026-08-25, complaint 1): deleting the last room must
  // re-seed a BLANK room, not the old 5×4 m rectangle. A rectangle here put
  // a room on the canvas that the customer never drew.
  it('re-seeds a BLANK room when the last room is deleted (never goes to zero)', () => {
    const { property } = usePropertyStore.getState();
    expect(property.rooms).toHaveLength(1);
    usePropertyStore.getState().removeRoom(property.rooms[0].id);
    const after = usePropertyStore.getState().property;
    expect(after.rooms).toHaveLength(1);
    expect(after.rooms[0].polygon).toHaveLength(0);
    expect(after.rooms[0].placedItems).toEqual([]);
  });
});

describe('renameRoom & renameProperty', () => {
  it('renames a room', () => {
    const { property } = usePropertyStore.getState();
    usePropertyStore.getState().renameRoom(property.rooms[0].id, 'Cold Plunge');
    expect(usePropertyStore.getState().property.rooms[0].name).toBe('Cold Plunge');
  });

  it('renames the property', () => {
    usePropertyStore.getState().renameProperty('Tamarin Villa');
    expect(usePropertyStore.getState().property.name).toBe('Tamarin Villa');
  });

  it('falls back to default if rename receives only whitespace', () => {
    usePropertyStore.getState().renameProperty('   ');
    expect(usePropertyStore.getState().property.name).toBe('Untitled Property');
  });
});

describe('setRoomPolygon', () => {
  it('mutates the polygon of a specific room', () => {
    const { property } = usePropertyStore.getState();
    usePropertyStore.getState().setRoomPolygon(property.rooms[0].id, [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    expect(
      polygonArea(usePropertyStore.getState().property.rooms[0].polygon),
    ).toBeCloseTo(100, 6);
  });
});

describe('addItem / removeItem / updateItem', () => {
  it('only touches the active room', () => {
    const idB = usePropertyStore.getState().addRectangleRoom('B', { lengthM: 4, widthM: 4 });
    // active is now idB; add an item there.
    const itemId = usePropertyStore.getState().addItem({
      productId: 'plunge-aurora-tub',
      x: 1,
      y: 1,
      rotation: 0,
    });
    const a = usePropertyStore.getState().property.rooms.find((r) => r.id !== idB);
    const b = usePropertyStore.getState().property.rooms.find((r) => r.id === idB);
    expect(a?.placedItems).toHaveLength(0);
    expect(b?.placedItems).toHaveLength(1);
    expect(b?.placedItems[0].instanceId).toBe(itemId);

    usePropertyStore.getState().updateItem(itemId, { x: 2, y: 2 });
    expect(usePropertyStore.getState().property.rooms.find((r) => r.id === idB)!.placedItems[0].x).toBe(2);

    usePropertyStore.getState().removeItem(itemId);
    expect(usePropertyStore.getState().property.rooms.find((r) => r.id === idB)!.placedItems).toHaveLength(0);
  });
});

describe('surface slots — parent/child behaviour (2026-08-24)', () => {
  function activeItems() {
    const s = usePropertyStore.getState();
    return s.property.rooms.find((r) => r.id === s.property.activeRoomId)!.placedItems;
  }

  it('moving a table carries the items sitting on it', () => {
    const ps = usePropertyStore.getState();
    const tableId = ps.addItem({ productId: 'demo-console-table', x: 1, y: 2, rotation: 0 });
    const childId = usePropertyStore.getState().addItem({
      productId: 'demo-aroma-diffuser',
      x: 1.2,
      y: 2.1,
      rotation: 0,
      parentInstanceId: tableId,
    });
    usePropertyStore.getState().updateItem(tableId, { x: 2, y: 3 });
    const child = activeItems().find((i) => i.instanceId === childId)!;
    expect(child.x).toBeCloseTo(2.2); // shifted by the parent's delta (+1, +1)
    expect(child.y).toBeCloseTo(3.1);
  });

  it('non-positional parent updates leave children untouched', () => {
    const ps = usePropertyStore.getState();
    const tableId = ps.addItem({ productId: 'demo-console-table', x: 1, y: 2, rotation: 0 });
    const childId = usePropertyStore.getState().addItem({
      productId: 'demo-aroma-diffuser',
      x: 1.2,
      y: 2.1,
      rotation: 0,
      parentInstanceId: tableId,
    });
    usePropertyStore.getState().updateItem(tableId, { rotation: 90 });
    const child = activeItems().find((i) => i.instanceId === childId)!;
    expect(child.x).toBeCloseTo(1.2);
    expect(child.y).toBeCloseTo(2.1);
  });

  it('removing a table removes what sits on it', () => {
    const ps = usePropertyStore.getState();
    const tableId = ps.addItem({ productId: 'demo-console-table', x: 1, y: 2, rotation: 0 });
    usePropertyStore.getState().addItem({
      productId: 'demo-aroma-diffuser',
      x: 1.2,
      y: 2.1,
      rotation: 0,
      parentInstanceId: tableId,
    });
    const before = activeItems().length;
    usePropertyStore.getState().removeItem(tableId);
    expect(activeItems().length).toBe(before - 2);
  });
});

describe('loadProperty + normaliseLoadedRoom — rectangle→polygon migration on load', () => {
  it('upgrades a legacy room with only {lengthM,widthM} to a 4-vertex polygon', () => {
    const migrated = normaliseLoadedRoom({
      id: 'legacy-1',
      name: 'Legacy',
      lengthM: 7,
      widthM: 5,
      placedItems: [],
    });
    expect(migrated.polygon).toEqual(rectToPolygon({ lengthM: 7, widthM: 5 }));
    expect(polygonArea(migrated.polygon)).toBeCloseTo(35, 6);
  });

  it('preserves an existing polygon if present', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 0, y: 4 },
    ];
    const migrated = normaliseLoadedRoom({
      id: 'p-1',
      name: 'Tri',
      polygon: triangle,
      placedItems: [],
    });
    expect(migrated.polygon).toEqual(triangle);
  });

  it('normaliseLoadedProperty re-seeds a BLANK room when rooms list is empty', () => {
    const p = normaliseLoadedProperty({ id: 'x', name: 'Empty', rooms: [] });
    expect(p.rooms).toHaveLength(1);
    expect(p.rooms[0].polygon).toHaveLength(0);
  });

  // A persisted blank room round-tripping through Load must STAY blank.
  it('normaliseLoadedRoom keeps a blank room blank (no phantom 5×4 rectangle)', () => {
    const r = normaliseLoadedRoom({ id: 'b', name: 'Blank', polygon: [], placedItems: [] });
    expect(r.polygon).toHaveLength(0);
  });

  it('normaliseLoadedRoom still migrates a genuine legacy rectangle payload', () => {
    const r = normaliseLoadedRoom({ id: 'l', name: 'Legacy', lengthM: 6, widthM: 3 });
    expect(r.polygon).toHaveLength(4);
    expect(polygonArea(r.polygon)).toBeCloseTo(18, 6);
  });

  it('loadProperty replaces the active store property', () => {
    usePropertyStore.getState().loadProperty({
      id: 'imported',
      name: 'Imported',
      activeRoomId: 'r1',
      rooms: [
        {
          id: 'r1',
          name: 'Main',
          polygon: rectToPolygon({ lengthM: 8, widthM: 6 }),
          placedItems: [],
        },
      ],
    });
    const after = usePropertyStore.getState().property;
    expect(after.name).toBe('Imported');
    expect(after.activeRoomId).toBe('r1');
    expect(polygonArea(after.rooms[0].polygon)).toBeCloseTo(48, 6);
  });

  it('persist round-trip: re-serialising and re-loading preserves room data', () => {
    const id = usePropertyStore.getState().addRectangleRoom('B', { lengthM: 4, widthM: 4 });
    usePropertyStore.getState().addItem({ productId: 'plunge-aurora-tub', x: 1, y: 1, rotation: 0 });
    const snapshot = JSON.parse(JSON.stringify(usePropertyStore.getState().property));
    usePropertyStore.getState().resetToDefault();
    usePropertyStore.getState().loadProperty(snapshot);
    const after = usePropertyStore.getState().property;
    const reloadedB = after.rooms.find((r) => r.id === id);
    expect(reloadedB?.placedItems).toHaveLength(1);
    expect(reloadedB?.placedItems[0].productId).toBe('plunge-aurora-tub');
  });
});

// ---------------------------------------------------------------------------
// Attached multi-room (2026-08-26) — D4 routing, D8 migration, anchors.
// ---------------------------------------------------------------------------

describe('propertyStore — attached multi-room routing', () => {
  const R1 = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }];
  const R2 = [{ x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 4 }, { x: 5, y: 4 }];

  /** Two attached rooms, room A active. Returns their ids. */
  function twoRooms(): { a: string; b: string } {
    const ps = usePropertyStore.getState();
    const a = ps.property.activeRoomId;
    ps.setRoomPolygon(a, R1);
    const b = ps.addRoom({ name: 'Room B', polygon: R2 });
    usePropertyStore.getState().setActiveRoom(a);
    return { a, b };
  }

  it('addItem with no roomId still targets the ACTIVE room (back-compat)', () => {
    const { a, b } = twoRooms();
    usePropertyStore.getState().addItem({ productId: 'p1', x: 1, y: 1, rotation: 0 });
    const p = usePropertyStore.getState().property;
    expect(p.rooms.find((r) => r.id === a)?.placedItems).toHaveLength(1);
    expect(p.rooms.find((r) => r.id === b)?.placedItems).toHaveLength(0);
  });

  it('addItem with an explicit roomId routes into THAT room, active untouched', () => {
    const { a, b } = twoRooms();
    usePropertyStore.getState().addItem({ productId: 'p1', x: 6, y: 1, rotation: 0 }, b);
    const p = usePropertyStore.getState().property;
    expect(p.rooms.find((r) => r.id === a)?.placedItems).toHaveLength(0);
    expect(p.rooms.find((r) => r.id === b)?.placedItems).toHaveLength(1);
    // addItem itself does NOT move focus — selectItemAcrossRooms does.
    expect(p.activeRoomId).toBe(a);
  });

  it('addItem with an unknown roomId is a no-op', () => {
    twoRooms();
    const before = JSON.stringify(usePropertyStore.getState().property);
    usePropertyStore.getState().addItem({ productId: 'p1', x: 1, y: 1, rotation: 0 }, 'nope');
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
  });

  it('removeItem reaches an item in a NON-active room', () => {
    const { a, b } = twoRooms();
    const id = usePropertyStore.getState().addItem({ productId: 'p1', x: 6, y: 1, rotation: 0 }, b);
    usePropertyStore.getState().setActiveRoom(a);
    usePropertyStore.getState().removeItem(id);
    const p = usePropertyStore.getState().property;
    expect(p.rooms.find((r) => r.id === b)?.placedItems).toHaveLength(0);
  });

  it('updateItem reaches an item in a NON-active room', () => {
    const { a, b } = twoRooms();
    const id = usePropertyStore.getState().addItem({ productId: 'p1', x: 6, y: 1, rotation: 0 }, b);
    usePropertyStore.getState().setActiveRoom(a);
    usePropertyStore.getState().updateItem(id, { rotation: 90 });
    const p = usePropertyStore.getState().property;
    expect(p.rooms.find((r) => r.id === b)?.placedItems[0].rotation).toBe(90);
  });

  it('selectItemAcrossRooms selects AND moves focus in one atomic set', () => {
    const { a, b } = twoRooms();
    const id = usePropertyStore.getState().addItem({ productId: 'p1', x: 6, y: 1, rotation: 0 }, b);
    usePropertyStore.getState().setActiveRoom(a);
    expect(usePropertyStore.getState().selectedInstanceId).toBeNull();
    usePropertyStore.getState().selectItemAcrossRooms(id);
    const s = usePropertyStore.getState();
    // Both landed — a split setActiveRoom + selectItem would have nulled
    // the selection on the way through.
    expect(s.property.activeRoomId).toBe(b);
    expect(s.selectedInstanceId).toBe(id);
  });

  it('selectItemAcrossRooms(null) deselects WITHOUT changing the active room', () => {
    const { a, b } = twoRooms();
    const id = usePropertyStore.getState().addItem({ productId: 'p1', x: 6, y: 1, rotation: 0 }, b);
    usePropertyStore.getState().selectItemAcrossRooms(id);
    expect(usePropertyStore.getState().property.activeRoomId).toBe(b);
    usePropertyStore.getState().selectItemAcrossRooms(null);
    const s = usePropertyStore.getState();
    expect(s.selectedInstanceId).toBeNull();
    expect(s.property.activeRoomId).toBe(b);
    expect(a).not.toBe(b);
  });

  it('selectItemAcrossRooms on an item in the ACTIVE room leaves focus alone', () => {
    const { a } = twoRooms();
    const id = usePropertyStore.getState().addItem({ productId: 'p1', x: 1, y: 1, rotation: 0 }, a);
    usePropertyStore.getState().selectItemAcrossRooms(id);
    const s = usePropertyStore.getState();
    expect(s.property.activeRoomId).toBe(a);
    expect(s.selectedInstanceId).toBe(id);
  });
});

describe('propertyStore — addRectangleRoom anchor', () => {
  it('with no anchor the rectangle is pinned at the origin (unchanged)', () => {
    const id = usePropertyStore.getState().addRectangleRoom('R', { lengthM: 5, widthM: 4 });
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === id);
    expect(room?.polygon).toEqual(rectToPolygon({ lengthM: 5, widthM: 4 }));
  });

  it('with an anchor the whole rectangle is translated into place', () => {
    const id = usePropertyStore
      .getState()
      .addRectangleRoom('R', { lengthM: 4, widthM: 3 }, { x: 5, y: 0 });
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === id);
    expect(room?.polygon).toEqual([
      { x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 3 }, { x: 5, y: 3 },
    ]);
  });
});

describe('propertyStore — unstackIfLegacy (D8)', () => {
  it('re-lays a 3-rooms-at-origin legacy save and reports true', () => {
    const ps = usePropertyStore.getState();
    ps.setRoomPolygon(ps.property.activeRoomId, rectToPolygon({ lengthM: 5, widthM: 4 }));
    usePropertyStore
      .getState()
      .addRoom({ name: 'B', polygon: rectToPolygon({ lengthM: 4, widthM: 3 }) });
    usePropertyStore
      .getState()
      .addRoom({ name: 'C', polygon: rectToPolygon({ lengthM: 3, widthM: 3 }) });

    expect(usePropertyStore.getState().unstackIfLegacy()).toBe(true);
    const rooms = usePropertyStore.getState().property.rooms;
    expect(rooms[0].polygon[0]).toEqual({ x: 0, y: 0 });
    expect(rooms[1].polygon[0]).toEqual({ x: 5, y: 0 });
    expect(rooms[2].polygon[0]).toEqual({ x: 9, y: 0 });
  });

  it('carries placed items along with their room', () => {
    const ps = usePropertyStore.getState();
    ps.setRoomPolygon(ps.property.activeRoomId, rectToPolygon({ lengthM: 5, widthM: 4 }));
    const b = usePropertyStore
      .getState()
      .addRoom({ name: 'B', polygon: rectToPolygon({ lengthM: 4, widthM: 3 }) });
    usePropertyStore.getState().addItem({ productId: 'p', x: 1, y: 1, rotation: 0 }, b);

    usePropertyStore.getState().unstackIfLegacy();
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === b);
    expect(room?.placedItems[0]).toMatchObject({ x: 6, y: 1 });
  });

  it('is false (and a no-op) on an already-attached property — idempotent', () => {
    const ps = usePropertyStore.getState();
    ps.setRoomPolygon(ps.property.activeRoomId, rectToPolygon({ lengthM: 5, widthM: 4 }));
    usePropertyStore
      .getState()
      .addRoom({ name: 'B', polygon: rectToPolygon({ lengthM: 4, widthM: 3 }) });
    expect(usePropertyStore.getState().unstackIfLegacy()).toBe(true);
    const after = JSON.stringify(usePropertyStore.getState().property);
    expect(usePropertyStore.getState().unstackIfLegacy()).toBe(false);
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(after);
  });

  it('is false on a single-room property', () => {
    const ps = usePropertyStore.getState();
    ps.setRoomPolygon(ps.property.activeRoomId, rectToPolygon({ lengthM: 5, widthM: 4 }));
    expect(usePropertyStore.getState().unstackIfLegacy()).toBe(false);
  });
});

describe('moveItemToRoom — pick a placed item up and put it in another room', () => {
  function twoRooms() {
    const ps = usePropertyStore.getState();
    ps.setRoomPolygon(ps.property.activeRoomId, rectToPolygon({ lengthM: 5, widthM: 4 }));
    usePropertyStore.getState().addRoom({ name: 'B', polygon: rectToPolygon({ lengthM: 4, widthM: 4 }) });
    const rooms = usePropertyStore.getState().property.rooms;
    return { a: rooms[0].id, b: rooms[1].id };
  }

  it('moves the item and keeps its instanceId byte-identical', () => {
    const { a, b } = twoRooms();
    const id = usePropertyStore.getState().addItem({ productId: 'p1', x: 1, y: 1, rotation: 0 }, a);

    usePropertyStore.getState().moveItemToRoom(id, b, 2, 2, 90);

    const rooms = usePropertyStore.getState().property.rooms;
    const roomA = rooms.find((r) => r.id === a)!;
    const roomB = rooms.find((r) => r.id === b)!;
    expect(roomA.placedItems).toHaveLength(0);
    expect(roomB.placedItems).toHaveLength(1);
    // THE assertion. A remove-then-add composition cannot satisfy this:
    // addItem mints a fresh id, which would silently orphan the selection,
    // any history reference and the cart line item pointing at the old one.
    expect(roomB.placedItems[0].instanceId).toBe(id);
    expect(roomB.placedItems[0]).toMatchObject({ x: 2, y: 2, rotation: 90 });
  });

  it('moves focus and selection with the item', () => {
    const { a, b } = twoRooms();
    const id = usePropertyStore.getState().addItem({ productId: 'p1', x: 1, y: 1, rotation: 0 }, a);
    usePropertyStore.getState().setActiveRoom(a);

    usePropertyStore.getState().moveItemToRoom(id, b, 2, 2);

    // Without this the Sims loop (place, rotate, delete) is dead the moment
    // an item crosses a wall - every manipulation surface resolves through
    // the ACTIVE room.
    expect(usePropertyStore.getState().property.activeRoomId).toBe(b);
    expect(usePropertyStore.getState().selectedInstanceId).toBe(id);
  });

  it('keeps the existing rotation when none is given', () => {
    const { a, b } = twoRooms();
    const id = usePropertyStore.getState().addItem({ productId: 'p1', x: 1, y: 1, rotation: 270 }, a);
    usePropertyStore.getState().moveItemToRoom(id, b, 2, 2);
    const roomB = usePropertyStore.getState().property.rooms.find((r) => r.id === b)!;
    expect(roomB.placedItems[0].rotation).toBe(270);
  });

  it('is a no-op for a same-room move, an unknown item or an unknown room', () => {
    const { a, b } = twoRooms();
    const id = usePropertyStore.getState().addItem({ productId: 'p1', x: 1, y: 1, rotation: 0 }, a);
    const before = JSON.stringify(usePropertyStore.getState().property);

    usePropertyStore.getState().moveItemToRoom(id, a, 3, 3);
    usePropertyStore.getState().moveItemToRoom('nope', b, 3, 3);
    usePropertyStore.getState().moveItemToRoom(id, 'nope', 3, 3);

    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
  });
});

describe('floor painting - per-tile floors', () => {
  function room5x4() {
    const ps = usePropertyStore.getState();
    ps.setRoomPolygon(ps.property.activeRoomId, rectToPolygon({ lengthM: 5, widthM: 4 }));
    return usePropertyStore.getState().property.activeRoomId;
  }
  const ZONE = {
    materialId: 'outdoor-1m',
    tileWm: 1,
    tileHm: 1,
    originM: { x: 0, y: 0 },
    runs: [] as number[],
  };
  const tileCount = (runs: number[]): number => {
    let n = 0;
    for (let i = 2; i < runs.length; i += 3) n += runs[i];
    return n;
  };

  it('paints tiles and stores them run-length encoded', () => {
    const id = room5x4();
    usePropertyStore.getState().paintFloorTiles(id, ZONE, ['0,0', '0,1', '0,2']);
    const r = usePropertyStore.getState().property.rooms.find((x) => x.id === id)!;
    expect(r.floorTiles).toHaveLength(1);
    // three contiguous tiles compress to ONE run of three numbers
    expect(r.floorTiles![0].runs).toEqual([0, 0, 3]);
  });

  it('takes a whole stroke in one call, so it is one undo frame', () => {
    const id = room5x4();
    const keys = ['0,0', '0,1', '0,2', '0,3', '0,4'];
    // Committing per tile would make Ctrl+Z walk backwards one tile at a time.
    usePropertyStore.getState().paintFloorTiles(id, ZONE, keys);
    const r = usePropertyStore.getState().property.rooms.find((x) => x.id === id)!;
    expect(r.floorTiles![0].runs).toEqual([0, 0, 5]);
  });

  it('a tile carries only one material - repainting moves it between zones', () => {
    const id = room5x4();
    usePropertyStore.getState().paintFloorTiles(id, ZONE, ['0,0', '0,1']);
    const other = { ...ZONE, materialId: 'eva-combat' };
    usePropertyStore.getState().paintFloorTiles(id, other, ['0,1']);
    const r = usePropertyStore.getState().property.rooms.find((x) => x.id === id)!;
    const outdoor = r.floorTiles!.find((z) => z.materialId === 'outdoor-1m')!;
    const eva = r.floorTiles!.find((z) => z.materialId === 'eva-combat')!;
    expect(outdoor.runs).toEqual([0, 0, 1]);
    expect(eva.runs).toEqual([0, 1, 1]);
  });

  it('erase removes tiles and drops an emptied zone', () => {
    const id = room5x4();
    usePropertyStore.getState().paintFloorTiles(id, ZONE, ['0,0', '0,1']);
    usePropertyStore.getState().paintFloorTiles(id, ZONE, ['0,0', '0,1'], true);
    const r = usePropertyStore.getState().property.rooms.find((x) => x.id === id)!;
    expect(r.floorTiles).toBeUndefined();
  });

  it('the first stroke on a whole-room floor keeps that floor underneath', () => {
    const id = room5x4();
    usePropertyStore.getState().setRoomFloor(id, 'outdoor-1m');
    const eva = { ...ZONE, materialId: 'eva-combat' };
    usePropertyStore.getState().paintFloorTiles(id, eva, ['0,0']);
    const r = usePropertyStore.getState().property.rooms.find((x) => x.id === id)!;
    // The existing floor is seeded as tiles (20 for a 5x4 room at 1 m) minus
    // the one just repainted, so the user paints ON TOP of the floor they
    // had rather than watching it disappear.
    const outdoor = r.floorTiles!.find((z) => z.materialId === 'outdoor-1m')!;
    const evaZone = r.floorTiles!.find((z) => z.materialId === 'eva-combat')!;
    expect(tileCount(outdoor.runs)).toBe(19);
    expect(evaZone.runs).toEqual([0, 0, 1]);
    // and the whole-room finish is cleared so it cannot shadow the tiles
    expect(r.floorFinish).toBeNull();
  });

  it('reshaping the room prunes tiles that fall outside it', () => {
    const id = room5x4();
    usePropertyStore.getState().paintFloorTiles(id, ZONE, ['0,0', '0,1', '0,2', '0,3', '0,4']);
    usePropertyStore.getState().setRoomPolygon(id, rectToPolygon({ lengthM: 3, widthM: 4 }));
    const r = usePropertyStore.getState().property.rooms.find((x) => x.id === id)!;
    // Without the cascade those two tiles persist invisibly AND stay priced.
    expect(tileCount(r.floorTiles![0].runs)).toBe(3);
  });
});

describe('floor tool - one floor per room (fillRoomFloor / setRoomFloor / clearRoomFloor)', () => {
  function room5x4() {
    const ps = usePropertyStore.getState();
    ps.setRoomPolygon(ps.property.activeRoomId, rectToPolygon({ lengthM: 5, widthM: 4 }));
    return usePropertyStore.getState().property.activeRoomId;
  }
  const ZONE = {
    materialId: 'outdoor-1m',
    tileWm: 1,
    tileHm: 1,
    originM: { x: 0, y: 0 },
    runs: [] as number[],
  };
  const tileCount = (runs: number[]): number => {
    let n = 0;
    for (let i = 2; i < runs.length; i += 3) n += runs[i];
    return n;
  };
  const room = (id: string) =>
    usePropertyStore.getState().property.rooms.find((x) => x.id === id)!;

  it('fillRoomFloor lays a tileable material as ONE full-cover zone and returns the count', () => {
    const id = room5x4();
    // 1 m tiles divide the 5 x 4 m room exactly: 20 tiles, no cut edge.
    const n = usePropertyStore.getState().fillRoomFloor(id, 'outdoor-1m');
    expect(n).toBe(20);
    const r = room(id);
    expect(r.floorTiles).toHaveLength(1);
    expect(r.floorTiles![0].materialId).toBe('outdoor-1m');
    expect(tileCount(r.floorTiles![0].runs)).toBe(20);
    // One floor per room: the whole-room finish cannot shadow the tiles.
    expect(r.floorFinish).toBeNull();
  });

  it('fillRoomFloor with a roll sets the whole-room finish and lays no tiles', () => {
    const id = room5x4();
    const n = usePropertyStore.getState().fillRoomFloor(id, 'epdm-roll');
    expect(n).toBe(0);
    const r = room(id);
    expect(r.floorFinish).toEqual({ materialId: 'epdm-roll' });
    // A fictional tile lattice on sheet goods would put fake units on the
    // customer's quote.
    expect(r.floorTiles).toBeUndefined();
  });

  it('fillRoomFloor replaces a previously painted patch with the full cover', () => {
    const id = room5x4();
    usePropertyStore.getState().paintFloorTiles(id, ZONE, ['0,0', '0,1']);
    const n = usePropertyStore.getState().fillRoomFloor(id, 'outdoor-1m');
    expect(n).toBe(20);
    expect(tileCount(room(id).floorTiles![0].runs)).toBe(20);
  });

  it('fillRoomFloor is a no-op returning 0 for an undrawn room or unknown material', () => {
    const ps = usePropertyStore.getState();
    // The default seed room has no polygon yet.
    expect(ps.fillRoomFloor(ps.property.activeRoomId, 'outdoor-1m')).toBe(0);
    const id = room5x4();
    expect(usePropertyStore.getState().fillRoomFloor(id, 'no-such-material')).toBe(0);
    expect(room(id).floorTiles).toBeUndefined();
  });

  it('setRoomFloor is authoritative - it drops any painted tiles', () => {
    const id = room5x4();
    usePropertyStore.getState().paintFloorTiles(id, ZONE, ['0,0', '0,1']);
    usePropertyStore.getState().setRoomFloor(id, 'epdm-roll');
    const r = room(id);
    // Tiles used to survive UNDER the finish, drawn over it and priced in
    // ADDITION to it - two floors on one quote.
    expect(r.floorTiles).toBeUndefined();
    expect(r.floorFinish).toEqual({ materialId: 'epdm-roll' });
  });

  it('clearRoomFloor clears tiles and finish alike', () => {
    const id = room5x4();
    usePropertyStore.getState().fillRoomFloor(id, 'outdoor-1m');
    usePropertyStore.getState().clearRoomFloor(id);
    let r = room(id);
    expect(r.floorTiles).toBeUndefined();
    expect(r.floorFinish).toBeNull();

    usePropertyStore.getState().fillRoomFloor(id, 'epdm-roll');
    usePropertyStore.getState().clearRoomFloor(id);
    r = room(id);
    expect(r.floorTiles).toBeUndefined();
    expect(r.floorFinish).toBeNull();
  });
});

describe('floor painting - backwards compatibility', () => {
  it('a design saved with only a whole-room floor still loads unchanged', () => {
    const loaded = normaliseLoadedRoom({
      id: 'r1',
      name: 'Old Room',
      polygon: rectToPolygon({ lengthM: 5, widthM: 4 }),
      placedItems: [],
      floorFinish: { materialId: 'outdoor-1m' },
    });
    expect(loaded.floorFinish).toEqual({ materialId: 'outdoor-1m' });
    expect(loaded.floorTiles).toBeUndefined();
  });

  it('painted tiles survive a save/load round trip', () => {
    const loaded = normaliseLoadedRoom({
      id: 'r1',
      name: 'R',
      polygon: rectToPolygon({ lengthM: 5, widthM: 4 }),
      placedItems: [],
      floorTiles: [
        {
          materialId: 'outdoor-1m',
          tileWm: 1,
          tileHm: 1,
          originM: { x: 0, y: 0 },
          runs: [0, 0, 3],
        },
      ],
    });
    expect(loaded.floorTiles).toHaveLength(1);
    expect(loaded.floorTiles![0].runs).toEqual([0, 0, 3]);
  });

  it('a malformed zone is dropped before it reaches the renderer or the price', () => {
    const loaded = normaliseLoadedRoom({
      id: 'r1',
      name: 'R',
      polygon: rectToPolygon({ lengthM: 5, widthM: 4 }),
      placedItems: [],
      floorTiles: [
        { materialId: 'x', tileWm: 1, tileHm: 1, originM: { x: 0, y: 0 }, runs: [0, 0] },
        { materialId: 'y', tileWm: 0, tileHm: 1, originM: { x: 0, y: 0 }, runs: [0, 0, 1] },
      ] as never,
    });
    expect(loaded.floorTiles).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Sims world (2026-08-29) — levels, outdoor rooms, free walls, site, lights.
// ---------------------------------------------------------------------------

const RECT = rectToPolygon({ lengthM: 5, widthM: 4 });

describe('levels — a single-storey property is unchanged', () => {
  it('a fresh property has no levels field and reads as ground', () => {
    const p = usePropertyStore.getState().property;
    expect(p.levels).toBeUndefined();
    expect(p.activeLevelId).toBeUndefined();
    expect(activeLevelIdOf(p)).toBe('ground');
    expect(levelsOf(p).map((l) => l.id)).toEqual(['ground']);
  });

  it('addRoom / addRectangleRoom on the ground floor do NOT stamp a levelId (canonical form)', () => {
    const a = usePropertyStore.getState().addRoom({ name: 'A' });
    const b = usePropertyStore.getState().addRectangleRoom('B', { lengthM: 3, widthM: 3 });
    const rooms = usePropertyStore.getState().property.rooms;
    expect(rooms.find((r) => r.id === a)?.levelId).toBeUndefined();
    expect(rooms.find((r) => r.id === b)?.levelId).toBeUndefined();
    expect(roomLevelId(rooms.find((r) => r.id === a)!)).toBe('ground');
  });
});

describe('addLevel', () => {
  it('adds a storey at max+1, makes it active, and seeds a blank active room on it', () => {
    const before = usePropertyStore.getState().property;
    const groundRoomId = before.activeRoomId;

    const id = usePropertyStore.getState().addLevel();
    const p = usePropertyStore.getState().property;

    expect(p.levels?.map((l) => l.id)).toEqual(['ground', id]);
    expect(p.levels?.map((l) => l.name)).toEqual(['Ground floor', 'First floor']);
    expect(p.levels?.map((l) => l.index)).toEqual([0, 1]);
    expect(p.activeLevelId).toBe(id);
    expect(activeLevelIdOf(p)).toBe(id);

    const active = p.rooms.find((r) => r.id === p.activeRoomId)!;
    expect(active.id).not.toBe(groundRoomId);
    expect(active.levelId).toBe(id);
    expect(active.polygon).toEqual([]);
    expect(active.placedItems).toEqual([]);
    expect(p.rooms).toHaveLength(2);
  });

  it('takes an explicit name and keeps adding ordinals otherwise', () => {
    const one = usePropertyStore.getState().addLevel('Mezzanine');
    const two = usePropertyStore.getState().addLevel();
    const levels = usePropertyStore.getState().property.levels!;
    expect(levels.find((l) => l.id === one)?.name).toBe('Mezzanine');
    expect(levels.find((l) => l.id === two)?.name).toBe('Second floor');
    expect(levels.find((l) => l.id === two)?.index).toBe(2);
  });

  it('addRoom on a new level stamps that level', () => {
    const lvl = usePropertyStore.getState().addLevel();
    const a = usePropertyStore.getState().addRoom({ name: 'Upstairs' });
    const b = usePropertyStore.getState().addRectangleRoom('Loft', { lengthM: 3, widthM: 3 });
    const rooms = usePropertyStore.getState().property.rooms;
    expect(rooms.find((r) => r.id === a)?.levelId).toBe(lvl);
    expect(rooms.find((r) => r.id === b)?.levelId).toBe(lvl);
  });
});

describe('renameLevel', () => {
  it('renames, trims, ignores blank and unknown', () => {
    const lvl = usePropertyStore.getState().addLevel();
    usePropertyStore.getState().renameLevel(lvl, '  Bedrooms  ');
    expect(usePropertyStore.getState().property.levels!.find((l) => l.id === lvl)?.name).toBe('Bedrooms');
    usePropertyStore.getState().renameLevel(lvl, '   ');
    expect(usePropertyStore.getState().property.levels!.find((l) => l.id === lvl)?.name).toBe('Bedrooms');
    const before = JSON.stringify(usePropertyStore.getState().property);
    usePropertyStore.getState().renameLevel('nope', 'X');
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
  });

  it('renaming ground on a single-storey property materialises the levels list', () => {
    usePropertyStore.getState().renameLevel('ground', 'Street level');
    const p = usePropertyStore.getState().property;
    expect(p.levels).toEqual([{ id: 'ground', name: 'Street level', index: 0 }]);
  });
});

describe('setActiveLevel', () => {
  it('focuses the first real room on that level', () => {
    const groundRoom = usePropertyStore.getState().property.activeRoomId;
    const lvl = usePropertyStore.getState().addLevel();
    const upRoom = usePropertyStore.getState().property.activeRoomId;

    usePropertyStore.getState().setActiveLevel('ground');
    let p = usePropertyStore.getState().property;
    expect(activeLevelIdOf(p)).toBe('ground');
    expect(p.activeRoomId).toBe(groundRoom);

    usePropertyStore.getState().setActiveLevel(lvl);
    p = usePropertyStore.getState().property;
    expect(p.activeLevelId).toBe(lvl);
    expect(p.activeRoomId).toBe(upRoom);
  });

  it('creates a blank room when the level has only an outdoor container', () => {
    const lvl = usePropertyStore.getState().addLevel();
    const seeded = usePropertyStore.getState().property.activeRoomId;
    usePropertyStore.getState().setActiveLevel('ground');
    usePropertyStore.getState().removeRoom(seeded);
    // removeRoom re-seeds on the ACTIVE level (ground), so the new level is
    // now empty apart from whatever outdoor container we give it.
    usePropertyStore.getState().ensureOutdoorRoom(lvl);
    const realUp = usePropertyStore
      .getState()
      .property.rooms.filter((r) => roomLevelId(r) === lvl && !isOutdoorRoom(r));
    expect(realUp).toHaveLength(0);

    usePropertyStore.getState().setActiveLevel(lvl);
    const p = usePropertyStore.getState().property;
    const active = p.rooms.find((r) => r.id === p.activeRoomId)!;
    expect(roomLevelId(active)).toBe(lvl);
    expect(isOutdoorRoom(active)).toBe(false);
    expect(active.polygon).toEqual([]);
  });

  it('ignores an unknown level and clears the selection on a real switch', () => {
    const itemId = usePropertyStore.getState().addItem({ productId: 'p', x: 1, y: 1, rotation: 0 });
    expect(usePropertyStore.getState().selectedInstanceId).toBe(itemId);
    const before = JSON.stringify(usePropertyStore.getState().property);
    usePropertyStore.getState().setActiveLevel('nope');
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
    expect(usePropertyStore.getState().selectedInstanceId).toBe(itemId);

    const lvl = usePropertyStore.getState().addLevel();
    usePropertyStore.getState().setActiveLevel('ground');
    usePropertyStore.getState().selectItem(itemId);
    usePropertyStore.getState().setActiveLevel(lvl);
    expect(usePropertyStore.getState().selectedInstanceId).toBeNull();
  });
});

describe('removeLevel guards', () => {
  it('refuses the ground floor', () => {
    usePropertyStore.getState().addLevel();
    const before = JSON.stringify(usePropertyStore.getState().property);
    expect(usePropertyStore.getState().removeLevel('ground')).toBe(false);
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
  });

  it('refuses an unknown level', () => {
    expect(usePropertyStore.getState().removeLevel('nope')).toBe(false);
  });

  it('refuses a level that still has a DRAWN room', () => {
    const lvl = usePropertyStore.getState().addLevel();
    const room = usePropertyStore.getState().property.activeRoomId;
    usePropertyStore.getState().setRoomPolygon(room, RECT);
    expect(usePropertyStore.getState().removeLevel(lvl)).toBe(false);
    expect(usePropertyStore.getState().property.levels).toHaveLength(2);
  });

  it('refuses a level that still has a placed item (even outdoors)', () => {
    const lvl = usePropertyStore.getState().addLevel();
    const outdoors = usePropertyStore.getState().ensureOutdoorRoom(lvl);
    usePropertyStore.getState().addItem({ productId: 'tree', x: 1, y: 1, rotation: 0 }, outdoors);
    expect(usePropertyStore.getState().removeLevel(lvl)).toBe(false);
  });

  it('refuses a level that still has a free wall', () => {
    const lvl = usePropertyStore.getState().addLevel();
    usePropertyStore.getState().addFreeWalls(runToFreeWalls([{ x: 0, y: 0 }, { x: 2, y: 0 }], lvl));
    expect(usePropertyStore.getState().removeLevel(lvl)).toBe(false);
  });

  it('removes an empty level with its blank rooms + outdoor container and refocuses ground', () => {
    const groundRoom = usePropertyStore.getState().property.activeRoomId;
    const lvl = usePropertyStore.getState().addLevel();
    usePropertyStore.getState().ensureOutdoorRoom(lvl);
    // A wall on GROUND must survive the removal of the other level.
    usePropertyStore.getState().setActiveLevel('ground');
    usePropertyStore.getState().addFreeWalls(runToFreeWalls([{ x: 0, y: 0 }, { x: 2, y: 0 }], 'ground'));
    usePropertyStore.getState().setActiveLevel(lvl);

    expect(usePropertyStore.getState().removeLevel(lvl)).toBe(true);
    const p = usePropertyStore.getState().property;
    expect(p.levels?.map((l) => l.id)).toEqual(['ground']);
    expect(p.activeLevelId).toBe('ground');
    expect(p.activeRoomId).toBe(groundRoom);
    expect(p.rooms.every((r) => roomLevelId(r) === 'ground')).toBe(true);
    expect(p.walls).toHaveLength(1);
  });

  it('keeps the walls field absent when there were none', () => {
    const lvl = usePropertyStore.getState().addLevel();
    expect(usePropertyStore.getState().removeLevel(lvl)).toBe(true);
    expect(usePropertyStore.getState().property.walls).toBeUndefined();
  });
});

describe('focus follows the room onto its level', () => {
  it('setActiveRoom on a room upstairs switches the active level', () => {
    const lvl = usePropertyStore.getState().addLevel();
    const upRoom = usePropertyStore.getState().property.activeRoomId;
    usePropertyStore.getState().setActiveLevel('ground');
    usePropertyStore.getState().setActiveRoom(upRoom);
    expect(usePropertyStore.getState().property.activeLevelId).toBe(lvl);
  });

  it('selectItemAcrossRooms follows an item upstairs', () => {
    const lvl = usePropertyStore.getState().addLevel();
    const upRoom = usePropertyStore.getState().property.activeRoomId;
    const id = usePropertyStore.getState().addItem({ productId: 'p', x: 1, y: 1, rotation: 0 }, upRoom);
    usePropertyStore.getState().setActiveLevel('ground');
    usePropertyStore.getState().selectItemAcrossRooms(id);
    expect(usePropertyStore.getState().property.activeLevelId).toBe(lvl);
    expect(usePropertyStore.getState().selectedInstanceId).toBe(id);
  });

  it('on a single-storey property setActiveRoom leaves the JSON shape untouched (no activeLevelId)', () => {
    const b = usePropertyStore.getState().addRectangleRoom('B', { lengthM: 3, widthM: 3 });
    usePropertyStore.getState().setActiveRoom(b);
    expect(usePropertyStore.getState().property.activeLevelId).toBeUndefined();
  });
});

describe('removeRoom — per-level re-seed', () => {
  it('re-seeds a blank room when only the outdoor container remains', () => {
    const roomId = usePropertyStore.getState().property.activeRoomId;
    const outdoors = usePropertyStore.getState().ensureOutdoorRoom();
    usePropertyStore.getState().removeRoom(roomId);
    const p = usePropertyStore.getState().property;
    expect(p.rooms).toHaveLength(2);
    expect(p.rooms.some((r) => r.id === outdoors)).toBe(true);
    const active = p.rooms.find((r) => r.id === p.activeRoomId)!;
    expect(isOutdoorRoom(active)).toBe(false);
    expect(active.polygon).toEqual([]);
  });

  it('removing the last real room on the ACTIVE storey re-seeds there, not on ground', () => {
    const lvl = usePropertyStore.getState().addLevel();
    const upRoom = usePropertyStore.getState().property.activeRoomId;
    usePropertyStore.getState().removeRoom(upRoom);
    const p = usePropertyStore.getState().property;
    const active = p.rooms.find((r) => r.id === p.activeRoomId)!;
    expect(roomLevelId(active)).toBe(lvl);
    expect(active.id).not.toBe(upRoom);
  });

  it('is a no-op for an unknown room id', () => {
    const before = JSON.stringify(usePropertyStore.getState().property);
    usePropertyStore.getState().removeRoom('nope');
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
  });
});

describe('ensureOutdoorRoom', () => {
  it('creates one outdoor room per level and is idempotent', () => {
    const a = usePropertyStore.getState().ensureOutdoorRoom();
    const b = usePropertyStore.getState().ensureOutdoorRoom();
    expect(a).toBe(b);
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === a)!;
    expect(room).toMatchObject({ name: 'Outdoors', polygon: [], placedItems: [], kind: 'outdoor' });
    expect(room.levelId).toBeUndefined(); // ground = absent

    const lvl = usePropertyStore.getState().addLevel();
    const up = usePropertyStore.getState().ensureOutdoorRoom(lvl);
    expect(up).not.toBe(a);
    expect(usePropertyStore.getState().ensureOutdoorRoom(lvl)).toBe(up);
    expect(usePropertyStore.getState().property.rooms.find((r) => r.id === up)?.levelId).toBe(lvl);
    // defaulting to the active level (now `lvl`) resolves to the same container
    expect(usePropertyStore.getState().ensureOutdoorRoom()).toBe(up);
  });

  it('does not move focus', () => {
    const active = usePropertyStore.getState().property.activeRoomId;
    usePropertyStore.getState().ensureOutdoorRoom();
    expect(usePropertyStore.getState().property.activeRoomId).toBe(active);
  });

  it('accepts items dropped outside every room', () => {
    const outdoors = usePropertyStore.getState().ensureOutdoorRoom();
    const id = usePropertyStore
      .getState()
      .addItem({ productId: 'garden-tree', x: 12, y: -3, rotation: 0 }, outdoors);
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === outdoors)!;
    expect(room.placedItems[0].instanceId).toBe(id);
  });
});

describe('setSite', () => {
  it('stores a valid plot and clears it with null', () => {
    usePropertyStore.getState().setSite({ widthM: 20, depthM: 30, originM: { x: -2, y: -1 } });
    expect(usePropertyStore.getState().property.site).toEqual({
      widthM: 20, depthM: 30, originM: { x: -2, y: -1 },
    });
    usePropertyStore.getState().setSite(null);
    expect(usePropertyStore.getState().property.site).toBeUndefined();
    expect('site' in usePropertyStore.getState().property).toBe(false);
  });

  it('clamps sides to 1..500 m', () => {
    usePropertyStore.getState().setSite({ widthM: 0.2, depthM: 9999, originM: { x: 0, y: 0 } });
    expect(usePropertyStore.getState().property.site).toMatchObject({
      widthM: SITE_MIN_M, depthM: SITE_MAX_M,
    });
  });

  it('ignores non-finite or non-positive sides', () => {
    usePropertyStore.getState().setSite({ widthM: 10, depthM: 10, originM: { x: 0, y: 0 } });
    const before = JSON.stringify(usePropertyStore.getState().property);
    usePropertyStore.getState().setSite({ widthM: NaN, depthM: 10, originM: { x: 0, y: 0 } });
    usePropertyStore.getState().setSite({ widthM: 10, depthM: -5, originM: { x: 0, y: 0 } });
    usePropertyStore.getState().setSite({ widthM: Infinity, depthM: 10, originM: { x: 0, y: 0 } });
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
  });

  it('a broken origin falls back to the world origin', () => {
    expect(normaliseSite({ widthM: 5, depthM: 5, originM: { x: NaN, y: 0 } })).toEqual({
      widthM: 5, depthM: 5, originM: { x: 0, y: 0 },
    });
    expect(normaliseSite({ widthM: 5, depthM: 5 })).toEqual({
      widthM: 5, depthM: 5, originM: { x: 0, y: 0 },
    });
    expect(normaliseSite(null)).toBeUndefined();
    expect(normaliseSite({ widthM: '5', depthM: 5 })).toBeUndefined();
  });
});

describe('free walls', () => {
  it('addFreeWalls mints ids, stamps the active level when absent, and drops degenerate walls', () => {
    const ids = usePropertyStore.getState().addFreeWalls([
      { a: { x: 0, y: 0 }, b: { x: 3, y: 0 }, thicknessM: 0.1 },
      { a: { x: 1, y: 1 }, b: { x: 1, y: 1 }, thicknessM: 0.1 }, // zero length
      { a: { x: 0, y: 0 }, b: { x: 0, y: 2 }, thicknessM: 0 }, // no thickness
      { a: { x: 5, y: 5 }, b: { x: 6, y: 5 }, thicknessM: 0.1, levelId: 'attic' },
    ]);
    expect(ids).toHaveLength(2);
    const walls = usePropertyStore.getState().property.walls!;
    expect(walls.map((w) => w.id)).toEqual(ids);
    expect(walls[0].levelId).toBe('ground');
    expect(walls[1].levelId).toBe('attic');
  });

  it('addFreeWalls with nothing usable leaves the property untouched', () => {
    const before = JSON.stringify(usePropertyStore.getState().property);
    expect(usePropertyStore.getState().addFreeWalls([])).toEqual([]);
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
    expect(usePropertyStore.getState().property.walls).toBeUndefined();
  });

  it('removeFreeWall removes by id and ignores unknown ids', () => {
    const [a, b] = usePropertyStore.getState().addFreeWalls(
      runToFreeWalls([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], 'ground'),
    );
    usePropertyStore.getState().removeFreeWall(a);
    expect(usePropertyStore.getState().property.walls!.map((w) => w.id)).toEqual([b]);
    const before = JSON.stringify(usePropertyStore.getState().property);
    usePropertyStore.getState().removeFreeWall('nope');
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
  });

  it('clearFreeWalls clears one level or all', () => {
    const lvl = usePropertyStore.getState().addLevel();
    usePropertyStore.getState().addFreeWalls(runToFreeWalls([{ x: 0, y: 0 }, { x: 1, y: 0 }], 'ground'));
    usePropertyStore.getState().addFreeWalls(runToFreeWalls([{ x: 0, y: 0 }, { x: 1, y: 0 }], lvl));
    expect(usePropertyStore.getState().property.walls).toHaveLength(2);

    usePropertyStore.getState().clearFreeWalls(lvl);
    expect(usePropertyStore.getState().property.walls!.map((w) => w.levelId)).toEqual(['ground']);

    usePropertyStore.getState().clearFreeWalls('no-such-level');
    expect(usePropertyStore.getState().property.walls).toHaveLength(1);

    usePropertyStore.getState().clearFreeWalls();
    expect(usePropertyStore.getState().property.walls).toEqual([]);
  });
});

describe('importLegacyWalls', () => {
  const SEG = [
    { start: { x_mm: 0, y_mm: 0 }, end: { x_mm: 2500, y_mm: 0 }, thickness_mm: 100 },
    { start: { x_mm: 2500, y_mm: 0 }, end: { x_mm: 2500, y_mm: 1500 }, thickness_mm: 100 },
  ];

  it('converts mm segments onto the property when it has no walls', () => {
    expect(usePropertyStore.getState().importLegacyWalls(SEG)).toBe(true);
    const walls = usePropertyStore.getState().property.walls!;
    expect(walls).toHaveLength(2);
    expect(walls[0]).toMatchObject({
      a: { x: 0, y: 0 }, b: { x: 2.5, y: 0 }, thicknessM: 0.1, levelId: 'ground',
    });
    expect(walls[1]).toMatchObject({ a: { x: 2.5, y: 0 }, b: { x: 2.5, y: 1.5 } });
    expect(typeof walls[0].id).toBe('string');
  });

  it('is a no-op (false) when the property already has walls', () => {
    usePropertyStore.getState().addFreeWalls(runToFreeWalls([{ x: 0, y: 0 }, { x: 1, y: 0 }], 'ground'));
    const before = JSON.stringify(usePropertyStore.getState().property);
    expect(usePropertyStore.getState().importLegacyWalls(SEG)).toBe(false);
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
  });

  it('is false when nothing converts', () => {
    expect(usePropertyStore.getState().importLegacyWalls([])).toBe(false);
    expect(usePropertyStore.getState().property.walls).toBeUndefined();
  });
});

describe('setItemLight', () => {
  it('flips lightOn on the owning item wherever it lives; absent reads as on', () => {
    const b = usePropertyStore.getState().addRectangleRoom('B', { lengthM: 3, widthM: 3 });
    const id = usePropertyStore
      .getState()
      .addItem({ productId: 'floor-lamp', x: 1, y: 1, rotation: 0 }, b);
    const item = () =>
      usePropertyStore.getState().property.rooms.find((r) => r.id === b)!.placedItems[0];
    expect(item().lightOn).toBeUndefined();
    expect(itemLightOn(item())).toBe(true);

    usePropertyStore.getState().setActiveRoom(usePropertyStore.getState().property.rooms[0].id);
    usePropertyStore.getState().setItemLight(id, false);
    expect(item().lightOn).toBe(false);
    expect(itemLightOn(item())).toBe(false);
    usePropertyStore.getState().setItemLight(id, true);
    expect(item().lightOn).toBe(true);

    const before = JSON.stringify(usePropertyStore.getState().property);
    usePropertyStore.getState().setItemLight('nope', false);
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
  });
});

describe('normaliseLoadedProperty — Sims world fields round-trip', () => {
  const base = {
    id: 'p',
    name: 'P',
    activeRoomId: 'r1',
    rooms: [{ id: 'r1', name: 'Main', polygon: RECT, placedItems: [] }],
  };

  it('a pre-levels property comes back without any of the new fields', () => {
    const p = normaliseLoadedProperty(base);
    expect(Object.keys(p).sort()).toEqual(['activeRoomId', 'id', 'name', 'rooms']);
    expect(p.rooms[0]).not.toHaveProperty('levelId');
    expect(p.rooms[0]).not.toHaveProperty('kind');
  });

  it('keeps valid levels (sorted, ground guaranteed) and drops garbage', () => {
    const p = normaliseLoadedProperty({
      ...base,
      levels: [
        { id: 'two', name: 'Second floor', index: 2 },
        { id: 'one', name: '  First floor ', index: 1 },
        { id: 'one', name: 'dupe', index: 9 },
        { id: '', name: 'bad', index: 3 },
        { id: 'x', name: 5, index: 3 },
        'nope',
        null,
      ] as never,
    });
    expect(p.levels).toEqual([
      { id: 'ground', name: 'Ground floor', index: 0 },
      { id: 'one', name: 'First floor', index: 1 },
      { id: 'two', name: 'Second floor', index: 2 },
    ]);
  });

  it('an all-garbage levels array leaves the field off', () => {
    const p = normaliseLoadedProperty({ ...base, levels: [null, 'x', {}] as never });
    expect(p.levels).toBeUndefined();
  });

  it('keeps activeLevelId only when it names a level AND matches the focused room', () => {
    const levels = [
      { id: 'ground', name: 'Ground floor', index: 0 },
      { id: 'one', name: 'First floor', index: 1 },
    ];
    const rooms = [
      { id: 'r1', name: 'Main', polygon: RECT, placedItems: [] },
      { id: 'r2', name: 'Up', polygon: RECT, placedItems: [], levelId: 'one' },
    ];
    const norm = (over: Record<string, unknown>) =>
      normaliseLoadedProperty({ ...base, levels, rooms, ...over } as never);
    expect(norm({ activeRoomId: 'r2', activeLevelId: 'one' }).activeLevelId).toBe('one');
    // focused room wins a disagreement
    expect(norm({ activeRoomId: 'r1', activeLevelId: 'one' }).activeLevelId).toBeUndefined();
    expect(norm({ activeRoomId: 'r2', activeLevelId: 'ground' }).activeLevelId).toBe('one');
    // unknown / wrong-typed level ids are dropped
    expect(norm({ activeRoomId: 'r1', activeLevelId: 'nope' }).activeLevelId).toBeUndefined();
    expect(norm({ activeRoomId: 'r1', activeLevelId: 42 }).activeLevelId).toBeUndefined();
  });

  it('whitelists Room.levelId and Room.kind, canonicalising ground to absent', () => {
    const p = normaliseLoadedProperty({
      ...base,
      levels: [{ id: 'one', name: 'First floor', index: 1 }],
      rooms: [
        { id: 'a', name: 'A', polygon: RECT, placedItems: [], levelId: 'one', kind: 'room' },
        { id: 'b', name: 'B', polygon: [], placedItems: [], levelId: 'ground', kind: 'outdoor' },
        { id: 'c', name: 'C', polygon: RECT, placedItems: [], levelId: 7, kind: 'garage' },
        { id: 'd', name: 'D', polygon: RECT, placedItems: [], levelId: 'vanished' },
      ] as never,
      activeRoomId: 'a',
    });
    const byId = Object.fromEntries(p.rooms.map((r) => [r.id, r]));
    expect(byId.a).toMatchObject({ levelId: 'one', kind: 'room' });
    expect(byId.b.levelId).toBeUndefined();
    expect(byId.b.kind).toBe('outdoor');
    expect('levelId' in byId.c).toBe(false);
    expect('kind' in byId.c).toBe(false);
    // a room stranded on a level that no longer exists drops to ground
    expect(byId.d.levelId).toBeUndefined();
    expect(p.activeLevelId).toBe('one');
  });

  it('keeps valid free walls (whitelisted fields only) and drops garbage + zero length', () => {
    const p = normaliseLoadedProperty({
      ...base,
      walls: [
        { id: 'w1', a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, thicknessM: 0.1, extra: 'dropped' },
        { id: 'w2', a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, thicknessM: 0.1, levelId: 'one' },
        { id: 'w2', a: { x: 9, y: 9 }, b: { x: 9, y: 0 }, thicknessM: 0.1 }, // dupe id
        { id: 'w3', a: { x: 1, y: 1 }, b: { x: 1, y: 1 }, thicknessM: 0.1 }, // zero length
        { id: 'w4', a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, thicknessM: -1 },
        { id: 'w5', a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, thicknessM: 0.1, levelId: 'vanished' },
        { a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, thicknessM: 0.1 },
        null,
      ] as never,
      levels: [{ id: 'one', name: 'First floor', index: 1 }],
    });
    expect(p.walls).toEqual([
      { id: 'w1', a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, thicknessM: 0.1 },
      { id: 'w2', a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, thicknessM: 0.1, levelId: 'one' },
      // stranded on a vanished level → ground (levelId dropped)
      { id: 'w5', a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, thicknessM: 0.1 },
    ]);
  });

  it('an empty or garbage walls array leaves the field off', () => {
    expect(normaliseLoadedProperty({ ...base, walls: [] }).walls).toBeUndefined();
    expect(normaliseLoadedProperty({ ...base, walls: 'x' as never }).walls).toBeUndefined();
  });

  it('keeps a valid site (clamped) and drops an invalid or null one', () => {
    expect(
      normaliseLoadedProperty({
        ...base, site: { widthM: 30, depthM: 20, originM: { x: 1, y: 2 } },
      }).site,
    ).toEqual({ widthM: 30, depthM: 20, originM: { x: 1, y: 2 } });
    expect(
      normaliseLoadedProperty({
        ...base, site: { widthM: 900, depthM: 0.1, originM: { x: 0, y: 0 } },
      }).site,
    ).toEqual({ widthM: 500, depthM: 1, originM: { x: 0, y: 0 } });
    expect(normaliseLoadedProperty({ ...base, site: null }).site).toBeUndefined();
    expect(normaliseLoadedProperty({ ...base, site: { widthM: 'a' } as never }).site).toBeUndefined();
  });

  it('lightOn rides inside placedItems unchanged', () => {
    const p = normaliseLoadedProperty({
      ...base,
      rooms: [{
        id: 'r1',
        name: 'Main',
        polygon: RECT,
        placedItems: [{ instanceId: 'i1', productId: 'lamp', x: 1, y: 1, rotation: 0, lightOn: false }],
      }],
    });
    expect(p.rooms[0].placedItems[0].lightOn).toBe(false);
  });

  it('a full multi-storey property survives a JSON round trip through loadProperty', () => {
    const lvl = usePropertyStore.getState().addLevel('Upstairs');
    const up = usePropertyStore.getState().property.activeRoomId;
    usePropertyStore.getState().setRoomPolygon(up, RECT);
    const outdoors = usePropertyStore.getState().ensureOutdoorRoom(lvl);
    usePropertyStore.getState().addItem({ productId: 'tree', x: 9, y: 9, rotation: 0 }, outdoors);
    usePropertyStore.getState().addFreeWalls(runToFreeWalls([{ x: 0, y: 0 }, { x: 2, y: 0 }], lvl));
    usePropertyStore.getState().setSite({ widthM: 25, depthM: 40, originM: { x: -5, y: -5 } });
    const lampRoom = usePropertyStore.getState().property.rooms[0].id;
    const lamp = usePropertyStore
      .getState()
      .addItem({ productId: 'lamp', x: 1, y: 1, rotation: 0 }, lampRoom);
    usePropertyStore.getState().setItemLight(lamp, false);

    const snapshot = JSON.parse(JSON.stringify(usePropertyStore.getState().property));
    usePropertyStore.getState().resetToDefault();
    usePropertyStore.getState().loadProperty(snapshot);

    const p = usePropertyStore.getState().property;
    // Field-by-field rather than whole-object: normaliseLoadedRoom always
    // emits `openings: []` / `floorFinish: null`, which a blank room lacks.
    expect(p.levels).toEqual(snapshot.levels);
    expect(p.activeLevelId).toBe(snapshot.activeLevelId);
    expect(p.walls).toEqual(snapshot.walls);
    expect(p.site).toEqual(snapshot.site);
    expect(p.activeRoomId).toBe(snapshot.activeRoomId);
    expect(p.rooms.map((r) => [r.id, r.levelId, r.kind, r.placedItems]))
      .toEqual(snapshot.rooms.map((r: typeof p.rooms[number]) => [r.id, r.levelId, r.kind, r.placedItems]));
    expect(p.levels?.map((l) => l.name)).toEqual(['Ground floor', 'Upstairs']);
    expect(p.activeLevelId).toBe(lvl);
    expect(p.walls).toHaveLength(1);
    expect(p.site?.widthM).toBe(25);
    expect(p.rooms.find((r) => r.id === outdoors)?.kind).toBe('outdoor');
    expect(p.rooms.find((r) => r.id === lampRoom)?.placedItems.find((i) => i.instanceId === lamp)?.lightOn)
      .toBe(false);
  });
});
