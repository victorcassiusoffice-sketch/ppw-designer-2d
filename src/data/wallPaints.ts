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
  finish: 'matt' | 'silk' | 'satin' | 'gloss' | 'textured';
  use: 'interior' | 'exterior' | 'both';
  /** m² covered by ONE litre in ONE coat (datasheet spread-rate midpoint). */
  coverage_m2_per_l: number;
  /** The datasheet's spread-rate range, when it publishes one. */
  coverage_low_m2_per_l?: number;
  coverage_high_m2_per_l?: number;
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
    finish: 'matt',
    use: 'interior',
    coverage_m2_per_l: 9,
    coverage_low_m2_per_l: 8,
    coverage_high_m2_per_l: 10,
    recommended_coats: 3,
    coats_source: 'Sofap TDS Rev 006: "3 coats are recommended for optimum performance"',
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
    finish: 'satin', // velvety low-sheen exterior
    use: 'exterior',
    coverage_m2_per_l: 10,
    coverage_low_m2_per_l: 10,
    coverage_high_m2_per_l: 12,
    recommended_coats: 3,
    coats_source: 'Sofap TDS Rev 005: three coats; spreading rate ±10 m²/L/coat',
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
    finish: 'matt',
    use: 'exterior', // TDS Rev 004: "Recommended for exterior use only"
    coverage_m2_per_l: 9,
    coverage_low_m2_per_l: 8,
    coverage_high_m2_per_l: 10,
    recommended_coats: 3,
    coats_source: 'Sofap TDS Rev 004: three coats',
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
];

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
  },
];

/**
 * Named tints, per brand, in the main bundle: the shades a brand puts on
 * its own colour card. The full in-store chart (Sofap: 1,050 Colour Match
 * shades) loads on demand via `loadPaintColourChart`.
 */
export const PAINT_COLOURS: PaintColour[] = [...SOFAP_A_LA_CARTE];

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
  } else {
    p = Promise.resolve([]);
  }
  chartCache.set(brandId, p);
  return p;
}

/** Does the brand have an on-demand chart beyond its card colours? */
export function brandHasColourChart(brandId: string): boolean {
  return brandId === SOFAP_BRAND_ID;
}

export function findPaintBrandById(id: string | undefined): PaintBrand | undefined {
  return PAINT_BRANDS.find((b) => b.id === (id ?? SOFAP_BRAND_ID));
}

export function brandIdOfPaint(paint: WallPaint): string {
  return paint.brandId ?? SOFAP_BRAND_ID;
}

export function paintsForBrand(brandId: string): WallPaint[] {
  return WALL_PAINTS.filter((p) => brandIdOfPaint(p) === brandId);
}

/** Brands that actually have products loaded, in catalogue order. */
export function brandsWithPaints(): PaintBrand[] {
  return PAINT_BRANDS.filter((b) => WALL_PAINTS.some((p) => brandIdOfPaint(p) === b.id));
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

export function findPaintColourByHex(paint: WallPaint, hex: string | undefined): PaintColour | undefined {
  const h = normalisePaintColourHex(hex);
  if (!h) return undefined;
  return coloursForPaint(paint).find((c) => normalisePaintColourHex(c.hex) === h);
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
  if (knownBase) return { tins: knownBase.tins, base: knownBase, baseEstimated: false };
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
export function resolveWallColourHex(paintId: string | undefined, colourHex?: string, plaster = '#EDE9DF'): string {
  const tint = normalisePaintColourHex(colourHex);
  if (tint) return tint;
  const paint = paintId ? findWallPaintById(paintId) : undefined;
  return paint?.hex ?? plaster;
}
