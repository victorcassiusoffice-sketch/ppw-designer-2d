import { beforeEach, describe, expect, it } from 'vitest';
import { normaliseLoadedProperty, usePropertyStore } from '../propertyStore';
import { buildingLevels, levelElevationM } from '../../designer/building';
import { roomLevelId } from '../../designer/levels';

beforeEach(() => usePropertyStore.getState().resetToDefault());

describe('whole-building store actions', () => {
  it('copies an upper-storey layout with independent rooms and openings, retaining furniture downstairs', () => {
    const store = usePropertyStore.getState();
    const source = store.addRectangleRoom('Living', { lengthM: 5, widthM: 4 });
    const opening = store.addOpening(source, { kind: 'window', edgeIndex: 0, offsetM: 1, widthM: 1.2, flipFacing: false, flipHand: false });
    store.addItem({ productId: 'test', x: 1, y: 1, rotation: 0 }, source);
    store.setLevelHeight('ground', 3.1);
    const upper = store.addLevel(undefined, 'ground');
    const p = usePropertyStore.getState().property;
    const copied = p.rooms.find((r) => roomLevelId(r) === upper)!;
    const original = p.rooms.find((r) => r.id === source)!;
    expect(copied.id).not.toBe(source);
    expect(copied.polygon).toEqual(original.polygon);
    expect(copied.polygon).not.toBe(original.polygon);
    expect(copied.openings?.[0].id).not.toBe(opening);
    expect(copied.openings?.[0].kind).toBe('window');
    expect(copied.placedItems).toEqual([]);
    expect(original.placedItems).toHaveLength(1);
    expect(p.levels?.find((l) => l.id === upper)?.heightM).toBe(3.1);
  });

  it('allows many levels without a low fixed storey cap and moves the roof above them', () => {
    const store = usePropertyStore.getState();
    store.ensureRoofLevel();
    for (let i = 0; i < 40; i++) store.addLevel();
    const p = usePropertyStore.getState().property;
    expect(p.levels).toHaveLength(42);
    expect(p.levels?.[p.levels.length - 1]?.id).toBe('roof');
    const elevations = buildingLevels(p);
    expect(elevations[elevations.length - 1]?.elevationM).toBeCloseTo(41 * 2.88);
  });

  it('validates stairs, updates positions and cleans connections when deleting an empty level', () => {
    const store = usePropertyStore.getState();
    store.addRectangleRoom('Main', { lengthM: 8, widthM: 8 });
    const upper = store.addLevel(undefined, 'ground');
    const id = store.addStair({ fromLevelId: 'ground', toLevelId: upper, x: 3, y: 4 });
    expect(id).toBeTypeOf('string');
    expect(store.addStair({ fromLevelId: upper, toLevelId: 'ground' })).toBeNull();
    expect(store.updateStair(id!, { widthM: -1 })).toBe(false);
    expect(store.updateStair(id!, { x: -1 })).toBe(false);
    expect(store.addStair({ fromLevelId: 'ground', toLevelId: upper, x: 3.2, y: 4 })).toBeNull();
    expect(store.updateStair(id!, { x: 3, rotation: 450 })).toBe(true);
    expect(usePropertyStore.getState().property.stairs?.[0]).toMatchObject({ x: 3, rotation: 90 });
    expect(store.removeLevel(upper)).toBe(false);
    const upperRoom = usePropertyStore.getState().property.rooms.find((room) => room.levelId === upper)!;
    store.setRoomPolygon(upperRoom.id, []);
    expect(store.removeLevel(upper)).toBe(true);
    expect(usePropertyStore.getState().property.stairs).toBeUndefined();
  });

  it('applies per-level heights and can reset them to the legacy property default', () => {
    const store = usePropertyStore.getState();
    const upper = store.addLevel();
    store.setLevelHeight('ground', 3.2);
    expect(levelElevationM(usePropertyStore.getState().property, upper)).toBeCloseTo(3.38);
    store.setLevelHeight('ground', NaN);
    expect(levelElevationM(usePropertyStore.getState().property, upper)).toBeCloseTo(3.38);
    store.setLevelHeight('ground', null);
    expect(levelElevationM(usePropertyStore.getState().property, upper)).toBeCloseTo(2.88);
  });

  it('round-trips height, elevation, stairs and felt roofs through the normal save/load path', () => {
    const store = usePropertyStore.getState();
    store.addRectangleRoom('Main', { lengthM: 8, widthM: 8 });
    const upper = store.addLevel(undefined, 'ground');
    store.setLevelHeight('ground', 3.3);
    store.setLevelElevation(upper, 3.5);
    store.addStair({ fromLevelId: 'ground', toLevelId: upper, x: 3, y: 4 });
    store.setRoofConfig({ style: 'gable', material: 'felt', pitchDeg: 25, overhangM: 0.3 });
    const original = usePropertyStore.getState().property;
    const restored = normaliseLoadedProperty(JSON.parse(JSON.stringify(original)));
    expect(restored.levels).toEqual(original.levels);
    expect(restored.stairs).toEqual(original.stairs);
    expect(restored.roof).toEqual(original.roof);
    expect(restored.activeRoomId).toBe(original.activeRoomId);
    const bad = normaliseLoadedProperty({
      ...original, levels: original.levels!.map((level) => ({ ...level, heightM: NaN, elevationM: Infinity })),
      stairs: [{ ...original.stairs![0], toLevelId: 'missing' }],
    });
    expect(bad.levels?.every((level) => level.heightM === undefined && level.elevationM === undefined)).toBe(true);
    expect(bad.stairs).toBeUndefined();
    const outsideRoom = normaliseLoadedProperty({ ...original, stairs: original.stairs!.map((stair) => ({ ...stair, x: 100 })) });
    expect(outsideRoom.stairs?.[0].x).toBe(100);
  });
});
