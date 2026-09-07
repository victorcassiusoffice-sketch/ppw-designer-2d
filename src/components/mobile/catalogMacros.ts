/**
 * Shared macro-category definitions for the mobile Sims toolbar.
 *
 * Mirrors the macro grouping ProductPalette uses (Furniture · Cardio ·
 * Recovery · Sauna · Flooring · Walls · Decor) so the granular
 * `ProductCategory` enum stays the per-product source of truth while the
 * Sims toolbar shows the same seven tabs Vic asked for. The matching icon
 * component lives in `MacroIcon.tsx` (kept separate so this module only
 * exports constants/functions — react-refresh hygiene).
 *
 * Sims world (2026-08-29) adds two tabs: Lighting (the `lighting`
 * category) and Outdoor (any product flagged `outdoor`, whatever its
 * category — a garden tree is a plant, a garden bench is decor, but a
 * customer laying out the plot wants them in one place).
 */
import type { Product, ProductCategory } from '../../data/products.schema';

export type MacroCategory =
  | 'all'
  | 'furniture'
  | 'cardio'
  | 'recovery'
  | 'sauna'
  | 'flooring'
  | 'walls'
  | 'decor'
  | 'lighting'
  | 'outdoor'
  | 'eco'
  // Retail (2026-09-05): TVs, air conditioners, fridges. Hidden while empty
  // (see MACRO_HIDDEN_WHEN_EMPTY) so the wellness catalog keeps its 11 tabs.
  | 'appliances';

export const MACRO_CATEGORY_ORDER: MacroCategory[] = [
  'all',
  'furniture',
  'appliances',
  'cardio',
  'recovery',
  'sauna',
  'flooring',
  'walls',
  'decor',
  'lighting',
  'outdoor',
  // Eco / solar (2026-09-04): panels, inverters, batteries — the products
  // that make the energy readout move.
  'eco',
];

export const MACRO_CATEGORY_LABEL: Record<MacroCategory, string> = {
  all: 'All',
  furniture: 'Furniture',
  cardio: 'Cardio',
  recovery: 'Recovery',
  sauna: 'Sauna',
  flooring: 'Flooring',
  walls: 'Walls',
  decor: 'Decor',
  lighting: 'Lighting',
  outdoor: 'Outdoor',
  eco: 'Eco',
  appliances: 'Appliances',
};

/**
 * Macro tabs that only appear when at least one product maps to them. The
 * standard wellness seed has no appliances, so its dock is unchanged; a
 * merchant demo (`/designer?demo=courts`) brings the tab with its range.
 */
export const MACRO_HIDDEN_WHEN_EMPTY: ReadonlySet<MacroCategory> = new Set<MacroCategory>(['appliances']);

/** The tabs to render for a given product list — the order, minus empty hide-able tabs. */
export function visibleMacroCategories(products: readonly Product[]): MacroCategory[] {
  return MACRO_CATEGORY_ORDER.filter(
    (mc) => !MACRO_HIDDEN_WHEN_EMPTY.has(mc) || products.some((p) => macroOf(p) === mc),
  );
}

const PRODUCT_TO_MACRO: Record<ProductCategory, MacroCategory> = {
  'ergo-chair': 'furniture',
  'eco-office-kit': 'furniture',
  fitness: 'cardio',
  'ice-bath': 'recovery',
  massage: 'recovery',
  'sleep-pod': 'recovery',
  sauna: 'sauna',
  plant: 'decor',
  flooring: 'flooring',
  walls: 'walls',
  decor: 'decor',
  lighting: 'lighting',
  solar: 'eco',
  furniture: 'furniture',
  appliance: 'appliances',
  other: 'decor',
};

/**
 * Which toolbar tab a product lives in. `outdoor` wins over the category
 * map so garden pieces are found on the Outdoor tab regardless of whether
 * they are plants, decor or lighting — except solar gear, which is Eco
 * even though a panel is placed outside (on the roof).
 */
export function macroOf(p: Product): MacroCategory {
  if (p.category === 'solar') return 'eco';
  if (p.outdoor === true) return 'outdoor';
  return PRODUCT_TO_MACRO[p.category] ?? 'decor';
}
