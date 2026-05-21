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
  /** Price per m² in MUR — placeholder pending Flooring Merchants list. */
  price_per_m2_mur: number;
  /** Tagline shown in the flooring catalog tile. */
  tagline: string;
}

/** 4 eco materials per Tweak 02 §2. */
export const ECO_FLOORING_CATALOG: EcoFlooringMaterial[] = [
  {
    id: 'rubber-gym-mat',
    name: 'Rubber Gym Matting',
    hex: '#2E2E2E',
    eco_certified: true,
    price_per_m2_mur: 1800,
    tagline: 'Recycled-rubber crumb · drop-rated for free weights',
  },
  {
    id: 'fake-grass-turf',
    name: 'Eco Turf',
    hex: '#5BA152',
    eco_certified: true,
    price_per_m2_mur: 1400,
    tagline: '100% recyclable polyethylene turf · sled-pull friendly',
  },
  {
    id: 'engineered-wood',
    name: 'FSC Engineered Wood',
    hex: '#B07A3F',
    eco_certified: true,
    price_per_m2_mur: 2600,
    tagline: 'FSC-certified oak veneer · low-VOC adhesive',
  },
  {
    id: 'polished-concrete',
    name: 'Polished Concrete',
    hex: '#A6A6A4',
    eco_certified: true,
    price_per_m2_mur: 1200,
    tagline: 'Sealed in-situ · long-life finish · no VOCs',
  },
];

export function findFlooringById(id: string): EcoFlooringMaterial | undefined {
  return ECO_FLOORING_CATALOG.find((f) => f.id === id);
}
