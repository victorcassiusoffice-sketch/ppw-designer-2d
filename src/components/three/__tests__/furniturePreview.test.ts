import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { COURTS_PRODUCTS } from '../../../demo/courts';
import { TINTEX_DEMO } from '../../../demo/tintex';
import { FURNITURE_PREVIEW_NOTE, hasFurniturePreview } from '../../../data/dimensionalPreview';
import { rotatedFootprint } from '../../../lib/geometry';
import type { ItemSolid } from '../../../designer/roomSolids';
import { disposeFurnitureTextures, furniturePreview } from '../furniturePreview';

function solid(productId: string, rotationDeg = 0, z0 = 3.2): ItemSolid {
  const p = COURTS_PRODUCTS.find((product) => product.id === productId)!;
  const [lengthM, widthM, heightM] = [p.dimensions_cm.length, p.dimensions_cm.width, p.dimensions_cm.height].map((cm) => cm / 100);
  const fp = rotatedFootprint({ lengthM, widthM }, rotationDeg);
  return { key: `item-${productId}`, instanceId: productId, productId, x0: 2, y0: 4, x1: 2 + fp.w, y1: 4 + fp.h, z0, z1: z0 + heightM, rotationDeg, lengthM, widthM, heightM, hex: '#929292', frontEdge: p.front_edge };
}

function meshes(root: THREE.Object3D): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] {
  const result: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
  root.traverse((object) => { if ((object as THREE.Mesh).isMesh) result.push(object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>); });
  return result;
}

describe('existing-product dimensional furniture previews', () => {
  it('fits every supported catalog product to its exact size and raised floor without mutating inputs', () => {
    const supported = COURTS_PRODUCTS.filter((p) => hasFurniturePreview(p.id));
    expect(supported).toHaveLength(17);
    for (const p of supported) for (const rotation of [0, 90, 180, 270]) {
      const input = solid(p.id, rotation);
      const saved = JSON.stringify(input);
      const preview = furniturePreview(input)!;
      const bounds = new THREE.Box3().setFromObject(preview);
      expect(bounds.min.x, p.id).toBeCloseTo(input.x0, 5);
      expect(bounds.max.x, p.id).toBeCloseTo(input.x1, 5);
      expect(bounds.min.z, p.id).toBeCloseTo(input.y0, 5);
      expect(bounds.max.z, p.id).toBeCloseTo(input.y1, 5);
      expect(bounds.min.y, p.id).toBeCloseTo(input.z0, 5);
      expect(bounds.max.y, p.id).toBeCloseTo(input.z1, 5);
      expect(JSON.stringify(input)).toBe(saved);
      expect(preview.userData.instanceId).toBe(input.instanceId);
      expect(preview.userData.approximatePreview).toBe(true);
      expect(preview.userData.previewNote).toBe(FURNITURE_PREVIEW_NOTE);
      // Many shaped components merged to a small per-material draw count.
      expect(preview.userData.previewParts.length).toBeGreaterThan(1);
      expect(meshes(preview).length).toBeLessThanOrEqual(6);
      expect(meshes(preview).every((mesh) => mesh.castShadow && mesh.receiveShadow)).toBe(true);
      disposeFurnitureTextures(preview);
    }
  });

  it('keeps rotated bodies inside their collision footprint, including a left-facing catalog front', () => {
    for (const rotation of [23, 37, 127]) {
      const input = { ...solid('courts-mika-bed-160', rotation), frontEdge: 'left' as const };
      const preview = furniturePreview(input)!;
      const bounds = new THREE.Box3().setFromObject(preview);
      expect(bounds.min.x).toBeGreaterThanOrEqual(input.x0 - 0.00001);
      expect(bounds.max.x).toBeLessThanOrEqual(input.x1 + 0.00001);
      expect(bounds.min.z).toBeGreaterThanOrEqual(input.y0 - 0.00001);
      expect(bounds.max.z).toBeLessThanOrEqual(input.y1 + 0.00001);
      expect(preview.rotation.y).toBeCloseTo(-rotation * Math.PI / 180);
      expect(bounds.min.y).toBeCloseTo(input.z0, 5);
      disposeFurnitureTextures(preview);
    }
  });

  it('creates recognisable sofa, bed, chair and six-seat dining components instead of a closed box', () => {
    const cases = [
      ['courts-marco-sofa-corner', 'individual seat cushion', 3],
      ['courts-mika-bed-160', 'pillow', 2],
      ['courts-gessica-dining-6', 'dining chair seat', 6],
      ['courts-stellar-celosia-chair', 'caster', 5],
      ['courts-malden-bookshelf', 'open shelf', 4],
    ] as const;
    for (const [id, part, count] of cases) {
      const preview = furniturePreview(solid(id))!;
      expect(preview.userData.previewParts.filter((name: string) => name === part)).toHaveLength(count);
      disposeFurnitureTextures(preview);
    }
    const table = furniturePreview(solid('courts-perera-coffee-table', 0, 0))!;
    table.updateMatrixWorld(true);
    // There is real air below the table, rather than an art box filling it.
    const ray = new THREE.Raycaster(new THREE.Vector3(2.6, 0.1, 6), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(table, true)).toHaveLength(0);
    disposeFurnitureTextures(table);
  });

  it('owns per-instance geometry/material/maps so selection and disposal cannot damage another copy', () => {
    const first = furniturePreview(solid('courts-marco-sofa-corner'))!;
    const second = furniturePreview({ ...solid('courts-marco-sofa-corner'), instanceId: 'second-sofa' })!;
    const a = meshes(first);
    const b = meshes(second);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].geometry).not.toBe(b[i].geometry);
      expect(a[i].material).not.toBe(b[i].material);
      a[i].material.emissive.set('#ff0000');
      expect(b[i].material.emissive.getHexString()).toBe('000000');
    }
    const textures = first.userData.furnitureTextures as THREE.Texture[];
    const otherTextures = second.userData.furnitureTextures as THREE.Texture[];
    expect(textures.length).toBeGreaterThan(0);
    expect(textures.every((texture) => !otherTextures.includes(texture))).toBe(true);
    const disposed = textures.map((texture) => vi.spyOn(texture, 'dispose'));
    const untouched = otherTextures.map((texture) => vi.spyOn(texture, 'dispose'));
    disposeFurnitureTextures(first);
    disposeFurnitureTextures(first);
    disposed.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    untouched.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    disposeFurnitureTextures(second);
  });

  it('does not fabricate a preview for another merchant, an unknown product, or invalid dimensions', () => {
    const input = solid('courts-mika-bed-160');
    for (const productId of [undefined, 'new-bed', 'demo-console', 'toString', ...TINTEX_DEMO.products.map((p) => p.id)]) {
      expect(hasFurniturePreview(productId)).toBe(false);
      expect(furniturePreview({ ...input, productId })).toBeNull();
    }
    expect(furniturePreview({ ...input, heightM: 0 })).toBeNull();
    expect(furniturePreview({ ...input, widthM: NaN })).toBeNull();
  });
});
