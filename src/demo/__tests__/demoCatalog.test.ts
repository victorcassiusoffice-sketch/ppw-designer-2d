/**
 * Merchant demo catalogs (Courts Mammouth push, 2026-09-05).
 *
 * The contract the pitch depends on: a demo's range is invisible until its
 * slug is activated, heads the catalog while active, resolves by id in EVERY
 * tab once registered (so a saved demo page never renders "Unknown product"
 * after the demo tab is closed), and can never collide with the seed.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetDemosForTests,
  activeDemo,
  activeDemoSlug,
  demoProductById,
  demoProducts,
  registerDemo,
  registeredDemoSlugs,
  setActiveDemo,
  type DemoDefinition,
} from '../demoCatalog';
import { getAllProducts, getProductById } from '../../data/products';
import type { Product } from '../../data/products.schema';

function product(id: string, name = id): Product {
  return {
    id,
    sku: id.toUpperCase(),
    name,
    category: 'decor',
    supplier: 'Test Merchant',
    dimensions_cm: { length: 100, width: 50, height: 40 },
    weight_kg: 10,
    price: { value: 1000, currency: 'MUR' },
    commission_pct: 0,
    shopify_ready: false,
    image_url: '',
    designer_status: 'Done',
    delivery_regions: ['MU'],
    notes: '',
  };
}

function demo(slug: string, ids: string[]): DemoDefinition {
  return {
    slug,
    merchant: `${slug} merchant`,
    pageName: `${slug} page`,
    products: ids.map((id) => product(id)),
    buildProperty: () => ({ id: `${slug}-prop`, name: `${slug} page`, activeRoomId: 'r1', rooms: [] }),
  };
}

describe('demoCatalog — registry and activation', () => {
  beforeEach(() => __resetDemosForTests());
  afterEach(() => __resetDemosForTests());

  it('nothing is active by default, so the catalog is exactly the seed', () => {
    const seedCount = getAllProducts().length;
    registerDemo(demo('acme', ['acme-sofa']));
    expect(activeDemoSlug()).toBeNull();
    expect(activeDemo()).toBeNull();
    expect(demoProducts()).toEqual([]);
    expect(getAllProducts()).toHaveLength(seedCount);
    expect(getAllProducts().some((p) => p.id === 'acme-sofa')).toBe(false);
  });

  it('an active demo heads the catalog and its products resolve by id', () => {
    registerDemo(demo('acme', ['acme-sofa', 'acme-tv']));
    const seedCount = getAllProducts().length;
    expect(setActiveDemo('acme')).toBe(true);
    const all = getAllProducts();
    expect(all).toHaveLength(seedCount + 2);
    expect(all[0].id).toBe('acme-sofa');
    expect(all[1].id).toBe('acme-tv');
    expect(getProductById('acme-tv')?.name).toBe('acme-tv');
  });

  it('a registered demo resolves by id even when INACTIVE (saved demo pages keep rendering)', () => {
    registerDemo(demo('acme', ['acme-sofa']));
    expect(activeDemoSlug()).toBeNull();
    expect(demoProductById('acme-sofa')?.id).toBe('acme-sofa');
    expect(getProductById('acme-sofa')?.id).toBe('acme-sofa');
    // …but the CATALOG does not show it.
    expect(getAllProducts().some((p) => p.id === 'acme-sofa')).toBe(false);
  });

  it('only a registered slug can be activated; null leaves demo mode', () => {
    registerDemo(demo('acme', ['acme-sofa']));
    expect(setActiveDemo('nope')).toBe(false);
    expect(activeDemoSlug()).toBeNull();
    expect(setActiveDemo('acme')).toBe(true);
    expect(activeDemoSlug()).toBe('acme');
    expect(setActiveDemo(null)).toBe(true);
    expect(activeDemoSlug()).toBeNull();
    expect(demoProducts()).toEqual([]);
  });

  it('two demos never bleed into each other', () => {
    registerDemo(demo('acme', ['acme-sofa']));
    registerDemo(demo('zed', ['zed-desk']));
    expect(registeredDemoSlugs().sort()).toEqual(['acme', 'zed']);
    setActiveDemo('zed');
    const ids = demoProducts().map((p) => p.id);
    expect(ids).toEqual(['zed-desk']);
    expect(getAllProducts()[0].id).toBe('zed-desk');
    expect(getAllProducts().some((p) => p.id === 'acme-sofa')).toBe(false);
  });

  it('refuses a product id that is not namespaced by the slug (seed collision guard)', () => {
    expect(() => registerDemo(demo('acme', ['k1-nordictrack-2450']))).toThrow(/must start with "acme-"/);
    expect(() => registerDemo(demo('Bad Slug', ['bad-slug-x']))).toThrow(/slug/);
  });

  it('a demo product never shadows a seed id (seed wins the namespace, demo wins its own)', () => {
    registerDemo(demo('acme', ['acme-sofa']));
    setActiveDemo('acme');
    expect(getProductById('k1-nordictrack-2450')?.supplier).toContain('K1-Sport');
    expect(getProductById('acme-sofa')?.supplier).toBe('Test Merchant');
  });
});
