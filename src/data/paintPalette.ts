/**
 * Tweak 03 (Phase C) — eco / no-VOC paint palette + flooring catalog.
 *
 * Per `06-Roadmap/sims-parity/master/CODE-RUNNER-DESIGN-TWEAK-1/03-walls-paint-panels.md`:
 *
 *   "PAINT sub-mode under WALL: click a drawn wall → paint colour
 *    swatch picker (eco/no-VOC paints only, 12-colour starter palette)."
 *
 * Until the MU paint-supplier research lands a concrete SKU table
 * (`merchant-dept/mauritius-paint-supplier-research-2026-05-21.md`),
 * each palette entry carries a generic price-per-litre that the paint
 * calculator multiplies through. The catalog filter requires
 * `eco_certified` to be true (Sustainability charter v1).
 *
 * Per `02-flooring-system.md` the flooring catalog requires ≥4 eco
 * materials (rubber gym matting, fake grass / turf, engineered wood,
 * polished concrete). Bundled here so Tweak 02 ships even before the
 * Flooring Merchants signal lands.
 */

export interface EcoPaintColour {
  /** Stable id for storage. */
  id: string;
  /** Human-facing label shown in the swatch picker. */
  name: string;
  /** CSS hex; Babylon `StandardMaterial.diffuseColor` parses the same. */
  hex: string;
  /** Eco certification tag — drives the eco-only catalog filter. */
  eco_certified: true;
  /**
   * Coverage in m² per litre per coat (manufacturer-spec average for
   * water-based eco paints — Auro, Earthborn, Little Greene Intelligent
   * etc. cluster around 10 m²/L for matt finishes).
   */
  coverage_m2_per_litre: number;
  /**
   * Default number of coats. Almost all eco paints require 2 to reach
   * the spec coverage on bare or recoated walls.
   */
  default_coats: number;
  /**
   * Placeholder price per 1 L tin in MUR — Mauritius market. Swapped
   * for live merchant SKUs once the supplier list lands.
   */
  price_per_litre_mur: number;
}

/** 12-colour no-VOC starter palette per Tweak 03 §1. */
export const ECO_PAINT_PALETTE: EcoPaintColour[] = [
  {
    id: 'cream-shell',
    name: 'Cream Shell',
    hex: '#F5EFE6',
    eco_certified: true,
    coverage_m2_per_litre: 10,
    default_coats: 2,
    price_per_litre_mur: 850,
  },
  {
    id: 'pebble-grey',
    name: 'Pebble Grey',
    hex: '#D9D2C5',
    eco_certified: true,
    coverage_m2_per_litre: 10,
    default_coats: 2,
    price_per_litre_mur: 850,
  },
  {
    id: 'sage-leaf',
    name: 'Sage Leaf',
    hex: '#A3B18A',
    eco_certified: true,
    coverage_m2_per_litre: 10,
    default_coats: 2,
    price_per_litre_mur: 920,
  },
  {
    id: 'eucalyptus',
    name: 'Eucalyptus',
    hex: '#587B6F',
    eco_certified: true,
    coverage_m2_per_litre: 10,
    default_coats: 2,
    price_per_litre_mur: 920,
  },
  {
    id: 'soft-clay',
    name: 'Soft Clay',
    hex: '#D7B89C',
    eco_certified: true,
    coverage_m2_per_litre: 10,
    default_coats: 2,
    price_per_litre_mur: 880,
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    hex: '#B05B3B',
    eco_certified: true,
    coverage_m2_per_litre: 10,
    default_coats: 2,
    price_per_litre_mur: 980,
  },
  {
    id: 'mist-blue',
    name: 'Mist Blue',
    hex: '#B0C4D4',
    eco_certified: true,
    coverage_m2_per_litre: 10,
    default_coats: 2,
    price_per_litre_mur: 880,
  },
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    hex: '#2C4A57',
    eco_certified: true,
    coverage_m2_per_litre: 9,
    default_coats: 2,
    price_per_litre_mur: 980,
  },
  {
    id: 'warm-charcoal',
    name: 'Warm Charcoal',
    hex: '#3C3935',
    eco_certified: true,
    coverage_m2_per_litre: 9,
    default_coats: 2,
    price_per_litre_mur: 980,
  },
  {
    id: 'oat-milk',
    name: 'Oat Milk',
    hex: '#E8E0CE',
    eco_certified: true,
    coverage_m2_per_litre: 10,
    default_coats: 2,
    price_per_litre_mur: 820,
  },
  {
    id: 'olive-bark',
    name: 'Olive Bark',
    hex: '#6B5E3C',
    eco_certified: true,
    coverage_m2_per_litre: 10,
    default_coats: 2,
    price_per_litre_mur: 940,
  },
  {
    id: 'wellness-gold',
    name: 'Wellness Gold',
    hex: '#C0A67E',
    eco_certified: true,
    coverage_m2_per_litre: 10,
    default_coats: 2,
    price_per_litre_mur: 1040,
  },
];

export function findPaintById(id: string): EcoPaintColour | undefined {
  return ECO_PAINT_PALETTE.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// Tweak 02 — eco flooring materials
// ---------------------------------------------------------------------------

export interface EcoFlooringMaterial {
  id: string;
  name: string;
  /** SVG fill / Babylon diffuse colour used as a stand-in until real textures land. */
  hex: string;
  eco_certified: true;
  /** Price per m² in MUR — K1-Sport list price (2026-05-22). */
  price_per_m2_mur: number;
  /** Tagline shown in the flooring catalog tile. */
  tagline: string;
  /** Source merchant slug (matches `merchants.slug` in the DB). */
  supplier_slug: string;
  /** Original K1-Sport SKU / product URL fragment for traceability. */
  source_ref: string;
}

/**
 * 4 K1-Sport flooring SKUs seeded 2026-05-22 (Vic-Y picked K1 over
 * Ideco / Batimex). All four pass the CHARTER eco-bar v1 via
 * recycled-content rubber crumb / EPDM (commercial gym-grade typical
 * for the K1 line). Prices are 2026-05-22 list MUR direct from
 * k1-sport.com/shop-online/category/flooring; per-m² values reflect
 * tile pack sizes (e.g. 50×50×1.5cm tile = 4 tiles/m², 500 × 4 = 2000).
 *
 * IDs were intentionally renamed from the pre-Vic placeholders
 * (rubber-gym-mat / fake-grass-turf / engineered-wood / polished-concrete);
 * any local-stored floor zones that referenced the old IDs render
 * material-less (the canvas draws the polygon outline only) until the
 * user re-paints — acceptable for Phase A since zones aren't yet
 * cloud-synced.
 */
export const ECO_FLOORING_CATALOG: EcoFlooringMaterial[] = [
  {
    id: 'k1-eva-combat-mat',
    name: 'K1 EVA Combat Sport Mat',
    hex: '#1A1A1A',
    eco_certified: true,
    price_per_m2_mur: 850,
    tagline: 'Recycled-EVA crumb · combat & calisthenics · 1m × 1m × 2.5cm',
    supplier_slug: 'k1-sport',
    source_ref: 'eva-combat-sport-mat-1m-1m-2-5cm',
  },
  {
    id: 'k1-rubber-interlock',
    name: 'K1 Interlock Composite Rubber',
    hex: '#2E2E2E',
    eco_certified: true,
    price_per_m2_mur: 2000,
    tagline: 'Recycled-rubber crumb · seamless strength-training floor · 50 × 50 × 1.5 cm',
    supplier_slug: 'k1-sport',
    source_ref: 'interlock-composite-rubber-50x50-15mm',
  },
  {
    id: 'k1-outdoor-rubber-tile',
    name: 'K1 Outdoor Rubber Tile (Red)',
    hex: '#4A2020',
    eco_certified: true,
    price_per_m2_mur: 1500,
    tagline: 'Recycled-rubber heavy-duty · noise absorption · 1m × 1m × 5cm',
    supplier_slug: 'k1-sport',
    source_ref: 'outdoor-rubber-tiles-1m-1m-50mm-red',
  },
  {
    id: 'k1-epdm-roll-6mm',
    name: 'K1 EPDM Rubber Roll 6 mm',
    hex: '#5A5A5A',
    eco_certified: true,
    price_per_m2_mur: 2500,
    tagline: 'EPDM seamless roll · cardio / aerobic gym grade',
    supplier_slug: 'k1-sport',
    source_ref: 'rubber-flooring-rolls-epdm-6mm-grey',
  },
];

export function findFlooringById(id: string): EcoFlooringMaterial | undefined {
  return ECO_FLOORING_CATALOG.find((f) => f.id === id);
}
