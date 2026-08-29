/**
 * lighting — which products are light sources, how far their light pools,
 * and which plan glyph symbol-style products draw.
 *
 * Sims world (2026-08-29), Vic's ask #7: "light feature when a light is
 * added". The canvas draws a soft warm pool around every placed item whose
 * product `emitsLight`, with radius `lightRadiusM`, unless the item has
 * `lightOn: false`. Symbol-style products (lights, greenery, garden
 * furniture) draw an architectural glyph (`planSymbolOf`) instead of a
 * top-down photo, the way the three reference plans do.
 *
 * Pure functions over the product record; no store access, no DOM.
 */

import type { PlanSymbol, Product } from '../data/products.schema';

/** The product fields these helpers read; a full `Product` satisfies it. */
export type LightingInput = Pick<Product, 'name' | 'category'> &
  Partial<Pick<Product, 'emits_light' | 'light_radius_m' | 'dimensions_cm' | 'outdoor' | 'plan_symbol'>>;

/** Floor of the derived light pool (metres): even a bedside lamp lights a bit of floor. */
export const MIN_LIGHT_RADIUS_M = 1.2;
/** Ceiling of the derived light pool (metres): a big fixture must not wash the whole plan. */
export const MAX_LIGHT_RADIUS_M = 3.5;
/** Derived radius = this many times the footprint's long side. */
export const LIGHT_RADIUS_PER_LONG_SIDE = 3;

/**
 * Whole-word match against the product name — `\b` so "Highlight" and
 * "Delighted" do not glow, while "Floor Lamp", "LED strip" and "Wall light"
 * do. Adjective uses ("Light commercial treadmill") DO match: the name
 * heuristic is the last resort behind the explicit flag and the category,
 * and a merchant fixes it by setting `emits_light: false`.
 */
const LIGHT_NAME_RE = /\b(?:lamp|light|lantern|sconce|pendant|chandelier|led)\b/i;

export function looksLikeLight(name: string): boolean {
  return LIGHT_NAME_RE.test(name);
}

/**
 * True when the product is a light source. Precedence: the explicit
 * `emits_light` flag (either value) → `category === 'lighting'` → the
 * name heuristic.
 */
export function emitsLight(p: LightingInput): boolean {
  if (typeof p.emits_light === 'boolean') return p.emits_light;
  if (p.category === 'lighting') return true;
  return looksLikeLight(p.name);
}

/**
 * Radius of the light pool in metres. Explicit `light_radius_m` wins when it
 * is a positive finite number; otherwise 3 x the footprint's long side,
 * clamped to [1.2, 3.5]. So a 40 cm lamp pools 1.2 m, a 1 m fixture 3 m,
 * anything 1.17 m and wider 3.5 m. Height is ignored — the plan is
 * top-down and a tall floor lamp lights no more floor than a short one.
 *
 * The value is meaningful only for products that `emitsLight`; callers gate
 * on that first. Without dimensions the floor radius is returned.
 */
export function lightRadiusM(p: LightingInput): number {
  const explicit = p.light_radius_m;
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0) return explicit;
  const d = p.dimensions_cm;
  // Multiply in whole centimetres, then convert: 3 x 40 cm is exactly 1.2 m,
  // where 3 x 0.4 would be 1.2000000000000002.
  const derived = d ? (LIGHT_RADIUS_PER_LONG_SIDE * Math.max(d.length, d.width)) / 100 : 0;
  return Math.min(MAX_LIGHT_RADIUS_M, Math.max(MIN_LIGHT_RADIUS_M, derived));
}

/** True when the product may be placed outside rooms (garden / plot). */
export function isOutdoorProduct(p: Pick<LightingInput, 'outdoor'>): boolean {
  return p.outdoor === true;
}

/**
 * Plan glyph for symbol-style products, or null to draw the image /
 * footprint as before. Explicit `plan_symbol` wins; otherwise the
 * `lighting` category draws 'light' and an outdoor plant draws 'tree'.
 * The name heuristic is deliberately NOT used here: a photo-bearing
 * product with "light" in its name keeps its photo.
 */
export function planSymbolOf(p: LightingInput): PlanSymbol | null {
  if (p.plan_symbol) return p.plan_symbol;
  if (p.category === 'lighting') return 'light';
  if (p.category === 'plant' && isOutdoorProduct(p)) return 'tree';
  return null;
}
