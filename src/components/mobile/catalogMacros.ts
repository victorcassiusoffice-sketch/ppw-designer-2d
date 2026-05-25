/**
 * Shared macro-category definitions for the mobile Sims toolbar.
 *
 * Mirrors the macro grouping ProductPalette uses (Furniture · Cardio ·
 * Recovery · Sauna · Flooring · Walls · Decor) so the granular
 * `ProductCategory` enum stays the per-product source of truth while the
 * Sims toolbar shows the same seven tabs Vic asked for. The matching icon
 * component lives in `MacroIcon.tsx` (kept separate so this module only
 * exports constants/functions — react-refresh hygiene).
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
  | 'decor';

export const MACRO_CATEGORY_ORDER: MacroCategory[] = [
  'all',
  'furniture',
  'cardio',
  'recovery',
  'sauna',
  'flooring',
  'walls',
  'decor',
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
  other: 'decor',
};

export function macroOf(p: Product): MacroCategory {
  return PRODUCT_TO_MACRO[p.category] ?? 'decor';
}
