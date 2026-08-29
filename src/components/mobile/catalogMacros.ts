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
  | 'outdoor';

export const MACRO_CATEGORY_ORDER: MacroCategory[] = [
  'all',
  'furniture',
  'cardio',
  'recovery',
  'sauna',
  'flooring',
  'walls',
  'decor',
  'lighting',
  'outdoor',
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
};

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
  other: 'decor',
};

/**
 * Which toolbar tab a product lives in. `outdoor` wins over the category
 * map so garden pieces are found on the Outdoor tab regardless of whether
 * they are plants, decor or lighting.
 */
export function macroOf(p: Product): MacroCategory {
  if (p.outdoor === true) return 'outdoor';
  return PRODUCT_TO_MACRO[p.category] ?? 'decor';
}
