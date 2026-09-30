// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MAURITIUS_OUTDOOR_PRODUCTS } from '../../../data/mauritiusOutdoor';
import { furniturePreviewKind } from '../../../data/dimensionalPreview';
import type { ItemSolid } from '../../../designer/roomSolids';
import { rotatedFootprint } from '../../../lib/geometry';
import { disposeFurnitureTextures, furniturePreview } from '../furniturePreview';

function solid(id: string, rotationDeg = 0): ItemSolid {
  const product = MAURITIUS_OUTDOOR_PRODUCTS.find(candidate => candidate.id === id)!;
  const { length, width, height } = product.dimensions_cm;
  const lengthM = length / 100, widthM = width / 100, heightM = height / 100;
  const fp = rotatedFootprint({ lengthM, widthM }, rotationDeg);
  return { key: id, instanceId: id, productId: id, x0: 10, y0: 7, x1: 10 + fp.w, y1: 7 + fp.h,
    z0: 0.04, z1: heightM + 0.04, lengthM, widthM, heightM, rotationDeg, hex: '#888888' };
}

describe('Mauritius outdoor product planning bodies', () => {
  it('keeps all five actual supplier envelopes at catalog centimetres, including the closed extension table', () => {
    expect(MAURITIUS_OUTDOOR_PRODUCTS).toHaveLength(5);
    for (const product of MAURITIUS_OUTDOOR_PRODUCTS) for (const rotation of [0, 90, 180, 270]) {
      const input = solid(product.id, rotation);
      const body = furniturePreview(input)!;
      const bounds = new THREE.Box3().setFromObject(body, true);
      expect(bounds.min.x, product.id).toBeCloseTo(input.x0, 5);
      expect(bounds.max.x, product.id).toBeCloseTo(input.x1, 5);
      expect(bounds.min.z, product.id).toBeCloseTo(input.y0, 5);
      expect(bounds.max.z, product.id).toBeCloseTo(input.y1, 5);
      expect(bounds.min.y, product.id).toBeCloseTo(input.z0, 5);
      expect(bounds.max.y, product.id).toBeCloseTo(input.z1, 5);
      expect(body.userData.approximatePreview).toBe(true);
      expect(body.userData.previewKind).toBe(furniturePreviewKind(product.id));
      let draws = 0;
      body.traverse(object => { if (object instanceof THREE.Mesh) draws++; });
      expect(draws).toBeLessThanOrEqual(3);
      disposeFurnitureTextures(body);
    }
  });

  it('keeps obliquely rotated outdoor objects within their Plan collision envelopes', () => {
    for (const product of MAURITIUS_OUTDOOR_PRODUCTS) {
      const input = solid(product.id, 37);
      const body = furniturePreview(input)!;
      const bounds = new THREE.Box3().setFromObject(body, true);
      expect(bounds.min.x).toBeGreaterThanOrEqual(input.x0 - 1e-5);
      expect(bounds.max.x).toBeLessThanOrEqual(input.x1 + 1e-5);
      expect(bounds.min.z).toBeGreaterThanOrEqual(input.y0 - 1e-5);
      expect(bounds.max.z).toBeLessThanOrEqual(input.y1 + 1e-5);
      disposeFurnitureTextures(body);
    }
  });

  it('distinguishes material and silhouette instead of using textured cuboids', () => {
    const table = furniturePreview(solid('mrbricolage-mistral-70'))!;
    expect(table.userData.previewParts.filter((name: string) => name === 'folding cross leg')).toHaveLength(4);
    const tableMaterials: THREE.MeshStandardMaterial[] = [];
    table.traverse(object => { if (object instanceof THREE.Mesh) tableMaterials.push(object.material as THREE.MeshStandardMaterial); });
    expect(tableMaterials.find(material => material.name === 'garden table top')?.metalness).toBe(0.65);
    const armchair = furniturePreview(solid('jkalachand-1798-e'))!;
    const chair = furniturePreview(solid('jkalachand-1799-w'))!;
    expect(armchair.userData.previewParts.filter((name: string) => name === 'armrest')).toHaveLength(2);
    expect(chair.userData.previewParts).not.toContain('armrest');
    chair.traverse(object => {
      if (object instanceof THREE.Mesh) expect((object.material as THREE.MeshStandardMaterial).metalness).toBe(0);
    });
    const swing = furniturePreview(solid('jkalachand-gs1004-swing'))!;
    expect(swing.userData.previewParts.filter((name: string) => name === 'individual outdoor seat cushion')).toHaveLength(3);
    expect(swing.userData.previewParts.filter((name: string) => name === 'sloped fabric canopy')).toHaveLength(2);
    for (const body of [table, armchair, chair, swing]) disposeFurnitureTextures(body);
  });
});
