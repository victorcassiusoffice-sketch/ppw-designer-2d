/**
 * designStore — blank-start guarantee (Vic 2026-08-25, complaint 1).
 *
 * The façade used to project a 5 × 4 m rectangle whenever it could not
 * resolve an active room, which is how a room the customer never drew
 * ended up on the canvas. These tests pin the replacement contract:
 *
 *   no user-drawn room  →  EMPTY polygon  →  RoomCanvas renders nothing
 *
 * `RoomCanvas` guards its room Group on `polygon.length >= 3`, so an
 * empty polygon is the machine-checkable definition of "blank canvas".
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignStore, isActiveRoomRectangle, EMPTY_POLYGON } from '../designStore';
import { usePropertyStore } from '../propertyStore';
import { useToastStore } from '../toastStore';

beforeEach(() => {
  usePropertyStore.getState().resetToDefault();
});

describe('designStore — blank start', () => {
  it('exposes an EMPTY polygon on a fresh (un-drawn) property', () => {
    const { polygon } = useDesignStore.getState();
    expect(polygon).toHaveLength(0);
    // Below the >= 3 threshold RoomCanvas uses to decide "there is a room".
    expect(polygon.length >= 3).toBe(false);
  });

  it('projects an EMPTY polygon when there is no active room at all', () => {
    // Force the unresolvable-active-room branch the old 5×4 fallback served.
    usePropertyStore.setState((s) => ({
      property: { ...s.property, activeRoomId: 'does-not-exist' },
    }));
    const { polygon } = useDesignStore.getState();
    expect(polygon).toHaveLength(0);
  });

  it('EMPTY_POLYGON is empty and frozen (stable identity, no accidental writes)', () => {
    expect(EMPTY_POLYGON).toHaveLength(0);
    expect(Object.isFrozen(EMPTY_POLYGON)).toBe(true);
  });

  it('does not report a blank room as a rectangle (keeps TopBar L/W disabled)', () => {
    expect(isActiveRoomRectangle()).toBe(false);
  });

  it('surfaces the polygon once the user actually draws a room', () => {
    const ps = usePropertyStore.getState();
    const activeId = ps.property.activeRoomId;
    ps.setRoomPolygon(activeId, [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 0, y: 4 },
    ]);
    const { polygon, roomDimensions } = useDesignStore.getState();
    expect(polygon).toHaveLength(4);
    expect(roomDimensions.lengthM).toBeCloseTo(5, 6);
    expect(roomDimensions.widthM).toBeCloseTo(4, 6);
    expect(isActiveRoomRectangle()).toBe(true);
  });

  it('returns to a blank canvas after the last room is deleted', () => {
    const ps = usePropertyStore.getState();
    ps.setRoomPolygon(ps.property.activeRoomId, [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
    ]);
    expect(useDesignStore.getState().polygon).toHaveLength(3);
    const cur = usePropertyStore.getState().property;
    usePropertyStore.getState().removeRoom(cur.rooms[0].id);
    expect(useDesignStore.getState().polygon).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Attached multi-room (2026-08-26) — D7 guards that keep the no-overlap
// invariant airtight no matter which surface edits a room.
// ---------------------------------------------------------------------------

describe('designStore — setRoomDimensions preserves the room corner (D7a)', () => {
  it('resizes an ATTACHED room in place instead of teleporting it to origin', () => {
    const ps = usePropertyStore.getState();
    // Room A at the origin, room B attached to its east wall and ACTIVE.
    ps.setRoomPolygon(ps.property.activeRoomId, [
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 },
    ]);
    const b = usePropertyStore.getState().addRoom({
      name: 'B',
      polygon: [{ x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 4 }, { x: 5, y: 4 }],
    });
    usePropertyStore.getState().setActiveRoom(b);

    useDesignStore.getState().setRoomDimensions({ lengthM: 3, widthM: 2 });

    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === b);
    // Corner held at (5, 0) — pre-2026-08-26 this snapped back to (0, 0)
    // and the room landed straight on top of room A.
    expect(room?.polygon).toEqual([
      { x: 5, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 2 }, { x: 5, y: 2 },
    ]);
  });

  it('still resizes a lone room at the origin exactly as before', () => {
    const ps = usePropertyStore.getState();
    ps.setRoomPolygon(ps.property.activeRoomId, [
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 },
    ]);
    useDesignStore.getState().setRoomDimensions({ lengthM: 6, widthM: 3 });
    expect(useDesignStore.getState().polygon).toEqual([
      { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 3 }, { x: 0, y: 3 },
    ]);
  });
});

describe('designStore — setRoomDimensions rejects an overlapping resize (D7b)', () => {
  it('refuses the resize and leaves the polygon untouched', () => {
    const ps = usePropertyStore.getState();
    ps.setRoomPolygon(ps.property.activeRoomId, [
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 },
    ]);
    const b = usePropertyStore.getState().addRoom({
      name: 'B',
      polygon: [{ x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 4 }, { x: 5, y: 4 }],
    });
    // Make room A active and try to grow it east, through room B.
    usePropertyStore.getState().setActiveRoom(usePropertyStore.getState().property.rooms[0].id);
    const before = useDesignStore.getState().polygon;
    useToastStore.getState().clear();

    useDesignStore.getState().setRoomDimensions({ lengthM: 8, widthM: 4 });

    expect(useDesignStore.getState().polygon).toEqual(before);
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toMatch(/overlap another room/i);
    expect(toasts[0].kind).toBe('warn');
    // Room B is untouched too.
    expect(usePropertyStore.getState().property.rooms.find((r) => r.id === b)?.polygon).toEqual([
      { x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 4 }, { x: 5, y: 4 },
    ]);
  });

  it('allows a resize that only SHRINKS away from the neighbour', () => {
    const ps = usePropertyStore.getState();
    ps.setRoomPolygon(ps.property.activeRoomId, [
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 },
    ]);
    usePropertyStore.getState().addRoom({
      name: 'B',
      polygon: [{ x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 4 }, { x: 5, y: 4 }],
    });
    usePropertyStore.getState().setActiveRoom(usePropertyStore.getState().property.rooms[0].id);
    useDesignStore.getState().setRoomDimensions({ lengthM: 4, widthM: 4 });
    expect(useDesignStore.getState().polygon).toEqual([
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 },
    ]);
  });
});

describe('designStore — loadSnapshot refuses to flatten a multi-room plan (D7c)', () => {
  it('is a no-op when more than one room is drawn', () => {
    const ps = usePropertyStore.getState();
    ps.setRoomPolygon(ps.property.activeRoomId, [
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 },
    ]);
    usePropertyStore.getState().addRoom({
      name: 'B',
      polygon: [{ x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 4 }, { x: 5, y: 4 }],
    });
    const before = JSON.stringify(usePropertyStore.getState().property);

    useDesignStore.getState().loadSnapshot({
      roomDimensions: { lengthM: 2, widthM: 2 },
      placedItems: [],
    });

    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
  });

  it('still loads normally into a SINGLE-room property', () => {
    const ps = usePropertyStore.getState();
    ps.setRoomPolygon(ps.property.activeRoomId, [
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 },
    ]);
    useDesignStore.getState().loadSnapshot({
      roomDimensions: { lengthM: 3, widthM: 2 },
      placedItems: [
        { instanceId: 'ignored', productId: 'p1', x: 1, y: 1, rotation: 0 },
      ],
    });
    expect(useDesignStore.getState().polygon).toEqual([
      { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }, { x: 0, y: 2 },
    ]);
    expect(useDesignStore.getState().placedItems).toHaveLength(1);
  });
});
