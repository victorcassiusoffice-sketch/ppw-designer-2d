import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { roofMesh } from '../buildingMeshes';
import { mountRoofItem, poseRoofItem, roofPointFromRay } from '../roofItems';
import { createRoofSurface, roofHeightAt, roofItemMount } from '../../../designer/roofSurface';
import type { RoofConfig } from '../../../designer/building';
import type { ItemSolid } from '../../../designer/roomSolids';

const polygon = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 9 }, { x: 0, y: 9 }];
const config: RoofConfig = { style: 'gable', material: 'felt', pitchDeg: 35, overhangM: 0.2 };
function item(x = 0.5): ItemSolid {
  const footprint = { x0: x, x1: x + 1.9, y0: 2, y1: 3.1 };
  const mount = roofItemMount(createRoofSurface(polygon, 6, config)!, footprint);
  return { ...footprint, key: 'pv', instanceId: 'pv', placement: 'roof', roofMount: mount, z0: mount.elevationM, z1: mount.elevationM + 0.03,
    lengthM: 1.9, widthM: 1.1, heightM: 0.03, rotationDeg: 0, hex: '#123456' };
}
function body(solid: ItemSolid): THREE.Object3D {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(solid.lengthM, solid.heightM, solid.widthM));
  mesh.position.y = solid.heightM / 2;
  root.add(mesh);
  root.position.set((solid.x0 + solid.x1) / 2, solid.z0, (solid.y0 + solid.y1) / 2);
  root.userData.instanceId = solid.instanceId;
  return root;
}
function vertices(root: THREE.Object3D): THREE.Vector3[] {
  root.updateMatrixWorld(true);
  const result: THREE.Vector3[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) result.push(new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld));
  });
  return result;
}
describe('roof mounted product geometry', () => {
  it.each([0.5, 2, 3.5])('keeps every thin panel vertex above the roof at x=%s without scaling catalog size', (x) => {
    const solid = item(x), raw = body(solid), before = vertices(raw);
    const mounted = mountRoofItem(raw, solid);
    const after = vertices(mounted);
    const surface = createRoofSurface(polygon, 6, config)!;
    expect(mounted.userData.instanceId).toBe('pv');
    after.forEach((point) => expect(point.y).toBeGreaterThan(roofHeightAt(surface, { x: point.x, y: point.z })));
    // Rigid rotation preserves every edge and diagonal of the product body.
    after.forEach((point, i) => expect(point.distanceTo(after[0])).toBeCloseTo(before[i].distanceTo(before[0]), 6));
  });
  it('moves a live preview to the opposite slope and restores its original mounting', () => {
    const first = item(), other = item(3.5), mounted = mountRoofItem(body(first), first);
    const firstNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(mounted.quaternion);
    poseRoofItem(mounted, other, other.roofMount!);
    expect(new THREE.Vector3(0, 1, 0).applyQuaternion(mounted.quaternion).x).toBeGreaterThan(0);
    expect(mounted.position.x).toBeCloseTo((other.x0 + other.x1) / 2);
    poseRoofItem(mounted, first, first.roofMount!);
    expect(new THREE.Vector3(0, 1, 0).applyQuaternion(mounted.quaternion).x).toBeCloseTo(firstNormal.x);
  });
  it('keeps an arbitrarily rotated catalog body rigid and entirely above a sloped face', () => {
    const solid = item(0.1);
    solid.rotationDeg = 45;
    solid.x1 = solid.x0 + (solid.lengthM + solid.widthM) / Math.sqrt(2);
    solid.y1 = solid.y0 + (solid.lengthM + solid.widthM) / Math.sqrt(2);
    const surface = createRoofSurface(polygon, 6, config)!;
    solid.roofMount = roofItemMount(surface, solid);
    solid.z0 = solid.roofMount.elevationM;
    const raw = body(solid);
    raw.rotation.y = -Math.PI / 4;
    const before = vertices(raw);
    const after = vertices(mountRoofItem(raw, solid));
    after.forEach((point, index) => {
      expect(point.y).toBeGreaterThan(roofHeightAt(surface, { x: point.x, y: point.z }));
      expect(point.distanceTo(after[0])).toBeCloseTo(before[index].distanceTo(before[0]), 6);
    });
  });
  it.each(['flat', 'gable', 'shed'] as const)('picks the visible %s covering at an oblique angle instead of the underlying slab', (style) => {
    const roof = roofMesh(polygon, 6, { ...config, style });
    roof.updateMatrixWorld(true);
    const surface = createRoofSurface(polygon, 6, { ...config, style })!;
    const target = new THREE.Vector3(1.2, roofHeightAt(surface, { x: 1.2, y: 4 }), 4);
    const origin = target.clone().add(new THREE.Vector3(-2, 5, -3));
    const point = roofPointFromRay(new THREE.Raycaster(origin, target.clone().sub(origin).normalize()), [roof]);
    expect(point?.x).toBeCloseTo(1.2, 5);
    expect(point?.y).toBeCloseTo(4, 5);
    expect(roofPointFromRay(new THREE.Raycaster(new THREE.Vector3(1, 0, 4), new THREE.Vector3(0, 1, 0)), [roof])).toBeNull();
    expect(roofPointFromRay(new THREE.Raycaster(new THREE.Vector3(20, 20, 4), new THREE.Vector3(0, -1, 0)), [roof])).toBeNull();
  });
});
