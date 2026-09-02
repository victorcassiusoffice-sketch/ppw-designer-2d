/**
 * Wall paints — SOFAP Ltée (Permoglaze), Mauritius (Vic 2026-09-02).
 *
 * Vic: "pull something from Sofap in Mauritius and complete the algorithm of
 * measurement to a selection of 5 different paint products." Sofap is the
 * island's main paint manufacturer (the Permoglaze brand), so these are the
 * SKUs a Mauritian customer recognises and can actually buy.
 *
 * Paint is sold by the TIN, not the litre — the calculator turns painted
 * wall AREA (length × wall height − door/window openings) into litres
 * (area × coats ÷ coverage) and then into whole purchasable tins, exactly
 * the way the floor tool prices whole tiles/rolls. See
 * `src/designer/wallPaintCalc.ts`.
 *
 * SOURCED VALUES (researched 2026-09-02): prices are live MUR retail
 * listings — Sofap's own online store (sofaponlinestore.mu WooCommerce
 * Store API), EcoMauritius.mu and IME Distributors; coverage figures are
 * Sofap datasheet spread-rate midpoints. White-base prices; most lines are
 * tint-on-demand (Sofap Colour Match), so the hex swatches are
 * representative light neutrals, not fixed line colours. Standard Sofap
 * decorative tin sizes are 1 L / 5 L / 20 L. "2 coats" is standard
 * practice, not a datasheet claim. Aquashield's 5 L size exists but has no
 * live sourced price, so only its 1 L and 20 L tins are quotable here.
 */

export interface WallPaintTin {
  sizeL: number;
  priceMur: number;
}

export interface WallPaint {
  /** Stable id for storage — never rename once shipped. */
  id: string;
  name: string;
  brand: string;
  finish: 'matt' | 'silk' | 'satin' | 'gloss' | 'textured';
  use: 'interior' | 'exterior' | 'both';
  /** m² covered by ONE litre in ONE coat (datasheet spread-rate midpoint). */
  coverage_m2_per_l: number;
  /** Coats assumed for full coverage. */
  recommended_coats: number;
  /** Purchasable tin sizes, smallest first. */
  tins: WallPaintTin[];
  /** Representative wall colour for the swatch (tint-on-demand lines use a light neutral). */
  hex: string;
  /** Where the figures came from. */
  source_urls?: string[];
}

/**
 * Default wall height. Mauritian residential concrete-slab ceilings
 * typically run ~2.6–2.9 m — 2.7 m is the working default; the panel lets
 * the customer set their own (2.0–4.0 m).
 */
export const DEFAULT_WALL_HEIGHT_M = 2.7;
export const MIN_WALL_HEIGHT_M = 2.0;
export const MAX_WALL_HEIGHT_M = 4.0;

/** Standard opening heights used to subtract door/window area from a wall. */
export const OPENING_DOOR_HEIGHT_M = 2.04;
export const OPENING_WINDOW_HEIGHT_M = 1.2;

export const WALL_PAINTS: WallPaint[] = [
  {
    id: 'permoglaze-matt-emulsion',
    name: 'Permoglaze Matt Emulsion',
    brand: 'Permoglaze (Sofap)',
    finish: 'matt',
    use: 'interior',
    coverage_m2_per_l: 9, // datasheet 8–10 m²/L
    recommended_coats: 2,
    tins: [
      { sizeL: 1, priceMur: 201.25 },
      { sizeL: 5, priceMur: 760 },
      { sizeL: 20, priceMur: 2940 },
    ],
    hex: '#F4F2EB',
    source_urls: [
      'https://sofap.mu/product/permoglaze-matt-emulsion/',
      'https://www.sofaponlinestore.mu/wp-json/wc/store/products/5242?_fields=name,prices',
      'https://ecomauritius.mu/product/permoglaze-matt-emulsion-white-paint-eco-label-ms-189-5l/',
    ],
  },
  {
    id: 'permoglaze-soft-feel',
    name: 'Permoglaze Soft Feel',
    brand: 'Permoglaze (Sofap)',
    finish: 'silk', // Sofap's velvet-sheen washable line (Eco-Label MS 189)
    use: 'interior',
    coverage_m2_per_l: 9, // datasheet 8–10 m²/L
    recommended_coats: 2,
    tins: [
      { sizeL: 1, priceMur: 316.25 },
      { sizeL: 5, priceMur: 1248 },
      { sizeL: 20, priceMur: 4860 },
    ],
    hex: '#EDE8DE',
    source_urls: [
      'https://sofap.mu/product/permoglaze-soft-feel/',
      'https://www.sofaponlinestore.mu/wp-json/wc/store/products/5438?_fields=name,prices',
      'https://ecomauritius.mu/product/permoglaze-soft-feel-white-paint-eco-label-ms-189-5l/',
    ],
  },
  {
    id: 'permoglaze-xtreme-white',
    name: 'Permoglaze Xtreme White',
    brand: 'Permoglaze (Sofap)',
    finish: 'matt',
    use: 'interior',
    coverage_m2_per_l: 10.5, // datasheet 9–12 m²/L
    recommended_coats: 2,
    tins: [
      { sizeL: 1, priceMur: 201.25 },
      { sizeL: 5, priceMur: 760 },
      { sizeL: 20, priceMur: 2940 },
    ],
    hex: '#F7F7F1', // white-only line (no tinting)
    source_urls: [
      'https://sofap.mu/product/permoglaze-xtreme-white/',
      'https://www.sofaponlinestore.mu/wp-json/wc/store/products/5458?_fields=name,prices',
      'https://ecomauritius.mu/product/permoglaze-xtreme-white-paint-eco-label-ms-189-5l/',
    ],
  },
  {
    id: 'permoglaze-aquashield',
    name: 'Permoglaze Aquashield',
    brand: 'Permoglaze (Sofap)',
    finish: 'satin', // velvety low-sheen exterior
    use: 'exterior',
    coverage_m2_per_l: 11, // datasheet 10–12 m²/L
    recommended_coats: 2,
    // 5 L exists but has no live sourced price — only quotable tins listed.
    tins: [
      { sizeL: 1, priceMur: 523.25 },
      { sizeL: 20, priceMur: 9315 },
    ],
    hex: '#E9E4D8',
    source_urls: [
      'https://sofap.mu/product/permoglaze-aquashield/',
      'https://www.sofaponlinestore.mu/wp-json/wc/store/products/5194?_fields=name,prices',
    ],
  },
  {
    id: 'permoglaze-anti-fungus',
    name: 'Permoglaze Anti-Fungus',
    brand: 'Permoglaze (Sofap)',
    finish: 'matt',
    use: 'both', // humid-region walls, inside and out
    coverage_m2_per_l: 9, // datasheet 8–10 m²/L
    recommended_coats: 2,
    tins: [
      { sizeL: 1, priceMur: 448.5 },
      { sizeL: 5, priceMur: 1386 },
      { sizeL: 20, priceMur: 5191.2 },
    ],
    hex: '#EAE7DB',
    source_urls: [
      'https://sofap.mu/product/permoglaze-anti-fungus/',
      'https://www.sofaponlinestore.mu/wp-json/wc/store/products/5164?_fields=name,prices',
    ],
  },
];

export function findWallPaintById(id: string): WallPaint | undefined {
  return WALL_PAINTS.find((p) => p.id === id);
}
