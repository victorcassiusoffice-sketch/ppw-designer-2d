import { beforeEach, describe, expect, it } from 'vitest';
import { usePropertyStore, type Property, type Room } from '../../store/propertyStore';
import { openingsOnPhysicalWall, previewOpeningPlacement } from '../openingPlacement';
import { roomEdges } from '../wallEdges';

const draft = { kind: 'door' as const, widthM: 0.838, flipFacing: false, flipHand: false };
let property: Property;
let room: Room;
beforeEach(() => {
  usePropertyStore.getState().resetToDefault();
  const state = usePropertyStore.getState();
  state.setRoomPolygon(state.property.activeRoomId, [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 5 }, { x: 0, y: 5 }]);
  property = usePropertyStore.getState().property;
  room = property.rooms[0];
});
describe('wall snapped opening placement', () => {
  it('slides at the exact pointer offset, clamps corners, and keeps the chosen size and swing', () => {
    const preview = previewOpeningPlacement(property, 'ground', { x: 0.02, y: -0.04 }, { ...draft, widthM: 0.914, flipFacing: true, flipHand: true })!;
    expect(preview.ok).toBe(true);
    expect(preview.opening).toMatchObject({ widthM: 0.914, offsetM: 0.557, flipFacing: true, flipHand: true });
    expect(preview.a.x).toBeCloseTo(0.1);
    expect(preview.b.x - preview.a.x).toBeCloseTo(0.914);
    expect(previewOpeningPlacement(property, 'ground', { x: 2.37, y: 0.1 }, draft)?.opening.offsetM).toBeCloseTo(2.37);
  });
  it('never snaps to a different storey, a roof, an outdoor polygon or a distant wall', () => {
    const extra: Room[] = [
      { ...room, id: 'upper', levelId: 'upper' },
      { ...room, id: 'outside', levelId: 'outdoor-only', kind: 'outdoor' },
      { ...room, id: 'roof', levelId: 'roof', kind: 'roof' },
    ];
    const p = { ...property, rooms: [room, ...extra] };
    expect(previewOpeningPlacement(p, 'upper', { x: 3, y: 0.1 }, draft)?.roomId).toBe('upper');
    expect(previewOpeningPlacement(p, 'outdoor-only', { x: 3, y: 0.1 }, draft)).toBeNull();
    expect(previewOpeningPlacement(p, 'roof', { x: 3, y: 0.1 }, draft)).toBeNull();
    expect(previewOpeningPlacement(p, 'ground', { x: 3, y: 2.5 }, draft)).toBeNull();
  });
  it('rejects a shared-wall overlap even when the existing opening belongs to the other room', () => {
    const neighbour: Room = { ...room, id: 'neighbour', polygon: [{ x: 6, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 6, y: 5 }], openings: [{ ...draft, id: 'existing', edgeIndex: 3, offsetM: 3, widthM: 1 }] };
    const p = { ...property, rooms: [room, neighbour] };
    expect(previewOpeningPlacement(p, 'ground', { x: 6, y: 2 }, draft)).toMatchObject({ ok: false, message: 'Openings on the same wall can’t overlap.' });
    expect(previewOpeningPlacement(p, 'ground', { x: 6, y: 3.5 }, draft)?.ok).toBe(true);
    expect(openingsOnPhysicalWall(p.rooms, room, roomEdges(room)[1], 'existing')).toHaveLength(0);
  });
  it('does not count aligned openings on another floor as blocked space', () => {
    const upper: Room = { ...room, id: 'upper', levelId: 'upper', openings: [{ ...draft, id: 'up-door', edgeIndex: 0, offsetM: 2 }] };
    expect(previewOpeningPlacement({ ...property, rooms: [room, upper] }, 'ground', { x: 2, y: 0 }, draft)?.ok).toBe(true);
  });
  it('reports a short wall and gives windows their real sill elevation', () => {
    expect(previewOpeningPlacement(property, 'ground', { x: 2, y: 0 }, { ...draft, widthM: 7 })?.ok).toBe(false);
    expect(previewOpeningPlacement(property, 'ground', { x: 2, y: 0 }, { ...draft, kind: 'window', widthM: 1.2 })?.opening.sillM).toBe(0.9);
  });
  it('enforces shared-wall validation for both Plan additions and updates in the store', () => {
    const neighbour: Room = { ...room, id: 'neighbour', polygon: [{ x: 6, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 6, y: 5 }], openings: [{ ...draft, id: 'existing', edgeIndex: 3, offsetM: 3, widthM: 1 }] };
    usePropertyStore.setState({ property: { ...property, rooms: [room, neighbour] } });
    const store = usePropertyStore.getState();
    expect(store.addOpening(room.id, { ...draft, edgeIndex: 1, offsetM: 2 })).toBeNull();
    const id = store.addOpening(room.id, { ...draft, edgeIndex: 1, offsetM: 3.5 })!;
    expect(id).toBeTruthy();
    expect(store.updateOpening(id, { offsetM: 2 })).toBe(false);
    expect(store.updateOpening(id, { flipHand: true })).toBe(true);
  });
});
