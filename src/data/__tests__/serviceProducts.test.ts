import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getProductById, productTopDownUrl } from '../products';
import { SERVICE_PRODUCT_DEFINITIONS, SERVICE_PRODUCTS, serviceProductById, serviceProductPlanSvg, serviceProductSizeM } from '../serviceProducts';
import { createServiceProductBody, serviceProductPreview } from '../../components/three/serviceProductPreview';
import type { ItemSolid } from '../../designer/roomSolids';

describe('paired Mauritian services products', () => {
  it('publishes individually sourced SKUs without a second plan dimension table', () => {
    expect(SERVICE_PRODUCTS).toHaveLength(10);
    expect(new Set(SERVICE_PRODUCTS.map(product => product.sku)).size).toBe(10);
    for (const definition of SERVICE_PRODUCT_DEFINITIONS) {
      const product = getProductById(definition.referenceProductId)!;
      if (definition.priceSnapshot) {
        expect(product.price_snapshot?.unit).toBe('piece');
        expect(product.price_snapshot?.tax).toBe('included');
        expect(product.price_snapshot?.observedAt).toBe(definition.sourceCheckedAt ?? '2026-10-08');
        expect(product.price.value).toBe(definition.priceSnapshot.value);
        expect(product.price_on_request).toBe(false);
      } else {
        expect(product.price_snapshot).toBeUndefined();
        expect(product.price_on_request).toBe(true);
        expect(product.price.value).toBe(0);
      }
      expect(product.energy_role).toBe('none');
      expect(product.shopify_ready).toBe(false);
      expect(product.dimensions_cm).toEqual({ length: definition.dimensionsMm.length / 10,
        width: definition.dimensionsMm.width / 10, height: definition.dimensionsMm.height / 10 });
      const svg = decodeURIComponent(productTopDownUrl(product).split(',').slice(1).join(','));
      expect(svg).toBe(serviceProductPlanSvg(definition));
      expect(svg).toContain(`viewBox="0 0 ${definition.dimensionsMm.length} ${definition.dimensionsMm.width}"`);
    }
  });

  it.each(SERVICE_PRODUCT_DEFINITIONS)('$referenceProductId: actual 3D vertices match the published plan envelope and height', definition => {
    const model = createServiceProductBody(definition);
    const bounds = new THREE.Box3().setFromObject(model, true);
    const size = bounds.getSize(new THREE.Vector3());
    const dimensions = serviceProductSizeM(definition);
    expect(size.x).toBeCloseTo(dimensions.lengthM, 8);
    expect(size.y).toBeCloseTo(dimensions.heightM, 8);
    expect(size.z).toBeCloseTo(dimensions.widthM, 8);
    expect(bounds.min.y).toBeCloseTo(0, 8);
    expect(bounds.getCenter(new THREE.Vector3()).x).toBeCloseTo(0, 8);
    expect(bounds.getCenter(new THREE.Vector3()).z).toBeCloseTo(0, 8);
    expect(model.userData.approximatePreview).toBe(true);
  });

  it('keeps face width, wall projection and height distinct for the electrical box', () => {
    expect(serviceProductSizeM(serviceProductById('electrical-legrand-surface-box-613351')!))
      .toEqual({ lengthM: .146, widthM: .035, heightM: .086 });
    expect(getProductById('espace-emilia-toilet-bowl')?.front_edge).toBe('left');
  });

  it('never assigns a whole-set price to a sofa component or invents current bidet stock', () => {
    const sofa = getProductById('espace-seville-garden-sofa')!;
    const bidet = getProductById('espace-duravit-dcode-bidet-224110')!;
    expect(sofa.price_on_request).toBe(true);
    expect(sofa.notes).toContain('four-piece set');
    expect(bidet.price_on_request).toBe(true);
    expect(bidet.notes).toContain('older supplier catalogue');
    expect(bidet.dimensions_cm).toEqual({ length: 56, width: 36, height: 38.5 });
    expect(getProductById('espace-durastyle-washbasin-800')?.dimensions_cm).toEqual({ length: 80, width: 48, height: 17 });
  });

  it('prices one complete pipe stock length without fabricating internal bore or flow capacity', () => {
    for (const definition of SERVICE_PRODUCT_DEFINITIONS.filter(item => item.shape === 'pipe')) {
      expect(definition.pipe?.stockLengthM).toBe(definition.dimensionsMm.length / 1000);
      expect(definition.pipe?.publishedWidthMm).toBe(definition.dimensionsMm.width);
      expect(definition.dimensionsMm.width).toBe(definition.dimensionsMm.height);
      expect(definition.pipe?.boreVerified).toBe(false);
      expect(definition.priceSnapshot?.unit).toBe('piece');
      expect(definition.notes).toContain('not a per-metre price');
    }
  });

  it('preserves placement, ground elevation and rotation instead of moving the camera or model origin', () => {
    const definition = SERVICE_PRODUCT_DEFINITIONS[0];
    const size = serviceProductSizeM(definition);
    const item: ItemSolid = { key: 'tank', instanceId: 'tank-1', productId: definition.referenceProductId,
      x0: 2, x1: 3.05, y0: 4, y1: 5.6, z0: 3, z1: 4.085,
      ...size, rotationDeg: 90, hex: '#c8d4c6' };
    const model = serviceProductPreview(item)!;
    const bounds = new THREE.Box3().setFromObject(model, true);
    const rotatedSize = bounds.getSize(new THREE.Vector3());
    expect(bounds.min.y).toBeCloseTo(3, 8);
    expect(rotatedSize.x).toBeCloseTo(size.widthM, 8);
    expect(rotatedSize.z).toBeCloseTo(size.lengthM, 8);
    expect(bounds.getCenter(new THREE.Vector3()).x).toBeCloseTo(2.525, 8);
    expect(bounds.getCenter(new THREE.Vector3()).z).toBeCloseTo(4.8, 8);
    expect(model.userData.instanceId).toBe('tank-1');
    expect(serviceProductPreview({ ...item, heightM: NaN })).toBeNull();
    expect(serviceProductPreview({ ...item, productId: 'unverified-sku' })).toBeNull();
  });

  it('rejects missing or corrupt dimensions before either renderer creates a product', () => {
    const corrupt = { ...SERVICE_PRODUCT_DEFINITIONS[0], dimensionsMm: { length: NaN, width: 1050, height: 1085 } };
    expect(() => serviceProductPlanSvg(corrupt)).toThrow(/finite/);
    expect(() => createServiceProductBody(corrupt)).toThrow(/finite/);
  });
});
