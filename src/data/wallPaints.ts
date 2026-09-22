/**
 * Wall paints — a brand-agnostic catalogue, Sofap (Permoglaze) first
 * (Vic 2026-09-02; brands, tints and tint bases 2026-09-14).
 *
 * Paint is sold by the TIN, not the litre — the calculator turns painted
 * wall AREA (length × wall height − door/window openings) into litres
 * (area × coats ÷ coverage, plus a touch-up contingency) and then into
 * whole purchasable tins, exactly the way the floor tool prices whole
 * tiles/rolls. See `src/designer/wallPaintCalc.ts`.
 *
 * SOURCED VALUES. Every tin price below was read from ONE seller — Sofap's
 * own online store (sofaponlinestore.mu, WooCommerce Store API, MUR
 * incl. 15 % VAT) — on the `priced_at` date, one SKU per base:
 * `<LINE> WHITE` is the ready-mixed white (`tins`), `<LINE> PASTEL /
 * MEDIUM / BASIC` are the Colour Match tint bases (`tintBases`): a tinted
 * tin is priced on the base the colour needs, and the price steps up with
 * the depth of the colour. Coverage and coats come from Sofap's Technical
 * Data Sheets (revision cited per product); the calculator quotes the
 * spread-rate midpoint and prints the range. Colours: see
 * `sofapColours.ts` — Sofap publishes its own hex values.
 *
 * Adding another paint company: a `PAINT_BRANDS` row, its products here
 * with `brandId`, its colours in `PAINT_COLOURS` (or on the product).
 * Never invent a price, a coverage or a colour — cite the source.
 */

import { SOFAP_A_LA_CARTE, sofapColourMatchToPaintColours, type SofapColourMatchRow } from './sofapColours';
import { TINTEX_BRAND, TINTEX_BRAND_ID, TINTEX_PAINTS } from './tintexPaints';
import { ralToPaintColour, tintexCardFrom, type RalRow } from './tintexColours';
import ralClassicJson from './ralClassic.json';

export interface WallPaintTin {
  sizeL: number;
  priceMur: number;
}

/**
 * A paint company (2026-09-14). The tool caters to every brand the same
 * way: a brand owns products; products own tins, coverage and coats; a
 * brand (or a product) owns the colours it can be tinted to.
 */
export interface PaintBrand {
  /** Stable id — never rename once shipped. */
  id: string;
  name: string;
  /** Where the customer buys. */
  website?: string;
  country: string;
  /** How the brand tints — shown once in the panel, e.g. "Colour Match, 20 000 shades". */
  colourSystem?: string;
  /** Name of the on-demand chart behind "All … shades" (Sofap "Colour Match", TintEX "RAL Classic"). */
  chartName?: string;
  /** The brand's primer for bare plaster (`WallPaint.id` with category 'primer'), if priced. */
  primerId?: string;
}

/**
 * A named tint. `hex` is what the wall renders in; `hexOrigin` says how
 * honest that hex is — a brand's published RGB, a value sampled from the
 * brand's own swatch image, or a representative tone chosen here.
 */
export interface PaintColour {
  id: string;
  brandId: string;
  name: string;
  hex: string;
  /** The brand's own code for the shade, when it has one. */
  code?: string;
  collection?: string;
  hexOrigin: 'official' | 'sampled-from-image' | 'representative';
  source_url?: string;
  /** The tint base this shade is mixed on (`PaintTintBase.id`), when the brand prices by base. */
  baseId?: string;
  /**
   * True when `baseId` was INFERRED (e.g. from the depth band in the brand's
   * colour code) rather than named by the brand — priced on that base but
   * shown as an estimate.
   */
  baseInferred?: boolean;
}

/**
 * A tint base (2026-09-14). Mauritian manufacturers price a tinted tin by
 * the BASE it is mixed on - pale / mid / deep - and the price steps up with
 * the depth of the colour. When a product carries `tintBases`, a tinted
 * wall is priced on the base the colour needs; the plain `tins` are the
 * ready-made white. A base with `minLightness` is chosen for a custom hex
 * by the colour's lightness (0 black - 100 white) when the brand has not
 * named the base itself - flagged as an estimate wherever it is shown.
 */
export interface PaintTintBase {
  id: string;
  name: string;
  /** Colours at least this light (L* 0–100) mix on this base; bases listed pale to deep. */
  minLightness?: number;
  tins: WallPaintTin[];
}

export interface WallPaint {
  /** Stable id for storage — never rename once shipped. */
  id: string;
  name: string;
  brand: string;
  /** `PaintBrand.id` — absent means Sofap (the first brand loaded). */
  brandId?: string;
  /**
   * Can this line be tinted? A white-only line (Xtreme White) offers no
   * colours; a tintable line offers the brand's tints plus a custom hex.
   * Absent = tintable.
   */
  tintable?: boolean;
  /** Colours specific to this line (a fixed-shade range). Absent = the brand's tints. */
  colours?: PaintColour[];
  /** Priced tint bases, pale to deep. Absent = every tint is priced at the base tins. */
  tintBases?: PaintTintBase[];
  /** Product page / photo, for the panel. Never hot-linked into the plan. */
  product_url?: string;
  image_url?: string;
  finish: 'matt' | 'silk' | 'satin' | 'gloss' | 'smooth' | 'textured';
  use: 'interior' | 'exterior' | 'both';
  /** Shown in the panel's short list; the rest sit behind "More lines". */
  featured?: boolean;
  /** 'primer' lines are quoted under a paint, never offered as a wall colour. Absent = paint. */
  category?: 'paint' | 'primer';
  /** m² covered by ONE litre in ONE coat (datasheet spread-rate midpoint). */
  coverage_m2_per_l: number;
  /** The datasheet's spread-rate range, when it publishes one. */
  coverage_low_m2_per_l?: number;
  coverage_high_m2_per_l?: number;
  /**
   * True when the brand publishes NO spread rate and a category norm stands
   * in — the panel and the breakdown mark the figure "(est.)" wherever it
   * is used. Never set on a line whose datasheet states a yield.
   */
  coverage_estimated?: boolean;
  /** Where the spread rate comes from (the datasheet quote, or the estimate's reasoning). */
  coverage_source?: string;
  /** How the tin prices were obtained when the source is not the seller's live list (a dated capture, a quote). */
  price_note?: string;
  /** Coats assumed for full coverage. */
  recommended_coats: number;
  /** Where the coats figure comes from (TDS revision, or "standard practice"). */
  coats_source?: string;
  /** ISO date the tin prices were read from the seller. */
  priced_at?: string;
  /** Prices include VAT (Mauritian retail lists do). */
  vat_inclusive?: boolean;
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
/**
 * Bare, unpainted plaster — the ONE value the 2D lift, the 3D stage and the
 * "unknown paint" fallback share. Greyer than any white paint on purpose
 * (Vic 2026-09-17: a white brush on near-white plaster changed a wall by
 * 4–9/255 — the first click looked like nothing happened). The Sims draws
 * bare drywall as its own texture; a white paint must visibly land on it.
 */
export const BARE_PLASTER_HEX = '#D9D3C6';

export const DEFAULT_WALL_HEIGHT_M = 2.7;
export const MIN_WALL_HEIGHT_M = 2.0;
export const MAX_WALL_HEIGHT_M = 4.0;

/** Standard opening heights used to subtract door/window area from a wall. */
export const OPENING_DOOR_HEIGHT_M = 2.04;
export const OPENING_WINDOW_HEIGHT_M = 1.2;

/**
 * Measurement rules (audit 2026-09-14, checked against manufacturer
 * calculators and the RICS NRM2 net-measurement convention):
 *  - openings of 1.00 m² or more are deducted; smaller ones are not, because
 *    their reveals and cutting-in use the paint (NRM2 rule);
 *  - a contingency for touch-ups is added before the tins are chosen —
 *    10 % is the estimating norm, 15 % on a tinted colour because a re-tint
 *    may not match; the customer can set 0–25 %;
 *  - ceilings are never included and skirting is not deducted.
 */
export const MIN_DEDUCTIBLE_OPENING_M2 = 1.0;
export const DEFAULT_PAINT_WASTE_PCT = 10;
export const TINTED_PAINT_WASTE_PCT = 15;
export const MAX_PAINT_WASTE_PCT = 25;
export const MIN_PAINT_COATS = 1;
export const MAX_PAINT_COATS = 3;

/** Sofap's three Colour Match bases, pale → deep. Lightness thresholds are the calculator's own estimate for colours Sofap has not assigned. */
const SOFAP_BASES = {
  pastel: { id: 'pastel', name: 'Pastel base', minLightness: 72 },
  medium: { id: 'medium', name: 'Medium base', minLightness: 45 },
  basic: { id: 'basic', name: 'Basic base', minLightness: 0 },
} as const;
const sofapBase = (id: keyof typeof SOFAP_BASES, tins: WallPaintTin[]): PaintTintBase => ({ ...SOFAP_BASES[id], tins });
const SOFAP_PRICED_AT = '2026-09-14';
const SOFAP_STORE = 'https://www.sofaponlinestore.mu/product/';

export const WALL_PAINTS: WallPaint[] = [
  {
    id: 'permoglaze-matt-emulsion',
    name: 'Permoglaze Matt Emulsion',
    brand: 'Permoglaze (Sofap)',
    brandId: 'sofap',
    featured: true,
    finish: 'matt',
    use: 'both', // TDS Rev 006: interior and exterior
    coverage_m2_per_l: 9,
    coverage_low_m2_per_l: 8,
    coverage_high_m2_per_l: 10,
    recommended_coats: 3,
    coats_source: 'Sofap TDS Rev 006 (08 Dec 2022): "3 coats are recommended for optimum performance"',
    priced_at: SOFAP_PRICED_AT,
    vat_inclusive: true,
    // Ready-mixed white: EMULSION BRILLIANT WHITE (EPWHI001/005/020).
    tins: [
      { sizeL: 1, priceMur: 201.25 },
      { sizeL: 5, priceMur: 816.5 },
      { sizeL: 20, priceMur: 3168.25 },
    ],
    tintBases: [
      sofapBase('pastel', [{ sizeL: 1, priceMur: 235.75 }, { sizeL: 5, priceMur: 948.75 }, { sizeL: 20, priceMur: 3674.25 }]),
      sofapBase('medium', [{ sizeL: 1, priceMur: 322 }, { sizeL: 5, priceMur: 1385.75 }, { sizeL: 20, priceMur: 5445.25 }]),
      sofapBase('basic', [{ sizeL: 1, priceMur: 419.75 }, { sizeL: 5, priceMur: 1828.5 }, { sizeL: 20, priceMur: 7193.25 }]),
    ],
    hex: '#F4F2EB',
    product_url: 'https://sofap.mu/product/permoglaze-matt-emulsion/',
    source_urls: [
      'https://sofap.mu/product/permoglaze-matt-emulsion/',
      `${SOFAP_STORE}emulsion-brilliant-white/`,
      `${SOFAP_STORE}emulsion-pastel-aps/`,
      `${SOFAP_STORE}emulsion-medium-aps/`,
      `${SOFAP_STORE}emulsion-basic-aps/`,
    ],
  },
  {
    id: 'permoglaze-soft-feel',
    name: 'Permoglaze Soft Feel',
    brand: 'Permoglaze (Sofap)',
    brandId: 'sofap',
    featured: true,
    finish: 'silk', // Sofap's velvet-sheen washable line (Eco-Label MS 189)
    use: 'interior',
    coverage_m2_per_l: 9,
    coverage_low_m2_per_l: 8,
    coverage_high_m2_per_l: 10,
    recommended_coats: 2,
    coats_source: 'Sofap TDS: 2 coats over 1 coat of Permoglaze Matt Emulsion as primer (primer not included here)',
    priced_at: SOFAP_PRICED_AT,
    vat_inclusive: true,
    tins: [
      { sizeL: 1, priceMur: 316.25 },
      { sizeL: 5, priceMur: 1345.5 },
      { sizeL: 20, priceMur: 5226.75 },
    ],
    tintBases: [
      sofapBase('pastel', [{ sizeL: 1, priceMur: 327.75 }, { sizeL: 5, priceMur: 1374.25 }, { sizeL: 20, priceMur: 5399.25 }]),
      sofapBase('medium', [{ sizeL: 1, priceMur: 396.75 }, { sizeL: 5, priceMur: 1742.25 }, { sizeL: 20, priceMur: 6859.75 }]),
      sofapBase('basic', [{ sizeL: 1, priceMur: 465.75 }, { sizeL: 5, priceMur: 2116 }, { sizeL: 20, priceMur: 8314.5 }]),
    ],
    hex: '#EDE8DE',
    product_url: 'https://sofap.mu/product/permoglaze-soft-feel/',
    source_urls: [
      'https://sofap.mu/product/permoglaze-soft-feel/',
      `${SOFAP_STORE}soft-feel-white/`,
      `${SOFAP_STORE}soft-feel-pastel/`,
      `${SOFAP_STORE}soft-feel-medium/`,
      `${SOFAP_STORE}soft-feel-basic/`,
    ],
  },
  {
    id: 'permoglaze-xtreme-white',
    name: 'Permoglaze Xtreme White',
    brand: 'Permoglaze (Sofap)',
    brandId: 'sofap',
    featured: true,
    finish: 'matt',
    use: 'interior',
    coverage_m2_per_l: 10.5,
    coverage_low_m2_per_l: 9,
    coverage_high_m2_per_l: 12,
    recommended_coats: 2,
    coats_source: 'Sofap TDS: 2–3 coats; 2 quoted for white over white, set 3 over a strong colour',
    priced_at: SOFAP_PRICED_AT,
    vat_inclusive: true,
    tintable: false, // white-only line
    tins: [
      { sizeL: 1, priceMur: 201.25 },
      { sizeL: 5, priceMur: 816.5 },
      { sizeL: 20, priceMur: 3168.25 },
    ],
    hex: '#F7F7F1',
    product_url: 'https://sofap.mu/product/permoglaze-xtreme-white/',
    source_urls: ['https://sofap.mu/product/permoglaze-xtreme-white/', `${SOFAP_STORE}xtreme-white/`],
  },
  {
    id: 'permoglaze-aquashield',
    name: 'Permoglaze Aquashield',
    brand: 'Permoglaze (Sofap)',
    brandId: 'sofap',
    featured: true,
    finish: 'satin', // velvety low-sheen exterior
    use: 'exterior',
    coverage_m2_per_l: 10,
    coverage_low_m2_per_l: 10,
    coverage_high_m2_per_l: 12,
    recommended_coats: 3,
    coats_source: 'Sofap TDS Rev 005 (24 Jul 2019): "A solid finish is obtained with 3 coats"; spreading rate ±10 m²/L/coat',
    priced_at: SOFAP_PRICED_AT,
    vat_inclusive: true,
    tins: [
      { sizeL: 1, priceMur: 523.25 },
      { sizeL: 5, priceMur: 2369 },
      { sizeL: 20, priceMur: 9315 },
    ],
    tintBases: [
      sofapBase('pastel', [{ sizeL: 1, priceMur: 534.75 }, { sizeL: 5, priceMur: 2432.25 }, { sizeL: 20, priceMur: 9596.75 }]),
      sofapBase('medium', [{ sizeL: 1, priceMur: 655.5 }, { sizeL: 5, priceMur: 2978.5 }, { sizeL: 20, priceMur: 11810.5 }]),
      sofapBase('basic', [{ sizeL: 1, priceMur: 770.5 }, { sizeL: 5, priceMur: 3536.25 }, { sizeL: 20, priceMur: 14018.5 }]),
    ],
    hex: '#E9E4D8',
    product_url: 'https://sofap.mu/product/permoglaze-aquashield/',
    source_urls: [
      'https://sofap.mu/product/permoglaze-aquashield/',
      `${SOFAP_STORE}aquashield-white/`,
      `${SOFAP_STORE}aquashield-pastel/`,
      `${SOFAP_STORE}aquashield-medium/`,
      `${SOFAP_STORE}aquashield-basic/`,
    ],
  },
  {
    id: 'permoglaze-anti-fungus',
    name: 'Permoglaze Anti-Fungus',
    brand: 'Permoglaze (Sofap)',
    brandId: 'sofap',
    featured: true,
    finish: 'matt',
    use: 'exterior', // sofap.mu lists it under exterior; "concrete surfaces in very humid regions"
    coverage_m2_per_l: 9,
    coverage_low_m2_per_l: 8,
    coverage_high_m2_per_l: 10,
    recommended_coats: 2,
    coats_source: 'Sofap TDS Rev 004 (03 Aug 2017) states no coat count; 2 = standard practice. Pre-treat with Biocidal Wall Wash + Fungicidal Treatment',
    priced_at: SOFAP_PRICED_AT,
    vat_inclusive: true,
    tins: [
      { sizeL: 1, priceMur: 448.5 },
      { sizeL: 5, priceMur: 1759.5 },
      { sizeL: 20, priceMur: 6894.25 },
    ],
    tintBases: [
      sofapBase('pastel', [{ sizeL: 1, priceMur: 465.75 }, { sizeL: 5, priceMur: 1863 }, { sizeL: 20, priceMur: 7319.75 }]),
      sofapBase('medium', [{ sizeL: 1, priceMur: 586.5 }, { sizeL: 5, priceMur: 2334.5 }, { sizeL: 20, priceMur: 9125.25 }]),
      sofapBase('basic', [{ sizeL: 1, priceMur: 707.25 }, { sizeL: 5, priceMur: 2811.75 }, { sizeL: 20, priceMur: 10919.25 }]),
    ],
    hex: '#EAE7DB',
    product_url: 'https://sofap.mu/product/permoglaze-anti-fungus/',
    source_urls: [
      'https://sofap.mu/product/permoglaze-anti-fungus/',
      `${SOFAP_STORE}antifungus-white/`,
      `${SOFAP_STORE}antifungus-pastel/`,
      `${SOFAP_STORE}antifungus-medium/`,
      `${SOFAP_STORE}antifungus-basic/`,
    ],
  },
  // ---- the rest of the Sofap decorative range (TDS + store, 2026-09-14) ----
  {
    id: 'permoglaze-vip-satin',
    name: 'Permoglaze VIP Satin',
    brand: 'Permoglaze (Sofap)',
    brandId: 'sofap',
    finish: 'satin',
    use: 'interior',
    coverage_m2_per_l: 9,
    coverage_low_m2_per_l: 8,
    coverage_high_m2_per_l: 10,
    recommended_coats: 3,
    coats_source: 'Sofap TDS Rev 004 (03 Aug 2017): "3 coats are recommended for optimum performance"',
    priced_at: SOFAP_PRICED_AT,
    vat_inclusive: true,
    // washable silk-sheen interior; sofap.mu web table says 6–7 m²/L, the TDS 8–10 is used. Coverage: https://sofap.mu/wp-content/uploads/2021/11/VIP-SATIN_TDS_ENG.pdf
    tins: [{ sizeL: 1, priceMur: 310.5 }, { sizeL: 5, priceMur: 1345.5 }, { sizeL: 20, priceMur: 5244 }],
    tintBases: [
      sofapBase('pastel', [{ sizeL: 1, priceMur: 327.75 }, { sizeL: 5, priceMur: 1443.25 }, { sizeL: 20, priceMur: 5669.5 }]),
      sofapBase('medium', [{ sizeL: 1, priceMur: 448.5 }, { sizeL: 5, priceMur: 2006.75 }, { sizeL: 20, priceMur: 7883.25 }]),
      sofapBase('basic', [{ sizeL: 1, priceMur: 563.5 }, { sizeL: 5, priceMur: 2553 }, { sizeL: 20, priceMur: 10091.25 }]),
    ],
    hex: '#EFECE4',
    product_url: 'https://www.sofaponlinestore.mu/product/vip-satin-white/',
    source_urls: [`${SOFAP_STORE}vip-satin-white/`, `${SOFAP_STORE}vip-satin-pastel/`, `${SOFAP_STORE}vip-satin-medium/`, `${SOFAP_STORE}vip-satin-basic/`, 'https://sofap.mu/wp-content/uploads/2021/11/VIP-SATIN_TDS_ENG.pdf'],
  },
  {
    id: 'permotop',
    name: 'Permotop',
    brand: 'Permoglaze (Sofap)',
    brandId: 'sofap',
    finish: 'matt',
    use: 'both',
    coverage_m2_per_l: 10,
    coverage_low_m2_per_l: 10,
    coverage_high_m2_per_l: 10,
    recommended_coats: 2,
    coats_source: 'Sofap TDS Rev 006 (24 Jul 2019) states no coat count; 2 = standard practice',
    priced_at: SOFAP_PRICED_AT,
    vat_inclusive: true,
    // semi-humid, humid and coastal regions. Coverage: https://sofap.mu/wp-content/uploads/2021/11/PERMOTOP_TDS_ENG-Rev-06.pdf
    tins: [{ sizeL: 1, priceMur: 396.75 }, { sizeL: 5, priceMur: 1759.5 }, { sizeL: 20, priceMur: 6877 }],
    tintBases: [
      sofapBase('pastel', [{ sizeL: 1, priceMur: 431.25 }, { sizeL: 5, priceMur: 1903.25 }, { sizeL: 20, priceMur: 7457.75 }]),
      sofapBase('medium', [{ sizeL: 1, priceMur: 523.25 }, { sizeL: 5, priceMur: 2357.5 }, { sizeL: 20, priceMur: 9292 }]),
      sofapBase('basic', [{ sizeL: 1, priceMur: 626.75 }, { sizeL: 5, priceMur: 2811.75 }, { sizeL: 20, priceMur: 11126.25 }]),
    ],
    hex: '#ECE9E0',
    product_url: 'https://www.sofaponlinestore.mu/product/permotop-white/',
    source_urls: [`${SOFAP_STORE}permotop-white/`, `${SOFAP_STORE}permotop-pastel/`, `${SOFAP_STORE}permotop-medium/`, `${SOFAP_STORE}permotop-basic/`, 'https://sofap.mu/wp-content/uploads/2021/11/PERMOTOP_TDS_ENG-Rev-06.pdf'],
  },
  {
    id: 'permoglaze-multi-task',
    name: 'Permoglaze Multi-Task',
    brand: 'Permoglaze (Sofap)',
    brandId: 'sofap',
    finish: 'smooth',
    use: 'both',
    coverage_m2_per_l: 10,
    coverage_low_m2_per_l: 10,
    coverage_high_m2_per_l: 10,
    recommended_coats: 3,
    coats_source: 'Sofap TDS Rev 006 (11 Oct 2022): "3 coats are recommended for best performance"',
    priced_at: SOFAP_PRICED_AT,
    vat_inclusive: true,
    // all-purpose acrylic: metal, wood, concrete, plaster, PVC. Coverage: https://sofap.mu/wp-content/uploads/2023/05/MULTI-TASK_TDS_ENG_Oct-2022.pdf
    tins: [{ sizeL: 1, priceMur: 500.25 }, { sizeL: 5, priceMur: 2294.25 }, { sizeL: 20, priceMur: 9165.5 }],
    tintBases: [
      sofapBase('pastel', [{ sizeL: 1, priceMur: 506 }, { sizeL: 5, priceMur: 2305.75 }, { sizeL: 20, priceMur: 9228.75 }]),
      sofapBase('medium', [{ sizeL: 1, priceMur: 586.5 }, { sizeL: 5, priceMur: 2714 }, { sizeL: 20, priceMur: 10838.75 }]),
      sofapBase('basic', [{ sizeL: 1, priceMur: 672.75 }, { sizeL: 5, priceMur: 3151 }, { sizeL: 20, priceMur: 12604 }]),
    ],
    hex: '#EBE9E3',
    product_url: 'https://www.sofaponlinestore.mu/product/multi-task-white/',
    source_urls: [`${SOFAP_STORE}multi-task-white/`, `${SOFAP_STORE}multi-task-pastel/`, `${SOFAP_STORE}multi-task-medium/`, `${SOFAP_STORE}multi-task-basic/`, 'https://sofap.mu/wp-content/uploads/2023/05/MULTI-TASK_TDS_ENG_Oct-2022.pdf'],
  },
  {
    id: 'permoglaze-ultra-matt',
    name: 'Permoglaze Ultra Matt (Breatheasy)',
    brand: 'Permoglaze (Sofap)',
    brandId: 'sofap',
    finish: 'matt',
    use: 'interior',
    coverage_m2_per_l: 9,
    coverage_low_m2_per_l: 8,
    coverage_high_m2_per_l: 10,
    recommended_coats: 2,
    coats_source: 'Sofap TDS Rev 002 (02 Sep 2020) states no coat count; 2 = standard practice',
    priced_at: SOFAP_PRICED_AT,
    vat_inclusive: true,
    // ultra-low VOC, solvent free; sold online as Breatheasy. Coverage: https://sofap.mu/wp-content/uploads/2021/11/Ultra-Matt_ENG-TDS_02-September-2020.pdf
    tins: [{ sizeL: 1, priceMur: 304.75 }, { sizeL: 5, priceMur: 1299.5 }, { sizeL: 20, priceMur: 4939.25 }],
    tintBases: [
      sofapBase('pastel', [{ sizeL: 1, priceMur: 327.75 }, { sizeL: 5, priceMur: 1431.75 }, { sizeL: 20, priceMur: 7279.5 }]),
      sofapBase('medium', [{ sizeL: 1, priceMur: 431.25 }, { sizeL: 5, priceMur: 1891.75 }, { sizeL: 20, priceMur: 9297.75 }]),
      sofapBase('basic', [{ sizeL: 1, priceMur: 529 }, { sizeL: 5, priceMur: 2346 }, { sizeL: 20, priceMur: 11839.25 }]),
    ],
    hex: '#F1EFE8',
    product_url: 'https://www.sofaponlinestore.mu/product/breatheasy-ultra-matt-white/',
    source_urls: [`${SOFAP_STORE}breatheasy-ultra-matt-white/`, `${SOFAP_STORE}breatheasy-ultra-matt-pastel/`, `${SOFAP_STORE}breatheasy-ultra-matt-medium/`, `${SOFAP_STORE}breatheasy-ultra-matt-basic/`, 'https://sofap.mu/wp-content/uploads/2021/11/Ultra-Matt_ENG-TDS_02-September-2020.pdf'],
  },
  {
    id: 'permoglaze-anti-bacterial',
    name: 'Permoglaze Anti-Bacterial',
    brand: 'Permoglaze (Sofap)',
    brandId: 'sofap',
    finish: 'silk',
    use: 'interior',
    coverage_m2_per_l: 9,
    coverage_low_m2_per_l: 8,
    coverage_high_m2_per_l: 10,
    recommended_coats: 3,
    coats_source: 'Sofap TDS Rev 001 (03 Sep 2020): dilution given for 1st, 2nd and 3rd coat',
    priced_at: SOFAP_PRICED_AT,
    vat_inclusive: true,
    // JIS Z2801 anti-bacterial — hospitals, schools, kitchens. Coverage: https://sofap.mu/wp-content/uploads/2021/11/Anti-Bacterial-Paint-TDS_ENG-03-SEP-2020.pdf
    tins: [{ sizeL: 1, priceMur: 431.25 }, { sizeL: 5, priceMur: 1886 }, { sizeL: 20, priceMur: 7388.75 }],
    tintBases: [
      sofapBase('pastel', [{ sizeL: 1, priceMur: 460 }, { sizeL: 5, priceMur: 2156.25 }, { sizeL: 20, priceMur: 8809 }]),
      sofapBase('medium', [{ sizeL: 1, priceMur: 603.75 }, { sizeL: 5, priceMur: 2840.5 }, { sizeL: 20, priceMur: 10706.5 }]),
      sofapBase('basic', [{ sizeL: 1, priceMur: 747.5 }, { sizeL: 5, priceMur: 3519 }, { sizeL: 20, priceMur: 13627.5 }]),
    ],
    hex: '#EEEDE6',
    product_url: 'https://www.sofaponlinestore.mu/product/anti-bacterial-white/',
    source_urls: [`${SOFAP_STORE}anti-bacterial-white/`, `${SOFAP_STORE}c-m-anti-bacterial-pastel/`, `${SOFAP_STORE}c-m-anti-bacterial-medium/`, `${SOFAP_STORE}c-m-anti-bacterial-basic/`, 'https://sofap.mu/wp-content/uploads/2021/11/Anti-Bacterial-Paint-TDS_ENG-03-SEP-2020.pdf'],
  },
  {
    id: 'permoglaze-flexible-acrylic',
    name: 'Permoglaze Flexible Acrylic',
    brand: 'Permoglaze (Sofap)',
    brandId: 'sofap',
    finish: 'matt',
    use: 'exterior',
    coverage_m2_per_l: 9,
    coverage_low_m2_per_l: 8,
    coverage_high_m2_per_l: 10,
    recommended_coats: 2,
    coats_source: 'Sofap TDS Rev 004 (03 Aug 2017): "2-3 coats are recommended"; 2 quoted',
    priced_at: SOFAP_PRICED_AT,
    vat_inclusive: true,
    // elastic waterproofing for outside walls and inclined roofs; exterior only. Coverage: https://sofap.mu/wp-content/uploads/2021/11/FLEXIBLE-ACYLIC_TDS_ENG_APR19.pdf
    tins: [{ sizeL: 5, priceMur: 1891.75 }, { sizeL: 20, priceMur: 7204.75 }],
    tintBases: [
      sofapBase('pastel', [{ sizeL: 1, priceMur: 402.5 }, { sizeL: 5, priceMur: 2064.25 }, { sizeL: 20, priceMur: 7365.75 }]),
      sofapBase('medium', [{ sizeL: 1, priceMur: 460 }, { sizeL: 5, priceMur: 2323 }, { sizeL: 20, priceMur: 8878 }]),
      sofapBase('basic', [{ sizeL: 1, priceMur: 523.25 }, { sizeL: 5, priceMur: 2673.75 }, { sizeL: 20, priceMur: 10235 }]),
    ],
    hex: '#E8E5DC',
    product_url: 'https://www.sofaponlinestore.mu/product/flex-acry-white/',
    source_urls: [`${SOFAP_STORE}flex-acry-white/`, `${SOFAP_STORE}flex-acry-pnt-p/`, `${SOFAP_STORE}flex-acry-pnt-medium/`, `${SOFAP_STORE}flex-acry-pnt-b/`, 'https://sofap.mu/wp-content/uploads/2021/11/FLEXIBLE-ACYLIC_TDS_ENG_APR19.pdf'],
  },
  {
    id: 'permoglaze-aqua-gloss',
    name: 'Permoglaze Aqua Gloss',
    brand: 'Permoglaze (Sofap)',
    brandId: 'sofap',
    finish: 'gloss',
    use: 'both',
    coverage_m2_per_l: 11,
    coverage_low_m2_per_l: 10,
    coverage_high_m2_per_l: 12,
    recommended_coats: 2,
    coats_source: 'Sofap TDS Rev 004 (03 Aug 2017) states no coat count; 2 = standard practice',
    priced_at: SOFAP_PRICED_AT,
    vat_inclusive: true,
    // water-based gloss for wood, concrete and metal. Coverage: https://sofap.mu/wp-content/uploads/2021/11/Aqua-Gloss_TDS_ENG_APR2019.pdf
    tins: [{ sizeL: 1, priceMur: 523.25 }, { sizeL: 5, priceMur: 2443.75 }],
    tintBases: [
      sofapBase('pastel', [{ sizeL: 1, priceMur: 546.25 }, { sizeL: 5, priceMur: 2564.5 }]),
      sofapBase('medium', [{ sizeL: 1, priceMur: 609.5 }, { sizeL: 5, priceMur: 2944 }]),
      sofapBase('basic', [{ sizeL: 1, priceMur: 701.5 }, { sizeL: 5, priceMur: 3404 }]),
    ],
    hex: '#F0EFEA',
    product_url: 'https://www.sofaponlinestore.mu/product/aqua-gloss-emulsion-white/',
    source_urls: [`${SOFAP_STORE}aqua-gloss-emulsion-white/`, `${SOFAP_STORE}aqua-gloss-emulsion-pastel/`, `${SOFAP_STORE}aqua-gloss-emulsion-medium/`, `${SOFAP_STORE}aqua-gloss-emulsion-basic/`, 'https://sofap.mu/wp-content/uploads/2021/11/Aqua-Gloss_TDS_ENG_APR2019.pdf'],
  },
  {
    id: 'permoglaze-tough-guard',
    name: 'Permoglaze Tough Guard',
    brand: 'Permoglaze (Sofap)',
    brandId: 'sofap',
    finish: 'silk',
    use: 'both',
    coverage_m2_per_l: 8,
    coverage_low_m2_per_l: 8,
    coverage_high_m2_per_l: 8,
    recommended_coats: 2,
    coats_source: 'Sofap TDS Rev 003 (11 Oct 2022) states no coat count; 2 = standard practice',
    priced_at: SOFAP_PRICED_AT,
    vat_inclusive: true,
    // hard-wearing silk sheen for concrete, plaster, wood and metal. Coverage: https://sofap.mu/wp-content/uploads/2023/05/Tough-Guard-TDS-Final_Oct-2022.pdf
    tins: [{ sizeL: 1, priceMur: 609.5 }, { sizeL: 5, priceMur: 2662.25 }, { sizeL: 20, priceMur: 10482.25 }],
    tintBases: [
      sofapBase('pastel', [{ sizeL: 1, priceMur: 649.75 }, { sizeL: 5, priceMur: 2846.25 }, { sizeL: 20, priceMur: 10723.75 }]),
      sofapBase('medium', [{ sizeL: 1, priceMur: 678.5 }, { sizeL: 5, priceMur: 2972.75 }, { sizeL: 20, priceMur: 11758.75 }]),
      sofapBase('basic', [{ sizeL: 1, priceMur: 747.5 }, { sizeL: 5, priceMur: 3283.25 }, { sizeL: 20, priceMur: 13012.25 }]),
    ],
    hex: '#ECEAE2',
    product_url: 'https://www.sofaponlinestore.mu/product/toughguard/',
    source_urls: [`${SOFAP_STORE}toughguard/`, `${SOFAP_STORE}c-m-toughguard-pastel/`, `${SOFAP_STORE}c-m-toughguard-medium/`, `${SOFAP_STORE}c-m-toughguard-basic/`, 'https://sofap.mu/wp-content/uploads/2023/05/Tough-Guard-TDS-Final_Oct-2022.pdf'],
  },
  {
    id: 'permoglaze-heat-guard',
    name: 'Permoglaze Heat Guard',
    brand: 'Permoglaze (Sofap)',
    brandId: 'sofap',
    finish: 'smooth',
    use: 'exterior',
    coverage_m2_per_l: 8,
    coverage_low_m2_per_l: 7,
    coverage_high_m2_per_l: 9,
    recommended_coats: 3,
    coats_source: 'Sofap TDS Rev 001 (07 Sep 2022): "3 coats are recommended for good performance"',
    priced_at: SOFAP_PRICED_AT,
    vat_inclusive: true,
    tintable: false,
    // heat-reflective (85 % TSR) for facades and roofs; white only. Coverage: https://sofap.mu/wp-content/uploads/2023/03/HEAT-GUARD_TDS_ENG_27-FEB-2023.pdf
    tins: [{ sizeL: 5, priceMur: 1914.75 }, { sizeL: 20, priceMur: 7653.25 }],
    hex: '#F5F5F2',
    product_url: 'https://www.sofaponlinestore.mu/product/permoglaze-heat-guard/',
    source_urls: [`${SOFAP_STORE}permoglaze-heat-guard/`, 'https://sofap.mu/wp-content/uploads/2023/03/HEAT-GUARD_TDS_ENG_27-FEB-2023.pdf'],
  },
  // ---- Sofap primer for bare / new plaster (quoted under the paints, never a wall colour) ----
  {
    id: 'permoglaze-aqua-prime',
    name: 'Permoglaze Aqua Prime',
    brand: 'Permoglaze (Sofap)',
    brandId: 'sofap',
    category: 'primer',
    finish: 'matt',
    use: 'both',
    coverage_m2_per_l: 9,
    coverage_low_m2_per_l: 8,
    coverage_high_m2_per_l: 10,
    recommended_coats: 1,
    coats_source: 'Sofap TDS Rev 006 (15 Mar 2023): the Matt Emulsion and VIP Satin TDS call for 1 coat of Aqua Prime on bare porous concrete',
    priced_at: SOFAP_PRICED_AT,
    vat_inclusive: true,
    tintable: false,
    tins: [
      { sizeL: 1, priceMur: 258.75 },
      { sizeL: 5, priceMur: 920 },
      { sizeL: 20, priceMur: 3478.75 },
    ],
    hex: '#F3F2EE',
    product_url: `${SOFAP_STORE}permoglaze-aqua-prime/`,
    source_urls: [`${SOFAP_STORE}permoglaze-aqua-prime/`, 'https://sofap.mu/wp-content/uploads/2023/04/AQUA-PRIME_ENG-TDS_MAR-2023.pdf'],
  },
  // Other Mauritian paint companies are researched and generated in
  // `otherBrandPaints.ts` (Mauvilac, Polytol) but NOT loaded — Vic
  // 2026-09-14: the pitch stays on the Sofap range. Spread them in here
  // (and their brands into PAINT_BRANDS) to switch them on.
  // TintEX (Vic 2026-09-19): five lines, loaded — see `tintexPaints.ts`.
  ...TINTEX_PAINTS,
];

/**
 * What a finish does to light (3D Mode, 2026-09-17 — "front end like The
 * Sims 1 but with realistic identical images"). Roughness bands derived
 * from the gloss-unit bands the trade uses (matt < 10 GU at 60°, silk /
 * eggshell 10–25, satin 26–40, gloss 70–90); `sheen` is how much of the
 * room the finish reflects (0 = none, matt). Our mapping, not a standard.
 */
export const FINISH_PBR: Record<WallPaint['finish'], { roughness: number; sheen: number; grain: number }> = {
  matt: { roughness: 0.95, sheen: 0, grain: 0.22 },
  smooth: { roughness: 0.88, sheen: 0.08, grain: 0.05 },
  textured: { roughness: 0.98, sheen: 0, grain: 0.55 },
  silk: { roughness: 0.62, sheen: 0.35, grain: 0.14 },
  satin: { roughness: 0.42, sheen: 0.55, grain: 0.11 },
  gloss: { roughness: 0.16, sheen: 0.92, grain: 0.055 },
};

/**
 * How a finish becomes a wall material. Matt stays pure diffuse (the chip
 * colour). Anything with a sheen gets a clear coat and a room reflection
 * on top of that colour, so the same hex reads dull or shiny.
 */
export interface WallFinishLook {
  roughness: number;
  /** 0 for matt and plaster — kills the default 4 % specular lobe. */
  specularIntensity: number;
  clearcoat: number;
  clearcoatRoughness: number;
  envMapIntensity: number;
  grain: number;
  useEnv: boolean;
}

export function wallFinishLook(finish: string | null | undefined): WallFinishLook {
  const known = finish && finish in FINISH_PBR ? FINISH_PBR[finish as WallPaint['finish']] : undefined;
  const sheen = known?.sheen ?? 0;
  const roughness = known?.roughness ?? 0.96;
  const grain = known?.grain ?? 0.35;
  return {
    roughness,
    specularIntensity: sheen <= 0 ? 0 : Math.min(1, 0.25 + sheen * 0.8),
    clearcoat: sheen * 0.75,
    clearcoatRoughness: Math.max(0.08, roughness * 0.85),
    envMapIntensity: sheen * 1.05,
    grain,
    useEnv: sheen > 0.05,
  };
}

/** Sheen 0–1 for a plan highlight. Unknown / bare plaster is 0. */
export function sheenOfFinish(finish: string | null | undefined): number {
  if (!finish || !(finish in FINISH_PBR)) return 0;
  return FINISH_PBR[finish as WallPaint['finish']].sheen;
}

/** The finish of a paint product by id (undefined = bare plaster). */
export function finishOfPaint(paintId: string | null | undefined): WallPaint['finish'] | undefined {
  if (!paintId) return undefined;
  return findWallPaintById(paintId)?.finish;
}

export function findWallPaintById(id: string): WallPaint | undefined {
  return WALL_PAINTS.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// Brands + colours (2026-09-14). Sofap is brand one; any paint company slots
// in the same way — a PAINT_BRANDS row, its products in WALL_PAINTS with
// `brandId`, its tints in PAINT_COLOURS.
// ---------------------------------------------------------------------------

export const SOFAP_BRAND_ID = 'sofap';

export const PAINT_BRANDS: PaintBrand[] = [
  {
    id: SOFAP_BRAND_ID,
    name: 'Sofap',
    website: 'https://www.sofaponlinestore.mu',
    country: 'MU',
    colourSystem: 'Colour Match — over 20,000 colours, mixed in store',
    chartName: 'Colour Match',
    primerId: 'permoglaze-aqua-prime',
  },
  TINTEX_BRAND,
];

/**
 * Named tints, per brand, in the main bundle: the shades a brand puts on
 * its own colour card. The full in-store chart (Sofap: 1,050 Colour Match
 * shades) loads on demand via `loadPaintColourChart`.
 */
export const PAINT_COLOURS: PaintColour[] = [...SOFAP_A_LA_CARTE, ...tintexCardFrom(ralClassicJson as RalRow[])];

const chartCache = new Map<string, Promise<PaintColour[]>>();

/** The brand's full tinting chart, loaded once on demand (empty for brands without one). */
export function loadPaintColourChart(brandId: string): Promise<PaintColour[]> {
  const cached = chartCache.get(brandId);
  if (cached) return cached;
  let p: Promise<PaintColour[]>;
  if (brandId === SOFAP_BRAND_ID) {
    p = import('./sofapColourMatch.json').then((m) =>
      sofapColourMatchToPaintColours((m.default ?? m) as unknown as SofapColourMatchRow[]),
    );
  } else if (brandId === TINTEX_BRAND_ID) {
    // The whole RAL Classic deck (K7), the card being a selection of it.
    p = Promise.resolve((ralClassicJson as RalRow[]).map(ralToPaintColour));
  } else {
    p = Promise.resolve([]);
  }
  p.then((rows) => loadedChartColours.set(brandId, rows)).catch(() => undefined);
  chartCache.set(brandId, p);
  return p;
}

/** Does the brand have an on-demand chart beyond its card colours? */
export function brandHasColourChart(brandId: string): boolean {
  return brandId === SOFAP_BRAND_ID || brandId === TINTEX_BRAND_ID;
}

export function findPaintBrandById(id: string | undefined): PaintBrand | undefined {
  return PAINT_BRANDS.find((b) => b.id === (id ?? SOFAP_BRAND_ID));
}

export function brandIdOfPaint(paint: WallPaint): string {
  return paint.brandId ?? SOFAP_BRAND_ID;
}

/** Wall colours only — primers are quoted, never chosen. */
export function decorativePaints(): WallPaint[] {
  return WALL_PAINTS.filter((p) => p.category !== 'primer');
}

export function paintsForBrand(brandId: string): WallPaint[] {
  return decorativePaints().filter((p) => brandIdOfPaint(p) === brandId);
}

/** Brands that actually have wall paints loaded, in catalogue order. */
export function brandsWithPaints(): PaintBrand[] {
  return PAINT_BRANDS.filter((b) => decorativePaints().some((p) => brandIdOfPaint(p) === b.id));
}

/** The brand's priced primer, if it has one. */
export function primerForBrand(brandId: string): WallPaint | undefined {
  const b = findPaintBrandById(brandId);
  const p = b?.primerId ? findWallPaintById(b.primerId) : undefined;
  return p && p.category === 'primer' ? p : undefined;
}

export function isPaintTintable(paint: WallPaint): boolean {
  return paint.tintable !== false;
}

/** The tints a paint can be bought in: its own fixed range, else its brand's. */
export function coloursForPaint(paint: WallPaint): PaintColour[] {
  if (!isPaintTintable(paint)) return [];
  if (paint.colours && paint.colours.length > 0) return paint.colours;
  const brandId = brandIdOfPaint(paint);
  return PAINT_COLOURS.filter((c) => c.brandId === brandId);
}

/** Chart colours already loaded this session, so a chart shade prices on its base. */
const loadedChartColours = new Map<string, PaintColour[]>();

export function findPaintColourByHex(paint: WallPaint, hex: string | undefined): PaintColour | undefined {
  const h = normalisePaintColourHex(hex);
  if (!h) return undefined;
  const own = coloursForPaint(paint).find((c) => normalisePaintColourHex(c.hex) === h);
  if (own) return own;
  if (!isPaintTintable(paint)) return undefined;
  const chart = loadedChartColours.get(brandIdOfPaint(paint));
  return chart?.find((c) => normalisePaintColourHex(c.hex) === h);
}

/** CIE L* lightness 0-100 of a hex colour (sRGB -> relative luminance -> L*). */
export function hexLightness(hex: string): number {
  const h = normalisePaintColourHex(hex);
  if (!h) return 100;
  const ch = (i: number) => {
    const v = parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const y = 0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2);
  return y <= 216 / 24389 ? y * (24389 / 27) : 116 * Math.cbrt(y) - 16;
}

export interface PaintTinChoice {
  tins: WallPaintTin[];
  /** The base the tins belong to; absent = the ready-made white / base price. */
  base?: PaintTintBase;
  /** True when the base was inferred from the colour's depth rather than named by the brand. */
  baseEstimated: boolean;
}

/**
 * Which tins price a paint in a colour. Ready-made white (no tint) -> the
 * product's tins. A tint on a product with priced bases -> the named base
 * for a brand colour, else the base the colour's lightness falls in. A tint
 * on a product without bases -> the product's tins (tinting priced in store).
 */
export function tinsForPaintColour(paint: WallPaint, colourHex?: string, baseId?: string): PaintTinChoice {
  const hex = normalisePaintColourHex(colourHex);
  const bases = paint.tintBases ?? [];
  if (!hex || bases.length === 0) return { tins: paint.tins, baseEstimated: false };
  const named = baseId ? bases.find((b) => b.id === baseId) : undefined;
  if (named) return { tins: named.tins, base: named, baseEstimated: false };
  const known = findPaintColourByHex(paint, hex);
  const knownBase = known?.baseId ? bases.find((b) => b.id === known.baseId) : undefined;
  if (knownBase) return { tins: knownBase.tins, base: knownBase, baseEstimated: !!known?.baseInferred };
  const L = hexLightness(hex);
  const byDepth = bases.find((b) => typeof b.minLightness === 'number' && L >= b.minLightness) ?? bases[bases.length - 1];
  return { tins: byDepth.tins, base: byDepth, baseEstimated: true };
}

// ---------------------------------------------------------------------------
// Tints (2026-09-14) — validation shared by the store, the load normalisers
// and the UI. A wall stores `#RRGGBB` (upper-case) or nothing.
// ---------------------------------------------------------------------------

/** `#abc` / `abcdef` / `#ABCDEF` → `#ABCDEF`; anything else → undefined. */
export function normalisePaintColourHex(x: unknown): string | undefined {
  if (typeof x !== 'string') return undefined;
  const h = x.trim().replace(/^#/, '');
  const full = /^[0-9a-fA-F]{3}$/.test(h) ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return undefined;
  return `#${full.toUpperCase()}`;
}

/** Trimmed, single-spaced, at most 80 characters; empty → undefined. */
export function normalisePaintColourName(x: unknown): string | undefined {
  if (typeof x !== 'string') return undefined;
  const s = x.trim().replace(/\s+/g, ' ').slice(0, 80);
  return s || undefined;
}

/**
 * The colour a painted wall renders in: the chosen tint when there is one,
 * else the product's base swatch, else plaster for an unknown product.
 */
export function resolveWallColourHex(paintId: string | undefined, colourHex?: string, plaster = BARE_PLASTER_HEX): string {
  // A paint the catalogue no longer knows cannot be priced, so it must not
  // LOOK painted either — plaster, whatever tint it carried.
  const paint = paintId ? findWallPaintById(paintId) : undefined;
  if (!paint) return plaster;
  const tint = isPaintTintable(paint) ? normalisePaintColourHex(colourHex) : undefined;
  return tint ?? paint.hex;
}
