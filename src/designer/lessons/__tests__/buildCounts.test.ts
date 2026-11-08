/**
 * Which quiet sound a change of the design makes.
 */
import { describe, expect, it } from 'vitest';
import type { Property, Room } from '../../../store/propertyStore';
import { buildCounts, soundForChange } from '../buildCounts';

const square = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 3 },
  { x: 0, y: 3 },
];
const room = (patch: Partial<Room> = {}): Room => ({ id: 'r1', name: 'Room', polygon: square, placedItems: [], ...patch }) as Room;
const property = (rooms: Room[], extra: Partial<Property> = {}): Property =>
  ({ id: 'p', name: 'P', activeRoomId: 'r1', rooms, ...extra }) as Property;
const item = (id: string) => ({ instanceId: id, productId: 'x', x: 1, y: 1, rotation: 0 });

describe('soundForChange', () => {
  const base = buildCounts(property([room()]));

  it('place: an object, an opening or a room arrives', () => {
    expect(soundForChange(base, buildCounts(property([room({ placedItems: [item('a')] })])))).toBe('place');
    const door = { id: 'o', edgeIndex: 0, offsetM: 1, widthM: 0.8, kind: 'door' as const, flipFacing: false, flipHand: false };
    expect(soundForChange(base, buildCounts(property([room({ openings: [door] })])))).toBe('place');
  });

  it('remove: something leaves', () => {
    const before = buildCounts(property([room({ placedItems: [item('a'), item('b')] })]));
    expect(soundForChange(before, buildCounts(property([room({ placedItems: [item('a')] })])))).toBe('remove');
  });

  it('paint: wall paint, a floor or cladding changes', () => {
    expect(soundForChange(base, buildCounts(property([room({ wallPaint: [{ edgeIndex: 0, paintId: 'p1' }] })])))).toBe('paint');
    const tiles = { materialId: 'gym-interlock', tileWm: 0.5, tileHm: 0.5, originM: { x: 0, y: 0 }, runs: [0, 0, 1] };
    expect(soundForChange(base, buildCounts(property([room({ floorTiles: [tiles] })])))).toBe('paint');
  });

  it('snap: a free wall is added', () => {
    const wall = { id: 'w', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, thicknessM: 0.1 };
    expect(soundForChange(base, buildCounts(property([room()], { walls: [wall] })))).toBe('snap');
  });

  it('nothing: a change that is not a build (a rename)', () => {
    expect(soundForChange(base, buildCounts(property([room({ name: 'Gym' })])))).toBeNull();
  });
});
