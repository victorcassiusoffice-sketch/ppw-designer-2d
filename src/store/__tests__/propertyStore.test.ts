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
  it('starts with one rectangle room', () => {
    const { property } = usePropertyStore.getState();
    expect(property.rooms).toHaveLength(1);
    expect(property.rooms[0].polygon).toHaveLength(4);
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

  it('re-seeds a fresh room when the last room is deleted (never goes to zero)', () => {
    const { property } = usePropertyStore.getState();
    expect(property.rooms).toHaveLength(1);
    usePropertyStore.getState().removeRoom(property.rooms[0].id);
    const after = usePropertyStore.getState().property;
    expect(after.rooms).toHaveLength(1);
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

  it('normaliseLoadedProperty re-seeds a default room when rooms list is empty', () => {
    const p = normaliseLoadedProperty({ id: 'x', name: 'Empty', rooms: [] });
    expect(p.rooms).toHaveLength(1);
    expect(p.rooms[0].polygon).toHaveLength(4);
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
