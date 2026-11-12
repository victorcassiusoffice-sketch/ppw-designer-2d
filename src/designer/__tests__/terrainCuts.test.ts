import { describe, it, expect } from 'vitest';
import { editSoil, exposedSoil, validCuts } from '../terrainCuts';
import { groundHeight } from '../../walk/collision';
import { spawnAt } from '../../walk/placement';
import { createWalkWorld } from '../../walk/scene';
import type { Property } from '../../store/propertyStore';
import type { SceneSolids } from '../roomSolids';
describe('measured terrain excavation', () => {
  it('digs, deepens and fills exact metre cells, including negative coordinates', () => {
    const a = editSoil([], { x: -0.2, y: 2.7 }, 0, 0.25);
    expect(a[0]).toEqual({ id: '-1,2', x: -1, y: 2, topM: 0, depthM: 0.25 });
    const b = editSoil(a, { x: -0.1, y: 2.1 }, 6, 0.5);
    expect(b[0].depthM).toBe(0.75);
    expect(b[0].topM).toBe(0);
    expect(editSoil(b, { x: -0.1, y: 2.2 }, 0, -1)).toEqual([]);
    expect(validCuts([...b, ...b])).toBe(false);
  });
  it('removes the shared soil wall between adjacent excavations', () => {
    const a = editSoil([], { x: 0, y: 0 }, 0, 0.5),
      b = editSoil(a, { x: 1, y: 0 }, 0, 0.5);
    expect(exposedSoil(b).walls.length).toBe(6 * 18);
    expect(exposedSoil(b).floor.length).toBe(2 * 18);
  });
  it('collides with the measured bottom and retains the land beside it', () => {
    const property = {
      rooms: [],
      levels: [{ id: 'ground', index: 0, name: 'Ground' }],
      site: { widthM: 8, depthM: 8, originM: { x: -4, y: -4 } },
      terrainCuts: editSoil([], { x: 0, y: 0 }, 0, 0.75),
    } as unknown as Property;
    const solids = {
      floors: [],
      walls: [],
      items: [],
      roofs: [],
      stairs: [],
      gardenSite: property.site,
    } as unknown as SceneSolids;
    const world = createWalkWorld(solids, property);
    try {
      expect(groundHeight(world, 0.5, 0.5, 1, 3)).toBeCloseTo(-0.75, 3);
      expect(spawnAt(world, { x: 0.5, y: 0.5 }, 'ground')?.position.y).toBeCloseTo(-0.75, 2);
      expect(spawnAt(world, { x: -1, y: 1 }, 'ground')?.position.y).toBeCloseTo(0, 2);
    } finally {
      world.dispose();
    }
  });
});
