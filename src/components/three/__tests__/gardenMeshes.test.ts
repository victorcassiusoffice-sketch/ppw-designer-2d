import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { gardenMeshes } from '../gardenMeshes';

describe('garden meshes', () => {
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
