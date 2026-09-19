/**
 * productModels — which body a product wears (2026-09-17).
 *
 * Production fault (Vic, desktop): every K1 machine came up as a BOX in 3D
 * Mode. The manifest is keyed by seed ids; the deployed catalog delivers the
 * same products from the API as `m-<id>` with the seed twin hidden by SKU.
 * The body must resolve by SKU too.
 */
import { describe, expect, it } from 'vitest';
import { productIdsWithModels, productModelFor } from '../productModels';
import { getProductById } from '../products';
import { apiProductToProduct } from '../apiCatalogAdapter';

describe('productModelFor', () => {
  it('resolves a seed id straight from the manifest', () => {
    const e = productModelFor({ id: 'k1-nordictrack-2450', sku: 'K1-CDIO-NT2450' });
    expect(e?.url).toBe('/models/k1-nordictrack-2450.glb');
  });

  it('resolves an API-namespaced product by its SKU (the production catalog path)', () => {
    const e = productModelFor({ id: 'm-4242', sku: 'K1-CDIO-NT2450' });
    expect(e?.url).toBe('/models/k1-nordictrack-2450.glb');
    expect(e?.modelFront).toBeDefined();
  });

  it('every seed product with a body also resolves through its SKU', () => {
    for (const id of productIdsWithModels()) {
      const seed = getProductById(id);
      if (!seed) continue; // Kenney demo bodies for products not in the seed are fine to skip
      expect(productModelFor({ id: `m-${id}`, sku: seed.sku })?.url, id).toBe(productModelFor(seed)?.url);
    }
  });

  it('an unknown id with an unknown SKU stays a box', () => {
    expect(productModelFor({ id: 'm-1', sku: 'NOPE' })).toBeUndefined();
    expect(productModelFor({ id: 'm-1' })).toBeUndefined();
  });

  it('an API-adapted K1 row wears the same body AND facing as its seed twin', () => {
    const api = apiProductToProduct({
      id: 7,
      sku: 'K1-CDIO-NTTDF',
      name: 'NordicTrack Tour de France Indoor Bike',
      category: 'fitness',
      description: null,
      widthMm: 650,
      depthMm: 1500,
      heightMm: 1350,
      weightG: 0,
      priceMinor: 0,
      currency: 'MUR',
      imageUrl: null,
      region: 'MU',
    });
    expect(api.id).toBe('m-7');
    const seed = getProductById('k1-nordictrack-tour-de-france')!;
    expect(productModelFor(api)).toBe(productModelFor(seed));
    expect(productModelFor(api)?.modelFront).toBe('-z');
  });

  it("a product's own mesh_url wins over the manifest", () => {
    const e = productModelFor({ id: 'k1-nordictrack-2450', sku: 'K1-CDIO-NT2450', mesh_url: 'https://cdn/x.glb' });
    expect(e?.url).toBe('https://cdn/x.glb');
  });
});
