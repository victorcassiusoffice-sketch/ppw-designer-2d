// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ecoTreeMeshes } from '../ecoTrees';
import { type EcoTree, ECO_LIMITS } from '../../../designer/eco';

const tree: EcoTree = { id: 'tree-1', name: 'Surveyed tree', x: 12, y: -6, heightM: 8, canopyRadiusM: 3, stemDiameterMm: 240, status: 'existing', protectionMethod: 'unconfirmed' };
describe('paired measured tree geometry', () => {
  it('matches the plan canopy diameter and entered height in world metres', () => {
    const group = ecoTreeMeshes([tree]);
    const bounds = new THREE.Box3().setFromObject(group);
    expect(bounds.min.x).toBeCloseTo(tree.x - tree.canopyRadiusM, 5);
    expect(bounds.max.x).toBeCloseTo(tree.x + tree.canopyRadiusM, 5);
    expect(bounds.min.z).toBeCloseTo(tree.y - tree.canopyRadiusM, 5);
    expect(bounds.max.z).toBeCloseTo(tree.y + tree.canopyRadiusM, 5);
    expect(bounds.min.y).toBeCloseTo(0, 5); expect(bounds.max.y).toBeCloseTo(tree.heightM, 5);
  });
  it('bounds city-scale tree rendering to two instanced draw groups and the schema cap', () => {
    const group = ecoTreeMeshes(Array.from({ length: ECO_LIMITS.trees + 1 }, (_, index) => ({ ...tree, id: `tree-${index}`, x: index * 4 })));
    expect(group.children).toHaveLength(2);
    const [trunks, crowns] = group.children as THREE.InstancedMesh[];
    expect(trunks.count).toBe(ECO_LIMITS.trees); expect(crowns.count).toBe(ECO_LIMITS.trees * 5);
    expect(group.children.every(child => child.castShadow && child.receiveShadow)).toBe(true);
  });
  it('places trees on the same raised garden surface as the ground model', () => {
    const group = ecoTreeMeshes([tree], { surfaces: [{ id: 'raised', kind: 'lawn', x: 10, y: -8, widthM: 5, depthM: 5, elevationM: 1.2 }], fences: [] });
    const bounds = new THREE.Box3().setFromObject(group);
    expect(bounds.min.y).toBeCloseTo(1.2, 5); expect(bounds.max.y).toBeCloseTo(9.2, 5);
  });
});
