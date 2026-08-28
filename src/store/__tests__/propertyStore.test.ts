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
} from '../propertyStore';
import { rectToPolygon, polygonArea } from '../../lib/geometry';

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
