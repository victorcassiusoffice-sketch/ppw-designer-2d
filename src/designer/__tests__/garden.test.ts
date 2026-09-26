import { describe, expect, it } from 'vitest';
import {
  fenceLengthM, gardenElevationAt, gardenPoints, gardenRectFromPoints, gardenSurfacePolygon, moveGardenFence, normaliseGarden,
  type Garden, type GardenFence,
} from '../garden';

const garden: Garden = {
  surfaces: [{ id: 'bed', kind: 'soil', x: 2, y: 3, widthM: 4, depthM: 2, elevationM: 0.5 }],
  fences: [{ id: 'fence', a: { x: 0, y: 0 }, b: { x: 3, y: 4 }, heightM: 1.2, material: 'timber' }],
};

describe('garden geometry and untrusted saves', () => {
  it('resizes from either drag direction while retaining an exact minimum and rejecting accidental taps', () => {
    expect(gardenRectFromPoints({ x: 5, y: 8 }, { x: 1, y: 2 })).toEqual({ x: 1, y: 2, widthM: 4, depthM: 6 });
    expect(gardenRectFromPoints({ x: 1, y: 2 }, { x: 5, y: 8 })).toEqual({ x: 1, y: 2, widthM: 4, depthM: 6 });
    expect(gardenRectFromPoints({ x: 2.1, y: 3.1 }, { x: 2.3, y: 3.3 })).toMatchObject({ widthM: 0.2, depthM: 0.2 });
    expect(gardenRectFromPoints({ x: 1, y: 2 }, { x: 1.02, y: 2.03 })).toBeNull();
    expect(gardenRectFromPoints({ x: 1, y: 2 }, { x: Infinity, y: 2 })).toBeNull();
    expect(gardenRectFromPoints({ x: 0, y: 0 }, { x: 501, y: 2 })).toBeNull();
  });
  it('preserves valid raised terrain and fences, dropping malformed and duplicate elements independently', () => {
    const dirty = {
      surfaces: [...garden.surfaces, { ...garden.surfaces[0], id: 'invalid', widthM: NaN }, { ...garden.surfaces[0] }],
      fences: [...garden.fences, { ...garden.fences[0], id: 'bed' }, { ...garden.fences[0], id: 'zero', b: { x: 0, y: 0 } }],
    };
    expect(normaliseGarden(dirty)).toEqual(garden);
    expect(normaliseGarden({ surfaces: [], fences: [] })).toBeUndefined();
    expect(normaliseGarden({ surfaces: [{ ...garden.surfaces[0], elevationM: Infinity }] })).toBeUndefined();
  });

  it('provides plan corners, camera bounds and raised ground under a fence', () => {
    expect(gardenSurfacePolygon(garden.surfaces[0])).toEqual([{ x: 2, y: 3 }, { x: 6, y: 3 }, { x: 6, y: 5 }, { x: 2, y: 5 }]);
    expect(gardenPoints(garden)).toHaveLength(6);
    expect(gardenElevationAt(garden, { x: 3, y: 4 })).toBe(0.5);
    expect(gardenElevationAt(garden, { x: 0, y: 0 })).toBe(0);
  });

  it('moves a boundary by its centre while retaining its exact length and bearing', () => {
    const moved: GardenFence = { ...garden.fences[0], ...moveGardenFence(garden.fences[0], { x: 10, y: 10 }) };
    expect(fenceLengthM(moved)).toBe(5);
    expect(moved.b.x - moved.a.x).toBe(3);
    expect(moved.b.y - moved.a.y).toBe(4);
    expect((moved.a.x + moved.b.x) / 2).toBe(10);
    expect((moved.a.y + moved.b.y) / 2).toBe(10);
  });
});
