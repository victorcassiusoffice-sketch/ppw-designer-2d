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
