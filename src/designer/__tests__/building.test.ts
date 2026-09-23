import { describe, expect, it } from 'vitest';
import {
  buildingLevels,
  FLOOR_SLAB_THICKNESS_M,
  levelElevationM,
  normaliseBuildingStairs,
  normaliseRoofConfig,
  stairFootprint,
  stairRiseM,
  stairStepCount,
  type BuildingStair,
} from '../building';
import { groundLevel, roofLevel, type Level } from '../levels';

const first: Level = { id: 'first', index: 1, name: 'First' };
const second: Level = { id: 'second', index: 7, name: 'Second' };
const property = { levels: [groundLevel(), first, second] };
const stair: BuildingStair = {
  id: 'stairs', fromLevelId: 'ground', toLevelId: 'first', x: 2, y: 4,
  widthM: 1, runM: 4, rotation: 0,
};

describe('building elevations', () => {
  it('preserves old single-storey geometry without writing defaults', () => {
    const legacy = {};
    expect(buildingLevels(legacy)).toEqual([{
      level: groundLevel(), elevationM: 0, heightM: 2.7, slabThicknessM: FLOOR_SLAB_THICKNESS_M,
    }]);
    expect(legacy).toEqual({});
  });

  it('stacks adjacent levels even when indexes have gaps after deletion', () => {
    expect(levelElevationM(property, 'first')).toBeCloseTo(2.88);
    expect(levelElevationM(property, 'second')).toBeCloseTo(5.76);
  });

  it('propagates clear heights and explicit elevations to subsequent automatic floors', () => {
    const p = { levels: [{ ...groundLevel(), heightM: 3 }, { ...first, elevationM: 4, heightM: 3.2 }, second] };
    const levels = buildingLevels(p);
    expect(levels.map((l) => l.elevationM)).toEqual([0, 4, 7.38]);
    expect(levels.map((l) => l.heightM)).toEqual([3, 3.2, 2.7]);
  });

  it('places roof slabs above the highest drawn floor, ignoring empty levels', () => {
    const p = {
      ...property,
      levels: [...property.levels, roofLevel(property.levels)],
      rooms: [{ id: 'r', name: 'R', polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }], placedItems: [] }],
    };
    expect(levelElevationM(p, 'roof')).toBeCloseTo(2.88);
    p.rooms[0] = { ...p.rooms[0], ...{ levelId: 'first' } };
    expect(levelElevationM(p, 'roof')).toBeCloseTo(5.76);
  });
});

describe('stairs', () => {
  it('resolves rise from floor elevations and returns a rotated footprint for slab openings', () => {
    expect(stairRiseM(property, stair)).toBeCloseTo(2.88);
    expect(stairStepCount(property, stair)).toBe(16);
    expect(stairFootprint(stair)).toEqual([{ x: 1.5, y: 2 }, { x: 2.5, y: 2 }, { x: 2.5, y: 6 }, { x: 1.5, y: 6 }]);
    const rotated = stairFootprint({ ...stair, rotation: 90 });
    expect(rotated[0].x).toBeCloseTo(4);
    expect(rotated[0].y).toBeCloseTo(3.5);
  });

  it('rejects missing/deleted destinations, downward stairs, non-finite dimensions and duplicate IDs', () => {
    const out = normaliseBuildingStairs([
      { ...stair, id: 'unknown', toLevelId: 'deleted' },
      { ...stair, id: 'down', fromLevelId: 'first', toLevelId: 'ground' },
      { ...stair, id: 'invalid', widthM: Infinity },
      { ...stair, rotation: -90 }, stair,
    ], property);
    expect(out).toEqual([{ ...stair, rotation: 270 }]);
  });

  it('preserves a previously built flight after changing the storey height', () => {
    const taller = { levels: [{ ...groundLevel(), heightM: 5 }, first] };
    expect(normaliseBuildingStairs([stair], taller)).toEqual([stair]);
  });
});

describe('roof configuration', () => {
  it('preserves felt and clamps extreme geometry without introducing prices or products', () => {
    expect(normaliseRoofConfig({ style: 'gable', material: 'felt', pitchDeg: 90, overhangM: -1 }))
      .toEqual({ style: 'gable', material: 'felt', pitchDeg: 60, overhangM: 0 });
    expect(normaliseRoofConfig({ style: 'unknown', material: 'felt' })).toBeUndefined();
  });
});
