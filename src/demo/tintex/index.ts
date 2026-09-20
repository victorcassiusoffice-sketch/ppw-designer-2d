/**
 * TintEX demo (2026-09-19) — the painted show flat for TintEX (Tintex
 * Company Ltd, Eau-Coulée, Curepipe). Same three-room flat as the Sofap
 * demo, every wall in a TintEX line where the line belongs: VIP Satin
 * in the living room, Cashmere in the bedroom, Mastertop (anti-fungal, for
 * humid rooms) in the kitchen. The panel shows TintEX only.
 *
 * `/designer?demo=tintex`
 */
import type { DemoDefinition } from '../demoCatalog';
import { buildShowFlat } from '../sofap';

export const TINTEX_SLUG = 'tintex';
export const TINTEX_PAGE_NAME = 'TintEX · Painted show flat';

export const TINTEX_DEMO: DemoDefinition = {
  slug: TINTEX_SLUG,
  merchant: 'TintEX',
  pageName: TINTEX_PAGE_NAME,
  products: [],
  currency: 'MUR',
  paintBrandIds: ['tintex'],
  buildProperty: () =>
    buildShowFlat({
      id: 'tintex-show-flat',
      name: TINTEX_PAGE_NAME,
      prefix: 'tintex',
      // Shades from the RAL Classic card the tool carries for TintEX (hex =
      // the deck's conventional sRGB values in ralClassic.json), so the flat
      // reads as painted, not as three white boxes.
      paints: {
        living: { paintId: 'tintex-vip-satin', colourHex: '#B7D9B1', colourName: 'Pastel green' },
        bedroom: { paintId: 'tintex-cashmere', colourHex: '#E3D9C6', colourName: 'Oyster white' },
        kitchen: { paintId: 'tintex-mastertop', colourHex: '#CBD0CC', colourName: 'Light grey' },
      },
    }),
};
