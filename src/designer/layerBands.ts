/**
 * layerBands — what may sit on top of what.
 *
 * Vic 2026-08-28: "people need to place things on top of the flooring."
 *
 * THE BUG THIS FIXES
 * ------------------
 * The only way to get flooring onto the canvas was to place the 8
 * `category: 'flooring'` SKUs as ORDINARY items, and the collision check is
 * category-blind: it rejects any rectangle overlap. So laying a rubber mat and
 * then putting a treadmill on it was refused — and worse, `findFreeSlot` then
 * silently TELEPORTED the treadmill somewhere else with no message. Tile a
 * whole room and every later product got "Item won't fit — the room is full."
 *
 * Flooring-as-an-item is fundamentally incompatible with a flat collision
 * model. The fix every floor planner and The Sims both use is explicit layer
 * BANDS: a floor covering and a piece of equipment occupy different bands, so
 * they never contend for the same space. Only same-band items collide.
 *
 * Bands are deliberately spaced by 100 so a band can be inserted later
 * (rugs between covering and freestanding, say) without renumbering.
 *
 * NOTE: this is enforced at the CALL SITE by filtering the obstacle list,
 * not by editing `lib/geometry.ts` — that module is protected, and its
 * `collidesWithAny` stays a pure "do these rectangles overlap" primitive.
 * Deciding WHICH items are obstacles is a product question, and it belongs
 * here.
 */

import { getProductById } from '../data/products';

export const BAND_FLOOR_COVERING = 200;
export const BAND_FREESTANDING = 300;

/**
 * Which band a product occupies.
 *
 * Driven off the catalog `category` rather than a per-item field so it applies
 * retroactively to every design already saved — nothing needs migrating, and a
 * customer who tiled a room last week can put a bench on it today.
 */
export function bandForProduct(productId: string): number {
  const p = getProductById(productId);
  return p?.category === 'flooring' ? BAND_FLOOR_COVERING : BAND_FREESTANDING;
}

/** True when two products contend for the same space. */
export function bandsCollide(a: string, b: string): boolean {
  return bandForProduct(a) === bandForProduct(b);
}

/**
 * The obstacles a product must avoid: only items in its OWN band.
 *
 * A treadmill ignores the mats under it; a mat ignores the treadmill above it
 * but still cannot be laid over another mat.
 */
export function obstaclesFor<T extends { productId: string }>(
  productId: string,
  items: readonly T[],
): T[] {
  const band = bandForProduct(productId);
  return items.filter((it) => bandForProduct(it.productId) === band);
}
