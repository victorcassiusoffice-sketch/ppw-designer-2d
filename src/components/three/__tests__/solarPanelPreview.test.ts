import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { solarPanelPreview } from '../solarPanelPreview';
import { mountRoofItem } from '../roofItems';
import { createRoofSurface, roofHeightAt, roofItemMount } from '../../../designer/roofSurface';
import { hasSolarPanelPreview } from '../../../data/solarPreview';
import type { ItemSolid } from '../../../designer/roomSolids';

const item: ItemSolid = { key: 'pv', instanceId: 'pv', productId: 'emcar-jinko-475', x0: 1, x1: 2.903, y0: 2, y1: 3.134,
  z0: 6, z1: 6.03, lengthM: 1.903, widthM: 1.134, heightM: 0.03, rotationDeg: 0, hex: '#334455' };
describe('Jinko dimensional solar preview', () => {
  it('uses the real 1903 x 1134 x 30 mm product size with dark upward-facing recessed cells and a frame', () => {
    const model = solarPanelPreview(item)!;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(1.903, 6); expect(size.z).toBeCloseTo(1.134, 6); expect(size.y).toBeCloseTo(0.03, 6);
    const cells = model.getObjectByName('solar-cells') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
    expect(cells.geometry.getAttribute('position').count).toBe(108 * 6 * 3);
    const normals = cells.geometry.getAttribute('normal');
    expect(Array.from({ length: normals.count }, (_, index) => normals.getY(index)).every((value) => value > 0.999)).toBe(true);
    expect(Math.max(cells.material.color.r, cells.material.color.g, cells.material.color.b)).toBeLessThan(0.03);
    expect(cells.material.metalness).toBeLessThan(0.1);
    expect(cells.userData.selectionKeepsColour).toBe(true);
    expect(model.getObjectByName('solar-frame')).toBeDefined();
    expect(model.userData.previewNote).toContain('Dimensional solar preview');
    expect(model.children).toHaveLength(4);
  });
  it('follows the roof slope without losing thickness or putting cells underneath it', () => {
    const surface = createRoofSurface([{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 10 }, { x: 0, y: 10 }], 6,
      { style: 'gable', material: 'felt', pitchDeg: 30, overhangM: 0.2 })!;
    const mount = roofItemMount(surface, item);
    const solid = { ...item, z0: mount.elevationM, z1: mount.elevationM + item.heightM, roofMount: mount };
    const model = mountRoofItem(solarPanelPreview(solid)!, solid);
    model.updateMatrixWorld(true);
    const cells = model.getObjectByName('solar-cells') as THREE.Mesh;
    const positions = cells.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(cells.matrixWorld);
      expect(point.y).toBeGreaterThan(roofHeightAt(surface, { x: point.x, y: point.z }));
    }
  });
  it('recognises merchant SKU aliases and leaves unrelated supplied models unchanged', () => {
    expect(hasSolarPanelPreview({ id: 'm-merchant-jinko', sku: 'EMCAR-SOLAR-JINKO-475' })).toBe(true);
    expect(solarPanelPreview({ ...item, productId: 'emcar-victron-175' })).toBeNull();
    expect(solarPanelPreview({ ...item, heightM: NaN })).toBeNull();
  });
});
