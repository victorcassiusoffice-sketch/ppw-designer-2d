/**
 * Flooring materials catalog for the floor-area calculator (P3-2, flooring arm).
 *
 * Mirrors `paintPalette.ts`. Each entry is a real K1-Sport flooring SKU with
 * its tile/roll coverage (m² per unit, derived from `dimensions_cm`) and the
 * generic MUR price-per-unit from the seed catalog (`products.json` price.value).
 * Prices are placeholders to be swapped for the live merchant feed — same
 * posture as the paint palette.
 */

export type FloorUnit = 'tile' | 'roll' | 'pack' | 'mat';

export interface FloorMaterial {
  id: string;
  /** K1 catalog SKU this maps to. */
  sku: string;
  name: string;
  /** Swatch colour (approximate finished look). */
  hex: string;
  /** Coverage of ONE purchasable unit, in m² (tile/roll/pack area). */
  coverage_m2_per_unit: number;
  /** What one unit is called, for the UI ("3 tiles", "1 roll"). */
  unit: FloorUnit;
  /** Placeholder MUR price per 1 unit — Mauritius market (K1 seed feed). */
  price_per_unit_mur: number;
}

export const FLOOR_MATERIALS: FloorMaterial[] = [
  {
    id: 'gym-interlock',
    sku: 'K1-FLOR-GYMTILE',
    name: 'Gym Interlock Tile 92×92',
    hex: '#3a3a3a',
    coverage_m2_per_unit: 0.92 * 0.92, // 0.8464
    unit: 'tile',
    price_per_unit_mur: 1600,
  },
  {
    id: 'eva-combat',
    sku: 'K1-FLOR-EVACOMBAT',
    name: 'EVA Combat Mat 1×1 m',
    hex: '#1f2a44',
    coverage_m2_per_unit: 1.0,
    unit: 'tile',
    price_per_unit_mur: 850,
  },
  {
    id: 'rubber-composite',
    sku: 'K1-FLOR-RUBCOMP',
    name: 'Rubber Composite 50×50',
    hex: '#4a4a4a',
    coverage_m2_per_unit: 0.5 * 0.5, // 0.25
    unit: 'tile',
    price_per_unit_mur: 500,
  },
  {
    id: 'outdoor-1m',
    sku: 'K1-FLOR-OUTDOOR1M',
    name: 'Outdoor Rubber 1×1 m',
    hex: '#8b3a2f',
    coverage_m2_per_unit: 1.0,
    unit: 'tile',
    price_per_unit_mur: 1500,
  },
  {
    id: 'outdoor-50',
    sku: 'K1-FLOR-OUTDOOR50',
    name: 'Outdoor Rubber 50×50',
    hex: '#a0442f',
    coverage_m2_per_unit: 0.5 * 0.5, // 0.25
    unit: 'tile',
    price_per_unit_mur: 375,
  },
  {
    id: 'epdm-roll',
    sku: 'K1-FLOR-EPDM6',
    name: 'EPDM Rubber Roll 6 mm',
    hex: '#5a5a55',
    coverage_m2_per_unit: 10.0 * 1.25, // 1000 cm × 125 cm = 12.5 m²/roll
    unit: 'roll',
    price_per_unit_mur: 13500,
  },
];

export function findFloorMaterialById(id: string): FloorMaterial | undefined {
  return FLOOR_MATERIALS.find((m) => m.id === id);
}
