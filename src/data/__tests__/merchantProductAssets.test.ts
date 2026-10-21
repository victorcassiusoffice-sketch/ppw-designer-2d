import { describe, expect, it } from 'vitest';
import sources from '../merchantProductAssets.json';
import { SERVICE_PRODUCTS } from '../serviceProducts';
import { apiProductToProduct } from '../apiCatalogAdapter';
import { buildSeedImageryMap, enrichImagery } from '../../../api/_lib/products/seedImagery';

describe('exact supplier source assets', () => {
  it('shows the manufacturer photo without changing the Espace product or its plan envelope', () => {
    for (const source of sources) {
      const product = SERVICE_PRODUCTS.find(candidate => candidate.id === source.id)!;
      expect(product.sku).toBe(source.sku);
      expect(product.photo_image_url).toBe(source.photo_image_url);
      expect(product.topdown_image_url).toBe(source.topdown_image_url);
      expect(product.source_url).toBe(source.source_url);
      expect(product.notes).toContain(source.manufacturer_reference);
      expect(source.source_photo_url).not.toMatch(/preview\.png|placeholder/);
    }
  });
  it('enriches an existing API SKU only, retaining merchant descriptions and prices', () => {
    const source = sources[0];
    const rows = enrichImagery([
      { sku: source.sku, imageUrl: null, description: null, priceMinor: 123 },
      { sku: 'OTHER', imageUrl: null, description: null, priceMinor: 456 },
      { sku: source.sku, imageUrl: 'https://merchant.example/photo.jpg', description: 'Merchant supplied', priceMinor: 789 },
    ], buildSeedImageryMap(sources));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ imageUrl: source.photo_image_url, description: source.notes, priceMinor: 123 });
    expect(rows[1]).toMatchObject({ imageUrl: null, description: null, priceMinor: 456 });
    expect(rows[2]).toMatchObject({ imageUrl: 'https://merchant.example/photo.jpg', description: 'Merchant supplied', priceMinor: 789 });
  });
  it('keeps the source contract when that product arrives through the merchant API', () => {
    const source = sources[0];
    const product = apiProductToProduct({
      id: 98765, sku: source.sku, name: 'Supplier basin', category: 'other', description: null,
      widthMm: null, depthMm: null, heightMm: null, weightG: null, priceMinor: 10000,
      currency: 'MUR', imageUrl: null, region: 'MU',
    });
    expect(product.id).toBe('m-98765');
    expect(product.photo_image_url).toBe(source.photo_image_url);
    expect(product.topdown_image_url).toBe(source.topdown_image_url);
    expect(product.source_url).toBe(source.source_url);
    expect(product.dimensions_cm).toEqual({ length: 80, width: 48, height: 17 });
    expect(product.placement).toBe('wall');
    expect(product.mount_height_cm).toBe(68);
    const fractional = apiProductToProduct({
      id: 98766, sku: 'ESPACE-4067116351545', name: 'Bowl', category: 'other', description: null,
      widthMm: 650, depthMm: 395, heightMm: 400, weightG: null, priceMinor: 10000,
      currency: 'MUR', imageUrl: null, region: 'MU',
    });
    expect(fractional.dimensions_cm.width).toBe(39.5);
  });
});
