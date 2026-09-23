import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { disposeBuildingTextures, roofMesh, stairMesh } from '../buildingMeshes';
import type { BuildingStair, RoofConfig } from '../../../designer/building';

const stairs: BuildingStair = {
  id: 'stairs', fromLevelId: 'ground', toLevelId: 'first', x: 10, y: 20,
  widthM: 1, runM: 4, rotation: 0,
};
const rectangle = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 6 }, { x: 0, y: 6 }];
const roof: RoofConfig = { style: 'gable', material: 'felt', pitchDeg: 25, overhangM: 0.2 };

function assertFinite(group: THREE.Group): void {
  group.updateMatrixWorld(true);
  group.traverse((object) => {
    expect(object.matrixWorld.elements.every(Number.isFinite)).toBe(true);
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) expect(Array.from(mesh.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
  });
}

describe('stair mesh', () => {
  it('arrives at the exact next floor and preserves the plan footprint when rotated', () => {
    const group = stairMesh(stairs, 3, 2.88);
    const treads = group.children.filter((child) => child.name.startsWith('tread-'));
    expect(treads).toHaveLength(16);
    const lastTread = new THREE.Box3().setFromObject(treads[treads.length - 1]);
    // Before root world matrices update, tread bounds are local to the flight.
    expect(lastTread.max.y).toBeCloseTo(2.88, 5);
    const bounds = new THREE.Box3().setFromObject(group);
    expect(bounds.min.x).toBeCloseTo(9.5);
    expect(bounds.max.x).toBeCloseTo(10.5);
    expect(bounds.min.z).toBeCloseTo(18);
    expect(bounds.max.z).toBeCloseTo(22);
    expect(bounds.min.y).toBeCloseTo(3);
    const turned = stairMesh({ ...stairs, rotation: 90 }, 3, 2.88);
    const rotatedBounds = new THREE.Box3().setFromObject(turned);
    expect(rotatedBounds.min.x).toBeCloseTo(8);
    expect(rotatedBounds.max.x).toBeCloseTo(12);
    expect(rotatedBounds.min.z).toBeCloseTo(19.5);
    expect(rotatedBounds.max.z).toBeCloseTo(20.5);
    assertFinite(group);
    assertFinite(turned);
  });

  it('ascends toward positive plan y and rejects invalid dimensions safely', () => {
    const group = stairMesh(stairs, 0, 2.88);
    const low = group.getObjectByName('tread-0')!;
    const high = group.getObjectByName('tread-15')!;
    expect(high.position.z).toBeGreaterThan(low.position.z);
    expect(high.position.y).toBeGreaterThan(low.position.y);
    expect(stairMesh(stairs, 0, NaN).children).toHaveLength(0);
  });
});

describe('roof mesh', () => {
  it('disposes its owned textures once without disposing shared material maps', () => {
    const group = roofMesh(rectangle, 6, roof);
    const material = (group.getObjectByName('roof-covering') as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const mapDispose = vi.spyOn(material.map!, 'dispose');
    const bumpDispose = vi.spyOn(material.bumpMap!, 'dispose');
    const shared = new THREE.Texture();
    const sharedDispose = vi.spyOn(shared, 'dispose');
    group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: shared })));
    disposeBuildingTextures(group);
    disposeBuildingTextures(group);
    expect(mapDispose).toHaveBeenCalledTimes(1);
    expect(bumpDispose).toHaveBeenCalledTimes(1);
    expect(sharedDispose).not.toHaveBeenCalled();
  });

  it('keeps metre-scale overhang and computes the ridge height from the pitch', () => {
    const group = roofMesh(rectangle, 6, roof);
    const bounds = new THREE.Box3().setFromObject(group);
    expect(bounds.min.x).toBeCloseTo(-0.2);
    expect(bounds.max.x).toBeCloseTo(4.2);
    expect(bounds.min.z).toBeCloseTo(-0.2);
    expect(bounds.max.z).toBeCloseTo(6.2);
    expect(bounds.min.y).toBeCloseTo(6);
    expect(bounds.max.y).toBeCloseTo(6.08 + 2.2 * Math.tan(25 * Math.PI / 180), 5);
    assertFinite(group);
  });

  it('triangulates a concave roof without filling its missing garden corner', () => {
    const polygon = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 4 }, { x: 0, y: 4 }];
    const group = roofMesh(polygon, 3, { ...roof, overhangM: 0 });
    const top = group.getObjectByName('roof-covering') as THREE.Mesh;
    const positions = top.geometry.getAttribute('position');
    let projectedArea = 0;
    for (let i = 0; i < positions.count; i += 3) {
      const ax = positions.getX(i); const az = positions.getZ(i);
      const bx = positions.getX(i + 1); const bz = positions.getZ(i + 1);
      const cx = positions.getX(i + 2); const cz = positions.getZ(i + 2);
      projectedArea += Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax)) / 2;
    }
    expect(projectedArea).toBeCloseTo(7);
    assertFinite(group);
  });

  it('differentiates flat, gable and shed profiles and physical felt/tile/metal finishes', () => {
    const flat = roofMesh(rectangle, 3, { ...roof, style: 'flat', material: 'felt' });
    const shed = roofMesh(rectangle, 3, { ...roof, style: 'shed', material: 'metal' });
    const tiled = roofMesh(rectangle, 3, { ...roof, material: 'tile' });
    expect(new THREE.Box3().setFromObject(flat).max.y).toBeCloseTo(3.08);
    expect(new THREE.Box3().setFromObject(shed).max.y).toBeGreaterThan(new THREE.Box3().setFromObject(tiled).max.y);
    const material = (group: THREE.Group) => (group.getObjectByName('roof-covering') as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(material(flat).roughness).toBeGreaterThan(material(tiled).roughness);
    expect(material(tiled).roughness).toBeGreaterThan(material(shed).roughness);
    expect(material(shed).metalness).toBeGreaterThan(material(flat).metalness);
    expect(material(flat).map?.isTexture).toBe(true);
    expect(material(flat).bumpMap?.isTexture).toBe(true);
  });
});
