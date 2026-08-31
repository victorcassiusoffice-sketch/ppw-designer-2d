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
  /**
   * The real-world size of ONE tile, in metres — the unit the floor painter
   * paints in (floor-painting brief 2026-08-28, D1).
   *
   * `null` marks a NON-TILEABLE good. The EPDM roll is 10 m x 1.25 m: it is
   * laid as a continuous run, not a lattice, so painting it tile-by-tile
   * would put a fictional unit on a customer's quote. Null-sized materials
   * are excluded from the tile picker and stay on the whole-room,
   * area-priced path (Vic 2026-08-28).
   *
   * EXPLICIT rather than derived from `coverage_m2_per_unit`: a square root
   * cannot tell a 0.92 x 0.92 tile from a 0.5 x 1.69 plank, and getting that
   * wrong lays the floor in the wrong direction.
   */
  tile_w_m: number | null;
  tile_h_m: number | null;
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
    tile_w_m: 0.92,
    tile_h_m: 0.92,
  },
  {
    id: 'eva-combat',
    sku: 'K1-FLOR-EVACOMBAT',
    name: 'EVA Combat Mat 1×1 m',
    hex: '#1f2a44',
    coverage_m2_per_unit: 1.0,
    unit: 'tile',
    price_per_unit_mur: 850,
    tile_w_m: 1.0,
    tile_h_m: 1.0,
  },
  {
    id: 'rubber-composite',
    sku: 'K1-FLOR-RUBCOMP',
    name: 'Rubber Composite 50×50',
    hex: '#4a4a4a',
    coverage_m2_per_unit: 0.5 * 0.5, // 0.25
    unit: 'tile',
    price_per_unit_mur: 500,
    tile_w_m: 0.5,
    tile_h_m: 0.5,
  },
  {
    id: 'outdoor-1m',
    sku: 'K1-FLOR-OUTDOOR1M',
    name: 'Outdoor Rubber 1×1 m',
    hex: '#8b3a2f',
    coverage_m2_per_unit: 1.0,
    unit: 'tile',
    price_per_unit_mur: 1500,
    tile_w_m: 1.0,
    tile_h_m: 1.0,
  },
  {
    id: 'outdoor-50',
    sku: 'K1-FLOR-OUTDOOR50',
    name: 'Outdoor Rubber 50×50',
    hex: '#a0442f',
    coverage_m2_per_unit: 0.5 * 0.5, // 0.25
    unit: 'tile',
    price_per_unit_mur: 375,
    tile_w_m: 0.5,
    tile_h_m: 0.5,
  },
  {
    id: 'epdm-roll',
    sku: 'K1-FLOR-EPDM6',
    name: 'EPDM Rubber Roll 6 mm',
    hex: '#5a5a55',
    coverage_m2_per_unit: 10.0 * 1.25, // 1000 cm × 125 cm = 12.5 m²/roll
    unit: 'roll',
    price_per_unit_mur: 13500,
    // Not a tile. 10 m x 1.25 m of sheet goods, laid in runs, so it stays on
    // the whole-room area-priced path (Vic 2026-08-28).
    tile_w_m: null,
    tile_h_m: null,
  },
];

/** Materials the tile painter can paint. Rolls and sheet goods are excluded. */
export function tileableFloorMaterials(): FloorMaterial[] {
  return FLOOR_MATERIALS.filter((m) => m.tile_w_m !== null && m.tile_h_m !== null);
}

export function findFloorMaterialById(id: string): FloorMaterial | undefined {
  return FLOOR_MATERIALS.find((m) => m.id === id);
}

/**
 * The Floor-tool material a catalog product IS, if any (Floor tool, 2026-08-30).
 *
 * Six K1 flooring SKUs exist twice: as a paintable material here and as a
 * placeable product in `products.json`. Matching on `sku` (not name, not id)
 * makes the catalog card for such a product arm the Floor tool instead of
 * placing a loose item, so a customer meets ONE way to lay a floor. Loose
 * mats with no material row (the kids mat, the vinyl equipment mat) return
 * undefined and stay ordinary placeable items.
 */
export function floorMaterialForProduct(
  p: { sku?: string | null } | null | undefined,
): FloorMaterial | undefined {
  const sku = p?.sku;
  if (!sku) return undefined;
  return FLOOR_MATERIALS.find((m) => m.sku === sku);
}
