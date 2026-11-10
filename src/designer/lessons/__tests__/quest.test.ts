/**
 * Each quest step ticks from the real design, never from a click count.
 */
import { describe, expect, it } from 'vitest';
import type { Property, Room } from '../../../store/propertyStore';
import {
  QUEST_STEPS,
  doneQuestSteps,
  isEmptyPlan,
  questFacts,
  questStepDone,
  questStepProgress,
} from '../quest';

const square = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 3 },
  { x: 0, y: 3 },
];

function room(patch: Partial<Room> = {}): Room {
  return { id: 'r1', name: 'Main Room', polygon: square, placedItems: [], ...patch } as Room;
}

function property(rooms: Room[], extra: Partial<Property> = {}): Property {
  return { id: 'p1', name: 'Test', activeRoomId: rooms[0]?.id ?? 'r1', rooms, ...extra } as Property;
}

const item = (id: string) => ({ instanceId: id, productId: 'any', x: 1, y: 1, rotation: 0 });
const noView = { saw3d: false, walked: false };

describe('the quest reads the design', () => {
  it('a blank plan is empty and ticks nothing', () => {
    const blank = property([room({ polygon: [] })]);
    expect(isEmptyPlan(blank)).toBe(true);
    expect(doneQuestSteps(questFacts(blank), noView)).toEqual([]);
  });

  it('build a room: a closed indoor polygon', () => {
    expect(questStepDone('room', questFacts(property([room()])), noView)).toBe(true);
    // A garden container or a two-point run is not a room.
    expect(questStepDone('room', questFacts(property([room({ kind: 'outdoor' })])), noView)).toBe(false);
    expect(questStepDone('room', questFacts(property([room({ polygon: square.slice(0, 2) })])), noView)).toBe(false);
  });

  it('add a door and a window: both kinds, on a drawn room', () => {
    const door = { id: 'o1', edgeIndex: 0, offsetM: 1, widthM: 0.8, kind: 'door' as const, flipFacing: false, flipHand: false };
    const windowOpening = { ...door, id: 'o2', kind: 'window' as const, sillM: 0.9 };
    const onlyDoor = questFacts(property([room({ openings: [door] })]));
    expect(questStepDone('openings', onlyDoor, noView)).toBe(false);
    expect(questStepProgress('openings', onlyDoor)).toEqual({ count: 1, target: 2 });
    const both = questFacts(property([room({ openings: [door, windowOpening] })]));
    expect(questStepDone('openings', both, noView)).toBe(true);
    // A doorway counts as a door.
    const doorway = questFacts(property([room({ openings: [{ ...door, kind: 'doorway' }, windowOpening] })]));
    expect(questStepDone('openings', doorway, noView)).toBe(true);
  });

  it('paint a wall: a room edge or a free wall with paint', () => {
    expect(questStepDone('paint', questFacts(property([room({ wallPaint: [{ edgeIndex: 1, paintId: 'permoglaze-matt-emulsion' }] })])), noView)).toBe(true);
    const freeWall = { id: 'w1', a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, thicknessM: 0.1, paintId: 'permoglaze-matt-emulsion' };
    expect(questStepDone('paint', questFacts(property([room()], { walls: [freeWall] })), noView)).toBe(true);
    expect(questStepDone('paint', questFacts(property([room({ wallPaint: [] })])), noView)).toBe(false);
  });

  it('lay a floor: painted tiles or a whole-room finish', () => {
    const tiles = { materialId: 'gym-interlock', tileWm: 0.5, tileHm: 0.5, originM: { x: 0, y: 0 }, runs: [0, 0, 2] };
    expect(questStepDone('floor', questFacts(property([room({ floorTiles: [tiles] })])), noView)).toBe(true);
    expect(questStepDone('floor', questFacts(property([room({ floorFinish: { materialId: 'epdm-roll' } })])), noView)).toBe(true);
    expect(questStepDone('floor', questFacts(property([room({ floorTiles: [{ ...tiles, runs: [] }] })])), noView)).toBe(false);
  });

  it('place three products: counted across rooms and the garden', () => {
    const two = questFacts(property([room({ placedItems: [item('a'), item('b')] })]));
    expect(questStepDone('products', two, noView)).toBe(false);
    expect(questStepProgress('products', two)).toEqual({ count: 2, target: 3 });
    const garden = room({ id: 'g', kind: 'outdoor', polygon: [], placedItems: [item('c')] });
    const three = questFacts(property([room({ placedItems: [item('a'), item('b')] }), garden]));
    expect(questStepDone('products', three, noView)).toBe(true);
  });

  it('3D and Walk tick from what the app showed, and only with a room', () => {
    const withRoom = questFacts(property([room()]));
    expect(questStepDone('view3d', withRoom, { saw3d: true, walked: false })).toBe(true);
    expect(questStepDone('walk', withRoom, { saw3d: true, walked: true })).toBe(true);
    const blank = questFacts(property([room({ polygon: [] })]));
    expect(questStepDone('view3d', blank, { saw3d: true, walked: true })).toBe(false);
  });

  it('a finished design ticks all seven', () => {
    const tiles = { materialId: 'gym-interlock', tileWm: 0.5, tileHm: 0.5, originM: { x: 0, y: 0 }, runs: [0, 0, 1] };
    const door = { id: 'o1', edgeIndex: 0, offsetM: 1, widthM: 0.8, kind: 'door' as const, flipFacing: false, flipHand: false };
    const full = property([
      room({
        openings: [door, { ...door, id: 'o2', kind: 'window' }],
        wallPaint: [{ edgeIndex: 0, paintId: 'permoglaze-matt-emulsion' }],
        floorTiles: [tiles],
        placedItems: [item('a'), item('b'), item('c')],
      }),
    ]);
    expect(doneQuestSteps(questFacts(full), { saw3d: true, walked: true })).toEqual([...QUEST_STEPS]);
    expect(isEmptyPlan(full)).toBe(false);
  });
});
