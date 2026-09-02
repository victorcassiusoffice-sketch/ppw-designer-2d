/**
 * Sims world (2026-08-29) — `/api/products` → bundled `Product` adapter.
 *
 * Two things this pins:
 *   1. `lighting` (and the other real `ProductCategory` values) pass
 *      through `normaliseCategory` instead of collapsing to `other`.
 *   2. The seed-by-SKU merge carries the Designer-behaviour fields the wire
 *      shape cannot (placement / is_surface / front_edge / lighting /
 *      outdoor / plan_symbol), not just the five image + notes fields.
 */
import { describe, it, expect } from 'vitest';
import {
  apiProductToProduct,
  fetchApiProducts,
  getApiProductFromCache,
  normaliseCategory,
  type ApiProductSummary,
} from '../apiCatalogAdapter';
import { getAllProducts } from '../products';

function apiRow(overrides: Partial<ApiProductSummary> = {}): ApiProductSummary {
  return {
    id: 901,
    sku: 'MERCHANT-XYZ',
    name: 'Merchant thing',
    category: 'other',
    description: 'From the DB',
    widthMm: 1200,
    depthMm: 400,
    heightMm: 750,
    weightG: 18000,
    priceMinor: 1250000,
    currency: 'MUR',
    imageUrl: 'https://cdn.example.com/photo.jpg',
    topdownImageUrl: null,
    region: 'MU',
    ...overrides,
  };
}

describe('normaliseCategory', () => {
  it('passes lighting through (was folded into other before Sims world)', () => {
    expect(normaliseCategory('lighting')).toBe('lighting');
    expect(normaliseCategory('  Lighting ')).toBe('lighting');
  });

  it('passes the other real ProductCategory values through', () => {
    for (const c of ['fitness', 'sauna', 'massage', 'flooring', 'walls', 'decor', 'plant']) {
      expect(normaliseCategory(c)).toBe(c);
    }
  });

  it('collapses DB-only and unknown categories to other', () => {
    for (const c of ['tables', 'beds', 'storage', 'seating', 'plants', 'spaceship', '']) {
      expect(normaliseCategory(c)).toBe('other');
    }
  });
});

describe('apiProductToProduct — seed-by-SKU behaviour merge', () => {
  it('carries lighting fields from the floor-lamp seed', () => {
    const p = apiProductToProduct(apiRow({ sku: 'PPW-DEMO-LAMP-FLOOR', category: 'lighting' }));
    expect(p.category).toBe('lighting');
    expect(p.placement).toBe('floor');
    expect(p.emits_light).toBe(true);
    expect(p.light_radius_m).toBe(1.8);
    expect(p.plan_symbol).toBe('light');
    expect(p.thumbnail_svg).toContain('<svg');
  });

  it('carries ceiling placement from the pendant seed', () => {
    const p = apiProductToProduct(apiRow({ sku: 'PPW-DEMO-LAMP-PENDANT', category: 'lighting' }));
    expect(p.placement).toBe('ceiling');
    expect(p.plan_symbol).toBe('pendant');
    expect(p.light_radius_m).toBe(2.2);
  });

  it('carries wall placement + mount height (the pre-existing parity gap)', () => {
    const shelf = apiProductToProduct(apiRow({ sku: 'PPW-DEMO-SHELF', category: 'decor' }));
    expect(shelf.placement).toBe('wall');
    expect(shelf.mount_height_cm).toBe(150);
    const sconce = apiProductToProduct(apiRow({ sku: 'PPW-DEMO-LAMP-SCONCE', category: 'lighting' }));
    expect(sconce.placement).toBe('wall');
    expect(sconce.mount_height_cm).toBe(170);
  });

  it('carries is_surface from the console-table seed', () => {
    const p = apiProductToProduct(apiRow({ sku: 'PPW-DEMO-TABLE', category: 'decor' }));
    expect(p.is_surface).toBe(true);
  });

  it('carries outdoor, plan_symbol and front_edge from the garden seeds', () => {
    const bench = apiProductToProduct(apiRow({ sku: 'PPW-DEMO-GARDEN-BENCH', category: 'decor' }));
    expect(bench.outdoor).toBe(true);
    expect(bench.plan_symbol).toBe('bench');
    expect(bench.front_edge).toBe('bottom');
    const tree = apiProductToProduct(apiRow({ sku: 'PPW-DEMO-GARDEN-TREE', category: 'plant' }));
    expect(tree.outdoor).toBe(true);
    expect(tree.plan_symbol).toBe('tree');
  });

  it('still carries front_edge for the K1 seeds', () => {
    const p = apiProductToProduct(apiRow({ sku: 'K1-CDIO-NT2450', category: 'fitness' }));
    expect(p.front_edge).toBe('bottom');
    expect(p.topdown_image_url).toBe('/products/topdown/k1-nordictrack-2450.webp');
  });

  it('adds NO behaviour keys (not even undefined ones) for an unseeded SKU', () => {
    const p = apiProductToProduct(apiRow({ sku: 'MERCHANT-XYZ' }));
    for (const key of [
      'placement',
      'is_surface',
      'front_edge',
      'mount_height_cm',
      'emits_light',
      'light_radius_m',
      'outdoor',
      'plan_symbol',
      'thumbnail_svg',
    ]) {
      expect(key in p).toBe(false);
    }
  });

  it('keeps the original five-field merge (supplier, commission, images, notes)', () => {
    const p = apiProductToProduct(
      apiRow({ sku: 'K1-CDIO-NT2450', category: 'fitness', description: '   ' }),
    );
    const seed = getAllProducts().find((s) => s.sku === 'K1-CDIO-NT2450')!;
    expect(p.supplier).toBe(seed.supplier);
    expect(p.commission_pct).toBe(seed.commission_pct);
    expect(p.photo_image_url).toBe(seed.photo_image_url);
    expect(p.notes).toBe(seed.notes);
  });

  it('namespaces the id and converts mm → cm', () => {
    const p = apiProductToProduct(apiRow());
    expect(p.id).toBe('m-901');
    expect(p.dimensions_cm).toEqual({ length: 120, width: 40, height: 75 });
    expect(p.price).toEqual({ value: 12500, currency: 'MUR' });
    expect(p.delivery_regions).toEqual(['MU', 'global']);
  });
});

describe('fetchApiProducts', () => {
  it('adapts rows and caches them by namespaced id', async () => {
    const fetchImpl = (async () =>
      ({
        ok: true,
        json: async () => ({
          products: [apiRow({ id: 4242, sku: 'PPW-DEMO-LAMP-FLOOR', category: 'lighting' })],
          total: 1,
          limit: 100,
          offset: 0,
        }),
      }) as unknown as Response) as typeof fetch;
    const out = await fetchApiProducts(fetchImpl);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('m-4242');
    expect(getApiProductFromCache('m-4242')?.emits_light).toBe(true);
  });

  it('degrades to an empty list on a non-OK response or a throw', async () => {
    const notOk = (async () => ({ ok: false }) as unknown as Response) as typeof fetch;
    expect(await fetchApiProducts(notOk)).toEqual([]);
    const boom = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    expect(await fetchApiProducts(boom)).toEqual([]);
  });
});
