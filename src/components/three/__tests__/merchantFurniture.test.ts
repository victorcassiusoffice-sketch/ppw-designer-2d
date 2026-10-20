// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getProductById } from '../../../data/products';
import { MERCHANT_FURNITURE_REFERENCES } from '../../../data/merchantFurniture';
import { serviceProductById } from '../../../data/serviceProducts';
import { canRenderPlanModel, planModelSolid } from '../../../designer/planModel';
import { furniturePreview, disposeFurnitureTextures } from '../furniturePreview';
import { createServiceProductBody } from '../serviceProductPreview';

describe('source-linked merchant furniture in both views', () => {
  it.each(MERCHANT_FURNITURE_REFERENCES)('$productId: one published envelope for plan, collision and 3D', reference => {
    const product = getProductById(reference.productId)!;
    expect(product).toBeDefined();
    expect(product.dimensions_cm).toEqual(reference.dimensionsCm);
    expect(product.source_url).toBe(reference.sourceUrl);
    expect(product.price_on_request).toBe(true);
    expect(product.shopify_ready).toBe(false);
    expect(canRenderPlanModel(product)).toBe(true);
    const input = planModelSolid(product);
    const before = JSON.stringify(input);
    const model = furniturePreview(input)!;
    const bounds = new THREE.Box3().setFromObject(model, true);
    expect(bounds.min.toArray()).toEqual([0, 0, 0]);
    const size = bounds.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(product.dimensions_cm.length / 100, 7);
    expect(size.y).toBeCloseTo(product.dimensions_cm.height / 100, 7);
    expect(size.z).toBeCloseTo(product.dimensions_cm.width / 100, 7);
    expect(JSON.stringify(input)).toBe(before);
    expect(model.userData.approximatePreview).toBe(true);
    disposeFurnitureTextures(model);
  });

  it('Seville uses the identical detailed body in the ordinary and service views', () => {
    const definition = serviceProductById('espace-seville-garden-sofa')!;
    const body = createServiceProductBody(definition);
    const size = new THREE.Box3().setFromObject(body, true).getSize(new THREE.Vector3());
    expect(size.toArray()).toEqual([1.14, .87, .67]);
    expect(body.userData.previewParts.filter((name: string) => name === 'Seville seat cushion')).toHaveLength(2);
    expect(body.userData.previewParts).toContain('open back timber slat');
    expect(body.userData.pairedServiceProduct).toBe(true);
    expect(body.userData.furnitureTextures.length).toBeGreaterThan(0);
    disposeFurnitureTextures(body);
  });

  it.each(MERCHANT_FURNITURE_REFERENCES)('$productId: deterministic, bounded detail and no per-part draw calls', reference => {
    const input = planModelSolid(getProductById(reference.productId)!);
    const first = furniturePreview(input)!;
    const second = furniturePreview(input)!;
    const meshes = (body: THREE.Object3D) => {
      const found: THREE.Mesh[] = [];
      body.traverse(object => { if (object instanceof THREE.Mesh) found.push(object); });
      return found;
    };
    const a = meshes(first), b = meshes(second);
    expect(a.length).toBeLessThanOrEqual(4);
    expect(a.reduce((count, mesh) => count + mesh.geometry.getAttribute('position').count / 3, 0)).toBeLessThan(20000);
    for (let index = 0; index < a.length; index++) {
      expect(a[index].geometry.getAttribute('position').array).toEqual(b[index].geometry.getAttribute('position').array);
      expect(a[index].material).not.toBe(b[index].material);
      const material = a[index].material as THREE.MeshPhysicalMaterial;
      expect((material.map as THREE.DataTexture)?.image.width).toBe(256);
      expect((material.bumpMap as THREE.DataTexture)?.image.width).toBe(128);
      expect(material.vertexColors).toBe(true);
    }
    disposeFurnitureTextures(first); disposeFurnitureTextures(second);
  });
});
