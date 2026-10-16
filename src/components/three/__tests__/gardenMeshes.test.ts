import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { gardenMeshes } from '../gardenMeshes';
import { DEFAULT_GARDEN_POOL } from '../../../designer/garden';

describe('garden meshes', () => {
  it('renders pool water and shell at their saved physical elevations, and an empty excavation when selected', () => {
    const surface = { id: 'pool', kind: 'pool' as const, x: 10, y: 3, widthM: 8, depthM: 4, elevationM: 0, pool: { ...DEFAULT_GARDEN_POOL } };
    const filled = gardenMeshes({ surfaces: [surface], fences: [] });
    expect(filled.getObjectByName('pool-water')?.position.y).toBeCloseTo(-.15);
    expect(filled.getObjectByName('pool-base')?.position.y).toBeCloseTo(-1.6);
    const dug = gardenMeshes({ surfaces: [{ ...surface, pool: { ...surface.pool, stage: 'excavation' } }], fences: [] });
    expect(dug.getObjectByName('pool-water')).toBeUndefined();
    expect(dug.getObjectByName('pool-base')).toBeUndefined();
    expect(dug.getObjectByName('pool-excavation-depth')).toBeDefined();
    expect(dug.getObjectByName('pool-excavation-bottom')?.position.y).toBeCloseTo(-1.71);
  });
  it('cuts a pool out of an earlier lawn and keeps curved surface area out of its bounding-box corners', () => {
    const pool = { id: 'pool', kind: 'pool' as const, x: 2, y: 2, widthM: 2, depthM: 2, elevationM: 0, pool: { ...DEFAULT_GARDEN_POOL } };
    const group = gardenMeshes({ surfaces: [{ id: 'ground', kind: 'concrete', x: 0, y: 0, widthM: 10, depthM: 10, elevationM: 0 }, pool], fences: [] });
    const floor = group.getObjectByName('garden-surface-ground')!.children[0] as THREE.Mesh;
    const positions = floor.geometry.getAttribute('position');
    let area = 0;
    for (let i = 0; i < positions.count; i += 3) area += Math.abs((positions.getX(i + 1) - positions.getX(i)) * (positions.getZ(i + 2) - positions.getZ(i)) - (positions.getX(i + 2) - positions.getX(i)) * (positions.getZ(i + 1) - positions.getZ(i))) / 2;
    expect(area).toBeCloseTo(100 - 2.4 * 2.4, 4);
  });
  it('renders raised terrain and a real-height fence in plan coordinates', () => {
    const group = gardenMeshes({
      surfaces: [{ id: 'bed', kind: 'soil', x: 2, y: 3, widthM: 4, depthM: 2, elevationM: 0.5 }],
      fences: [{ id: 'boundary', a: { x: 2, y: 3 }, b: { x: 6, y: 3 }, heightM: 1.2, material: 'timber' }],
    });
    group.updateMatrixWorld(true);
    expect(group.getObjectByName('garden-surface-bed')).toBeDefined();
    const fence = group.getObjectByName('garden-fence-boundary')!;
    const bounds = new THREE.Box3().setFromObject(fence);
    expect(bounds.min.x).toBeCloseTo(1.95);
    expect(bounds.max.x).toBeCloseTo(6.05);
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(1.26);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(0.1);
  });

  it('keeps large grass areas to a bounded number of instanced details', () => {
    const group = gardenMeshes({ surfaces: [{ id: 'lawn', kind: 'lawn', x: 0, y: 0, widthM: 100, depthM: 100, elevationM: 0 }], fences: [] });
    const counts: number[] = [];
    group.getObjectByName('garden-surface-lawn')!.traverse((object) => { if (object instanceof THREE.InstancedMesh) counts.push(object.count); });
    expect(counts).toEqual([1500]);
  });
});
