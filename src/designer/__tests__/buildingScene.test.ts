import { describe, expect, it } from 'vitest';
import type { Property } from '../../store/propertyStore';
import { buildingSolids } from '../buildingScene';
import { levelsOf, roomsOnLevel, activeLevelIdOf, isRoofRoom } from '../levels';
import type { SceneInput } from '../roomView3d';
import type { BuildingStair } from '../building';

const rectangle = (x = 0, width = 8) => [{ x, y: 0 }, { x: x + width, y: 0 }, { x: x + width, y: 8 }, { x, y: 8 }];
const stair: BuildingStair = { id: 's', fromLevelId: 'ground', toLevelId: 'first', x: 3, y: 4, widthM: 1, runM: 5, rotation: 0 };

function property(): Property {
  return {
    id: 'p', name: 'Building', activeRoomId: 'upper', activeLevelId: 'first',
    levels: [{ id: 'ground', index: 0, name: 'Ground', heightM: 3 }, { id: 'first', index: 1, name: 'First', heightM: 4 }, { id: 'roof', index: 2, kind: 'roof', name: 'Roof' }],
    rooms: [
      { id: 'lower', name: 'Lower', polygon: rectangle(), placedItems: [] },
      { id: 'upper', name: 'Upper', levelId: 'first', polygon: rectangle(), placedItems: [{ instanceId: 'lamp', productId: 'lamp', x: 1, y: 1, rotation: 0 }], openings: [{ id: 'window', kind: 'window', edgeIndex: 0, offsetM: 2, widthM: 1.2, sillM: 0.9, flipFacing: false, flipHand: false }] },
      { id: 'roof-upper', name: 'Roof', levelId: 'roof', kind: 'roof', polygon: rectangle(), placedItems: [{ instanceId: 'roof-item', productId: 'item', x: 1, y: 1, rotation: 0 }] },
    ],
    stairs: [stair],
  };
}

/** Catalog-independent source mapper with the same level filtering used by the UI. */
function sceneForLevel(p: Property): SceneInput {
  return {
    wallHeightM: p.wallHeightM ?? 2.7,
    cameraPos: { x: 10, y: 10, z: 8 }, cameraTarget: { x: 4, y: 4, z: 0 },
    rooms: roomsOnLevel(p.rooms, activeLevelIdOf(p)).map((room) => ({
      id: room.id, name: room.name, polygon: room.polygon, kind: isRoofRoom(room) ? 'outdoor' : room.kind,
      openings: room.openings,
      items: room.placedItems.map((item) => ({
        ...item, lengthCm: 40, widthCm: 40, heightCm: 50, placement: 'wall', mountHeightCm: 120, lightMountM: 1.8,
      })),
    })),
  };
}

describe('assembled building solids', () => {
  it('stacks floors with their own heights, elevations, windows and item/light mount heights', () => {
    const solids = buildingSolids(property(), sceneForLevel, 'building', true);
    expect(solids.floors.map((floor) => floor.levelId)).toEqual(['ground', 'first', 'roof']);
    expect(solids.floors[0].elevationM).toBe(0);
    expect(solids.floors[1].elevationM).toBeCloseTo(3.18);
    expect(solids.floors[2].elevationM).toBeCloseTo(7.36);
    expect(solids.walls.filter((wall) => wall.levelId === 'ground').every((wall) => wall.heightM === 3 && wall.elevationM === 0)).toBe(true);
    expect(solids.walls.filter((wall) => wall.levelId === 'first').every((wall) => wall.heightM === 4 && wall.elevationM === 3.18)).toBe(true);
    expect(solids.walls.find((wall) => wall.key === 'wall-upper-0')?.openings[0]).toMatchObject({ bottomM: 0.9, topM: 2.1 });
    const lamp = solids.items.find((item) => item.instanceId === 'lamp')!;
    expect(lamp.z0).toBeCloseTo(4.38);
    expect(lamp.z1).toBeCloseTo(4.88);
    expect(lamp.lightMountM).toBeCloseTo(4.98);
    expect(solids.roofs).toHaveLength(1);
    expect(solids.walls.some((wall) => wall.levelId === 'roof')).toBe(false);
    expect(solids.stairs?.[0]).toMatchObject({ baseM: 0, riseM: 3.18 });
    expect(solids.floors.find((floor) => floor.levelId === 'first')?.holes).toHaveLength(1);
  });

  it('keeps coincident walls independent across floors and resolves neighbours only within a floor', () => {
    const p = property();
    expect(buildingSolids(p, sceneForLevel, 'building', false).walls.every((wall) => !wall.shared)).toBe(true);
    p.rooms.push({ id: 'extension', name: 'Extension', polygon: rectangle(8, 4), placedItems: [] });
    const solids = buildingSolids(p, sceneForLevel, 'building', false);
    expect(solids.walls.find((wall) => wall.key === 'wall-lower-1')?.shared).toBe(true);
    expect(solids.walls.find((wall) => wall.key === 'wall-upper-1')?.shared).toBe(false);
  });

  it('hides the entire roof while keeping a selected floor at its real elevation', () => {
    const whole = buildingSolids(property(), sceneForLevel, 'building', false);
    expect(whole.floors.some((floor) => floor.levelId === 'roof')).toBe(false);
    expect(whole.items.some((item) => item.instanceId === 'roof-item')).toBe(false);
    expect(whole.roofs).toEqual([]);
    const floor = buildingSolids(property(), sceneForLevel, 'floor', false);
    expect(floor.floors).toHaveLength(1);
    expect(floor.floors[0].levelId).toBe('first');
    expect(floor.activeLevelId).toBe('first');
    expect(floor.activeElevationM).toBeCloseTo(3.18);
    expect(floor.stairs?.[0].baseM).toBe(0);
    const roof = buildingSolids({ ...property(), activeLevelId: 'roof', activeRoomId: 'roof-upper' }, sceneForLevel, 'floor', false);
    expect(roof.floors[0].levelId).toBe('roof');
    expect(roof.roofs).toEqual([]);
  });

  it.each(['flat', 'gable', 'shed'] as const)('keeps thin PV panels accessible on the roof editing slab with a %s covering configured', (style) => {
    const p = { ...property(), activeLevelId: 'roof', activeRoomId: 'roof-upper' };
    p.roof = { style, material: 'felt', pitchDeg: 25, overhangM: 0.25 };
    const withPanel = (source: Property): SceneInput => {
      const scene = sceneForLevel(source);
      return { ...scene, rooms: scene.rooms.map((room) => ({ ...room, items: (room.items ?? []).map((item) =>
        item.instanceId === 'roof-item'
          ? { ...item, lengthCm: 190.3, widthCm: 113.4, heightCm: 3, placement: 'roof' }
          : item,
      ) })) };
    };
    const editing = buildingSolids(p, withPanel, 'floor', true);
    const panel = editing.items.find((item) => item.instanceId === 'roof-item')!;
    expect(editing.floors).toHaveLength(1);
    expect(editing.floors[0].levelId).toBe('roof');
    expect(panel.z0).toBeCloseTo(editing.activeElevationM!);
    // The stage applies a minimum visible item height; this panel still sits
    // wholly below the 8 cm flat roof covering without the editing cutaway.
    expect(panel.z1 - panel.z0).toBeGreaterThan(0);
    expect(panel.z1 - panel.z0).toBeLessThan(0.08);
    expect(editing.roofs).toEqual([]);
    expect(buildingSolids(p, withPanel, 'building', true).roofs).toHaveLength(1);
  });

  it('preserves invalid saved placements for repair but cuts no overlapping or out-of-room holes', () => {
    const p = property();
    p.stairs = [stair, { ...stair, id: 'other', x: 3.2 }];
    const before = JSON.stringify(p);
    const solids = buildingSolids(p, sceneForLevel, 'building', false);
    expect(solids.stairs).toHaveLength(2);
    expect(solids.floors.every((floor) => floor.holes?.length === 0)).toBe(true);
    expect(JSON.stringify(p)).toBe(before);
    p.stairs = [{ ...stair, x: 100 }];
    expect(buildingSolids(p, sceneForLevel, 'building', false).floors.every((floor) => floor.holes?.length === 0)).toBe(true);
    expect(levelsOf(p)).toHaveLength(3);
  });

  it('includes landscaping in the whole building or ground-floor view, with only ground rooms as obstacles', () => {
    const p = property();
    p.garden = { surfaces: [{ id: 'lawn', kind: 'lawn', x: -2, y: -2, widthM: 12, depthM: 12, elevationM: 0 }], fences: [] };
    const whole = buildingSolids(p, sceneForLevel, 'building', false);
    expect(whole.garden).toBe(p.garden);
    expect(whole.gardenObstacles).toEqual([p.rooms[0].polygon]);
    expect(buildingSolids(p, sceneForLevel, 'floor', false).garden).toBeUndefined();
    expect(buildingSolids({ ...p, activeLevelId: 'ground' }, sceneForLevel, 'floor', false).garden).toBe(p.garden);
  });
});
