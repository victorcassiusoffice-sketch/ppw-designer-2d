import { describe, expect, it } from 'vitest';
import type { BuildingStair } from '../building';
import { stairFootprintInsideRoom, stairPlacementFits, validateStairPlacement } from '../stairPlacement';
import type { Property } from '../../store/propertyStore';

const room = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }, { x: 0, y: 6 }];
const stair: BuildingStair = { id: 's', fromLevelId: 'ground', toLevelId: 'first', x: 2, y: 3, widthM: 1, runM: 4.3, rotation: 0 };
const property: Property = {
  id: 'p', name: 'Building', activeRoomId: 'a',
  levels: [{ id: 'ground', index: 0, name: 'Ground' }, { id: 'first', index: 1, name: 'First' }],
  rooms: [{ id: 'a', name: 'A', polygon: room, placedItems: [] }, { id: 'b', name: 'B', polygon: room, placedItems: [], levelId: 'first' }],
};

describe('stair placement', () => {
  it('rejects a flight crossing a concave notch despite all four corners being inside', () => {
    const notched = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 6 }, { x: 0, y: 6 }];
    const across = [{ x: 1, y: 3 }, { x: 5, y: 3 }, { x: 5, y: 4 }, { x: 1, y: 4 }];
    expect(stairFootprintInsideRoom(across, notched)).toBe(false);
    expect(stairFootprintInsideRoom(across, room)).toBe(true);
  });

  it('requires the whole footprint to fit at both ends and leaves clearance at the wall', () => {
    expect(stairPlacementFits(property, stair)).toBe(true);
    expect(stairPlacementFits(property, { ...stair, x: 0.5 })).toBe(false);
    expect(validateStairPlacement(property, { ...stair, x: 0.5 })).toMatchObject({ ok: false, reason: 'outside-room' });
    expect(stairPlacementFits({ ...property, rooms: property.rooms.slice(0, 1) }, stair)).toBe(false);
  });

  it('blocks overlapping stair openings while allowing edits to the same flight', () => {
    const placed = { ...property, stairs: [stair] };
    expect(stairPlacementFits(placed, { ...stair, id: 'second', x: 2.25 })).toBe(false);
    expect(validateStairPlacement(placed, { ...stair, id: 'second', x: 2.25 })).toMatchObject({ ok: false, reason: 'overlapping-stairs' });
    expect(stairPlacementFits(placed, { ...stair, id: 'second', x: 4 })).toBe(true);
    expect(stairPlacementFits(placed, { ...stair, x: 2.1 })).toBe(true);
  });
});
