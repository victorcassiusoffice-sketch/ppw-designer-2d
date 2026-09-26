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
  it('is discoverable outdoors and carries the Mauritian retailers\' list price, not a supplier quote', () => {
    // Priced 2026-09-26: Rs 11,500 list at Ah-Ling World and Quincaillerie Bon
    // Marché (QBM sale Rs 10,350 that day); Duraco itself publishes no price.
    const product = getProductById(item.productId!)!;
    expect(product.dimensions_cm).toEqual({ length: 114, width: 114, height: 130.5 });
    expect(macroOf(product)).toBe('outdoor');
    expect(product.price).toEqual({ value: 11500, currency: 'MUR' });
    expect(product.price_on_request).toBe(false);
    expect(catalogPrice(product)).toBe('11,500 MUR');
    expect(product.source_url).toBe('https://quincailleriebonmarche.com/product/duraco-water-tank-1000l/');
    expect(product.notes).toMatch(/Rs 11,500/);
    expect('price_note' in product).toBe(false);
    expect(product.energy_role).toBe('none');
  });
  it('keeps unrelated models unchanged and rejects invalid geometry', () => {
    expect(waterTankPreview({ ...item, productId: 'emcar-jinko-475' })).toBeNull();
    expect(waterTankPreview({ ...item, heightM: NaN })).toBeNull();
  });
});
