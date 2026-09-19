/**
 * TintEX colours (2026-09-19). TintEX publishes no colour card of its own:
 * every tin is "Tint Match" — the shop matches a colour from the RAL K7,
 * NCS, Pantone or Colour Concert fan deck. The card here is a wellness-room
 * selection from RAL Classic (the K7 deck) and the on-demand chart is the
 * whole deck (216 shades, `ralClassic.json`).
 *
 * Hex honesty: RAL defines its colours physically, not in sRGB; the hex
 * values are the conventional sRGB approximations (Wikipedia's RAL Classic
 * table) — `hexOrigin: 'representative'`, and the panel says so.
 */
import type { PaintColour } from './wallPaints';
import { TINTEX_BRAND_ID } from './tintexPaints';

export const RAL_SOURCE_URL = 'https://en.wikipedia.org/wiki/List_of_RAL_colours';
export const TINTEX_COLOUR_DISCLAIMER =
  'TintEX tints to order (Tint Match) from the RAL K7, NCS, Pantone and Colour Concert fan decks. Shades shown are RAL Classic with their conventional sRGB values — the fan deck in the shop is the reference; colours may vary depending on the device used.';

export interface RalRow {
  code: string;
  name: string;
  hex: string;
}

/** A RAL row as a paint colour of the TintEX brand. */
export function ralToPaintColour(r: RalRow): PaintColour {
  return {
    id: `ral-${r.code.replace(/\D/g, '')}`,
    brandId: TINTEX_BRAND_ID,
    name: r.name,
    code: r.code,
    hex: r.hex.toUpperCase(),
    collection: 'RAL Classic',
    hexOrigin: 'representative',
    source_url: RAL_SOURCE_URL,
  };
}

/** The card: the RAL Classic shades a wellness room reaches for — whites, creams, greys, soft greens and blues. */
export const TINTEX_CARD_CODES = [
  'RAL 9010', 'RAL 9003', 'RAL 9001', 'RAL 9002', 'RAL 1013', 'RAL 1015', 'RAL 1014', 'RAL 7047',
  'RAL 7035', 'RAL 7044', 'RAL 7032', 'RAL 7030', 'RAL 1019', 'RAL 1000', 'RAL 6019', 'RAL 6021',
  'RAL 6027', 'RAL 6034', 'RAL 6011', 'RAL 5024', 'RAL 5014', 'RAL 5023', 'RAL 3015', 'RAL 3012',
];

/** Build the card from the deck (no hand-typed hexes). */
export function tintexCardFrom(deck: RalRow[]): PaintColour[] {
  const byCode = new Map(deck.map((r) => [r.code, r]));
  return TINTEX_CARD_CODES.map((c) => byCode.get(c)).filter((r): r is RalRow => !!r).map(ralToPaintColour);
}
