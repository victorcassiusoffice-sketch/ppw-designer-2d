import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { waterTankPreview } from '../waterTankPreview';
import type { ItemSolid } from '../../../designer/roomSolids';
import { getProductById } from '../../../data/products';
import { macroOf } from '../../mobile/catalogMacros';
import { catalogPrice } from '../../catalogPresentation';

const item: ItemSolid = { key: 'tank', instanceId: 'tank', productId: 'duraco-water-tank-1000', x0: 2, x1: 3.14,
  y0: 4, y1: 5.14, z0: 0, z1: 1.305, lengthM: 1.14, widthM: 1.14, heightM: 1.305, rotationDeg: 0, hex: '#52624b' };

describe('Duraco dimensional water tank', () => {
  it('preserves the manufacturer envelope and ground contact while showing a ribbed tank, lid and outlet', () => {
    const model = waterTankPreview(item)!;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(1.14, 6); expect(size.z).toBeCloseTo(1.14, 6); expect(size.y).toBeCloseTo(1.305, 6);
    expect(bounds.min.y).toBeCloseTo(0, 6);
    expect(model.getObjectByName('tank-ribbed-body')).toBeDefined();
    expect(model.getObjectByName('tank-screw-lid')).toBeDefined();
    expect(model.getObjectByName('tank-outlet')).toBeDefined();
    expect(model.userData.approximatePreview).toBe(true);
  });
  it('is discoverable outdoors and never presents an unpublished supplier quote as a free tank', () => {
    const product = getProductById(item.productId!)!;
    expect(product.dimensions_cm).toEqual({ length: 114, width: 114, height: 130.5 });
    expect(macroOf(product)).toBe('outdoor');
    expect(catalogPrice(product)).toBe('Price on request');
    expect(product.source_url).toBe('https://www.duraco.mu/products/water/');
    expect(product.energy_role).toBe('none');
  });
  it('keeps unrelated models unchanged and rejects invalid geometry', () => {
    expect(waterTankPreview({ ...item, productId: 'emcar-jinko-475' })).toBeNull();
    expect(waterTankPreview({ ...item, heightM: NaN })).toBeNull();
  });
});
