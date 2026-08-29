/**
 * Sims world (2026-08-29) — seed catalog round-trip against the schema.
 *
 * `products.json` is untyped at build time (cast through `unknown`), so
 * nothing else catches a seed row with a misspelt placement or an unknown
 * plan symbol. This suite walks every product through the enum sets the
 * schema declares, and pins the six Sims-world demo seeds plus the
 * category tables (`CATEGORY_LABELS` / `CATEGORY_FILL` / `thumbnailFor`)
 * that must cover the new `lighting` category.
 */
import { describe, it, expect } from 'vitest';
import {
  CATEGORY_FILL,
  CATEGORY_LABELS,
  getAllProducts,
  getCatalog,
  getProductsByCategory,
  productImageUrl,
  productTopDownUrl,
  thumbnailFor,
} from '../products';
import type { PlanSymbol, ProductCategory, ProductPlacement } from '../products.schema';

const ALL = getAllProducts();
const CATEGORIES = Object.keys(CATEGORY_LABELS) as ProductCategory[];
const PLACEMENTS: readonly ProductPlacement[] = ['floor', 'surface', 'wall', 'ceiling'];
const SYMBOLS: readonly PlanSymbol[] = ['light', 'pendant', 'tree', 'hedge', 'bench', 'bar'];
const FRONT_EDGES = ['top', 'bottom', 'left', 'right'];

const NEW_IDS = [
  'demo-floor-lamp',
  'demo-pendant-light',
  'demo-wall-sconce',
  'demo-garden-tree',
  'demo-hedge',
  'demo-outdoor-bench',
];

describe('catalog metadata', () => {
  it('bumps the version for the Sims-world seeds', () => {
    expect(getCatalog().version).toBe('2.1.0-sims-world');
  });

  it('keeps the 27 pre-existing products first, then the 6 new seeds', () => {
    expect(ALL).toHaveLength(33);
    expect(ALL[0].id).toBe('k1-nordictrack-2450');
    expect(ALL[26].id).toBe('demo-potted-plant');
    expect(ALL.slice(27).map((p) => p.id)).toEqual(NEW_IDS);
  });

  it('has unique ids and SKUs', () => {
    expect(new Set(ALL.map((p) => p.id)).size).toBe(ALL.length);
    expect(new Set(ALL.map((p) => p.sku)).size).toBe(ALL.length);
  });
});

describe('every seed row round-trips through the schema enums', () => {
  it.each(ALL.map((p) => [p.id, p] as const))('%s', (_id, p) => {
    expect(CATEGORIES).toContain(p.category);
    if (p.placement !== undefined) expect(PLACEMENTS).toContain(p.placement);
    if (p.plan_symbol !== undefined) expect(SYMBOLS).toContain(p.plan_symbol);
    if (p.front_edge !== undefined) expect(FRONT_EDGES).toContain(p.front_edge);
    if (p.emits_light !== undefined) expect(typeof p.emits_light).toBe('boolean');
    if (p.outdoor !== undefined) expect(typeof p.outdoor).toBe('boolean');
    if (p.is_surface !== undefined) expect(typeof p.is_surface).toBe('boolean');
    if (p.light_radius_m !== undefined) {
      expect(Number.isFinite(p.light_radius_m)).toBe(true);
      expect(p.light_radius_m).toBeGreaterThan(0);
    }
    expect(p.dimensions_cm.length).toBeGreaterThan(0);
    expect(p.dimensions_cm.width).toBeGreaterThan(0);
    expect(p.dimensions_cm.height).toBeGreaterThan(0);
    expect(p.price.value).toBeGreaterThanOrEqual(0);
    expect(['MUR', 'USD', 'EUR', 'GBP']).toContain(p.price.currency);
    expect(p.delivery_regions.length).toBeGreaterThan(0);
  });
});

describe('category tables cover every ProductCategory (incl. lighting)', () => {
  it('CATEGORY_LABELS / CATEGORY_FILL agree on the key set', () => {
    expect(Object.keys(CATEGORY_FILL).sort()).toEqual([...CATEGORIES].sort());
    expect(CATEGORY_LABELS.lighting).toBe('Lighting');
  });

  it('lighting gets a warm amber fill', () => {
    expect(CATEGORY_FILL.lighting).toEqual({ fill: '#F6D58A', stroke: '#B7791F' });
  });

  it('thumbnailFor returns an SVG for every category', () => {
    for (const c of CATEGORIES) {
      const svg = thumbnailFor(c);
      expect(svg.trim().startsWith('<svg')).toBe(true);
      expect(svg).toContain('viewBox="0 0 64 64"');
    }
  });
});

describe('the six Sims-world demo seeds', () => {
  const byId = new Map(ALL.map((p) => [p.id, p]));

  it.each(NEW_IDS)('%s carries the shared demo envelope', (id) => {
    const p = byId.get(id)!;
    expect(p).toBeDefined();
    expect(p.supplier).toBe('PPW Demo');
    expect(p.sku.startsWith('PPW-DEMO-')).toBe(true);
    expect(p.designer_status).toBe('Done');
    expect(p.delivery_regions).toEqual(['MU']);
    expect(p.commission_pct).toBe(0.05);
    expect(p.shopify_ready).toBe(false);
    expect(p.price.currency).toBe('MUR');
    expect(p.image_url.startsWith('https://placehold.co/400x400?text=')).toBe(true);
    // The canvas draws the plan symbol; there is deliberately no top-down art.
    expect(p.topdown_image_url).toBeUndefined();
    expect(p.photo_image_url).toBeUndefined();
    expect(p.thumbnail_svg).toContain('viewBox="0 0 64 64"');
    expect(p.thumbnail_svg).toContain('stroke="currentColor"');
    expect(p.thumbnail_svg).toContain('fill="none"');
    expect(p.plan_symbol).toBeDefined();
  });

  it('floor lamp: lighting / floor / glows 1.8 m / light symbol', () => {
    const p = byId.get('demo-floor-lamp')!;
    expect(p.category).toBe('lighting');
    expect(p.dimensions_cm).toEqual({ length: 40, width: 40, height: 160 });
    expect(p.placement).toBe('floor');
    expect(p.emits_light).toBe(true);
    expect(p.light_radius_m).toBe(1.8);
    expect(p.plan_symbol).toBe('light');
  });

  it('pendant: lighting / ceiling / glows 2.2 m / pendant symbol', () => {
    const p = byId.get('demo-pendant-light')!;
    expect(p.category).toBe('lighting');
    expect(p.dimensions_cm).toEqual({ length: 45, width: 45, height: 30 });
    expect(p.placement).toBe('ceiling');
    expect(p.emits_light).toBe(true);
    expect(p.light_radius_m).toBe(2.2);
    expect(p.plan_symbol).toBe('pendant');
  });

  it('sconce: lighting / wall / glows 1.2 m / light symbol', () => {
    const p = byId.get('demo-wall-sconce')!;
    expect(p.category).toBe('lighting');
    expect(p.dimensions_cm).toEqual({ length: 20, width: 12, height: 25 });
    expect(p.placement).toBe('wall');
    expect(p.emits_light).toBe(true);
    expect(p.light_radius_m).toBe(1.2);
    expect(p.plan_symbol).toBe('light');
    expect(p.mount_height_cm).toBeGreaterThan(0);
  });

  it('garden tree: outdoor plant / tree symbol', () => {
    const p = byId.get('demo-garden-tree')!;
    expect(p.category).toBe('plant');
    expect(p.dimensions_cm).toEqual({ length: 250, width: 250, height: 400 });
    expect(p.outdoor).toBe(true);
    expect(p.plan_symbol).toBe('tree');
    expect(p.placement).toBeUndefined();
  });

  it('hedge: outdoor plant / hedge symbol', () => {
    const p = byId.get('demo-hedge')!;
    expect(p.category).toBe('plant');
    expect(p.dimensions_cm).toEqual({ length: 200, width: 50, height: 120 });
    expect(p.outdoor).toBe(true);
    expect(p.plan_symbol).toBe('hedge');
  });

  it('outdoor bench: outdoor decor / bench symbol / front edge bottom', () => {
    const p = byId.get('demo-outdoor-bench')!;
    expect(p.category).toBe('decor');
    expect(p.dimensions_cm).toEqual({ length: 150, width: 50, height: 45 });
    expect(p.outdoor).toBe(true);
    expect(p.plan_symbol).toBe('bench');
    expect(p.front_edge).toBe('bottom');
  });

  it('none of the pre-existing products became outdoor or lighting', () => {
    for (const p of ALL.slice(0, 27)) {
      expect(p.outdoor).toBeUndefined();
      expect(p.emits_light).toBeUndefined();
      expect(p.plan_symbol).toBeUndefined();
      expect(p.category).not.toBe('lighting');
    }
  });

  it('getProductsByCategory sees the three lights', () => {
    expect(getProductsByCategory('lighting').map((p) => p.id)).toEqual([
      'demo-floor-lamp',
      'demo-pendant-light',
      'demo-wall-sconce',
    ]);
  });

  it('image resolvers fall back to the placeholder URL (no top-down art to fit)', () => {
    const p = byId.get('demo-floor-lamp')!;
    expect(productImageUrl(p)).toBe(p.image_url);
    expect(productTopDownUrl(p)).toBe(p.image_url);
  });
});
