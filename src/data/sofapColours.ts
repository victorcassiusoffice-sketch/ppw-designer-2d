/**
 * Sofap (Permoglaze) colours — GENERATED 2026-09-14 from Sofap's own site.
 *
 * Every hex here is OFFICIAL: sofap.mu prints it as the inline
 * `background-color` of the colour tile (https://sofap.mu/a-la-carte-colours/
 * and https://sofap.mu/colour-match-colours/?term_id=…). Nothing was sampled
 * from an image or approximated. Sofap's own disclaimer applies and is shown
 * in the panel: "While we do our best to ensure that the colours displayed are accurate, colours may vary depending on the device used."
 *
 * Two layers:
 *  - À LA CARTE (72 shades, this file): "the Permoglaze classic palette …
 *    72 most popular colours … available in all Sofap Inspirations Stores".
 *    21 of them are stocked ready-mixed in Permoglaze Matt Emulsion on
 *    sofaponlinestore.mu; the SKU prefix (EP / EM / EB) is Sofap's own
 *    Pastel / Medium / Basic base for that shade, so `baseId` is exact for
 *    those. The rest carry no base; the calculator estimates one from the
 *    colour's depth and says so.
 *  - COLOUR MATCH (1050 named + coded shades, `sofapColourMatch.json`,
 *    loaded on demand): the in-store tinting chart, "over 20,000 colours …
 *    ready within 15 minutes". Sofap does not publish which base a chart
 *    colour mixes on — never present the estimate as Sofap's tier.
 *
 * Regenerate with the research generator; do not hand-edit values.
 */
import type { PaintColour } from './wallPaints';

export const SOFAP_COLOUR_DISCLAIMER =
  'While we do our best to ensure that the colours displayed are accurate, colours may vary depending on the device used.';

export const SOFAP_A_LA_CARTE_URL = 'https://sofap.mu/a-la-carte-colours/';
export const SOFAP_COLOUR_MATCH_URL = 'https://sofap.mu/colour-match-colours/';

export const SOFAP_A_LA_CARTE: PaintColour[] = [
  { id: 'sofap-alc-morning-haze', brandId: 'sofap', name: 'Morning Haze', hex: '#EDEBDF', code: '8729-1', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'pastel' },
  { id: 'sofap-alc-mushroom', brandId: 'sofap', name: 'Mushroom', hex: '#D9C4A6', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-gardenia', brandId: 'sofap', name: 'Gardenia', hex: '#D7C9AD', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-scone', brandId: 'sofap', name: 'Scone', hex: '#D0AD87', code: '8165-4', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-faint-silhouette', brandId: 'sofap', name: 'Faint Silhouette', hex: '#E5E0D6', code: '8778-1', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'pastel' },
  { id: 'sofap-alc-quicksilver', brandId: 'sofap', name: 'Quicksilver', hex: '#BFC3C2', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-ivory', brandId: 'sofap', name: 'Ivory', hex: '#F9E7CB', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-bermuda-beach', brandId: 'sofap', name: 'Bermuda Beach', hex: '#E0C6A4', code: '8157-1', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'pastel' },
  { id: 'sofap-alc-himalaya', brandId: 'sofap', name: 'Himalaya', hex: '#B79E79', code: '8754-4', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-peaceful-yellow', brandId: 'sofap', name: 'Peaceful Yellow', hex: '#F2EFDE', code: '8004-1', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-elmwood', brandId: 'sofap', name: 'Elmwood', hex: '#CFC5B7', code: '8773-1', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-lb-grey', brandId: 'sofap', name: 'Lb Grey', hex: '#90938E', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-cherry-white', brandId: 'sofap', name: 'Cherry White', hex: '#F5E0CB', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-turnstone', brandId: 'sofap', name: 'Turnstone', hex: '#AE957D', code: '9040-4', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'medium' },
  { id: 'sofap-alc-butter-cream', brandId: 'sofap', name: 'Butter Cream', hex: '#F3EAD6', code: '8010-1', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-arabian-sand', brandId: 'sofap', name: 'Arabian Sand', hex: '#F0DCB7', code: '8149-1', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'pastel' },
  { id: 'sofap-alc-dusty-olive', brandId: 'sofap', name: 'Dusty Olive', hex: '#AC9E8D', code: '8774-4', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'medium' },
  { id: 'sofap-alc-db-grey', brandId: 'sofap', name: 'Db Grey', hex: '#626664', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-pale-mushroom', brandId: 'sofap', name: 'Pale Mushroom', hex: '#D3BCA7', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-italian-stone', brandId: 'sofap', name: 'Italian Stone', hex: '#E0DDD2', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-coque-d-oeuf', brandId: 'sofap', name: 'Coque D\' Oeuf', hex: '#F1E3C9', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-off-white', brandId: 'sofap', name: 'Off-white', hex: '#EBD9B9', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-koala', brandId: 'sofap', name: 'Koala', hex: '#897D70', code: '8782-5', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-doves-wing', brandId: 'sofap', name: 'Dove\'s Wing', hex: '#EAE2D1', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'pastel' },
  { id: 'sofap-alc-silver-birch', brandId: 'sofap', name: 'Silver Birch', hex: '#C3C1AD', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-fiesta', brandId: 'sofap', name: 'Fiesta', hex: '#F2DAAF', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'pastel' },
  { id: 'sofap-alc-eagle-nest', brandId: 'sofap', name: 'Eagle Nest', hex: '#BEA891', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-aspen-blue', brandId: 'sofap', name: 'Aspen Blue', hex: '#D9E1E2', code: '8422-1', collection: 'Neutrals', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-chiffon-rose', brandId: 'sofap', name: 'Chiffon Rose', hex: '#F0AEBF', code: '8270-1', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-mountain-majesty', brandId: 'sofap', name: 'Mountain Majesty', hex: '#A283B1', code: '8361-4', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-blue', brandId: 'sofap', name: 'Blue', hex: '#08698C', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'basic' },
  { id: 'sofap-alc-teal', brandId: 'sofap', name: 'Teal', hex: '#008080', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-halo', brandId: 'sofap', name: 'Halo', hex: '#FCE997', code: '8081-1', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-honey-locust', brandId: 'sofap', name: 'Honey Locust', hex: '#FAC494', code: '8179-1', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-grenadine', brandId: 'sofap', name: 'Grenadine', hex: '#D9697D', code: '8272-5', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'basic' },
  { id: 'sofap-alc-periwinkle', brandId: 'sofap', name: 'Periwinkle', hex: '#B5C4D9', code: '8417-1', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'pastel' },
  { id: 'sofap-alc-yacht-blue', brandId: 'sofap', name: 'Yacht Blue', hex: '#345871', code: '8469-5', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-kiwi-tint', brandId: 'sofap', name: 'Kiwi Tint', hex: '#E9E9A3', code: '8695-1', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-gerbera', brandId: 'sofap', name: 'Gerbera', hex: '#FFCA81', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-orange-peel', brandId: 'sofap', name: 'Orange Peel', hex: '#F38842', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-maidens-blush', brandId: 'sofap', name: 'Maiden\'s Blush', hex: '#AD496B', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-pharoah', brandId: 'sofap', name: 'Pharoah', hex: '#7D95C5', code: '8412-4', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-midsummer', brandId: 'sofap', name: 'Midsummer', hex: '#A9D0D7', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-chinese-green', brandId: 'sofap', name: 'Chinese Green', hex: '#D5DC6F', code: '8697-4', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-yellow-radiance', brandId: 'sofap', name: 'Yellow Radiance', hex: '#FFCA13', code: '8084-5', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'basic' },
  { id: 'sofap-alc-sunburst', brandId: 'sofap', name: 'Sunburst', hex: '#B2513D', code: '8238-5', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'basic' },
  { id: 'sofap-alc-jubilee-day', brandId: 'sofap', name: 'Jubilee Day', hex: '#834868', code: '8336-5', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-waters-edge', brandId: 'sofap', name: 'Water\'s Edge', hex: '#91CEEA', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-clear-water', brandId: 'sofap', name: 'Clear Water', hex: '#92D1CE', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-garden-cress', brandId: 'sofap', name: 'Garden Cress', hex: '#859F5E', code: '8671-5', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-sensation', brandId: 'sofap', name: 'Sensation', hex: '#FFB400', code: '8126-5', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'basic' },
  { id: 'sofap-alc-fiesta-rose', brandId: 'sofap', name: 'Fiesta Rose', hex: '#F2CFC7', code: '8240-1', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-purple-haze', brandId: 'sofap', name: 'Purple Haze', hex: '#E0D6E8', code: '8359-1', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-palace-blue', brandId: 'sofap', name: 'Palace Blue', hex: '#5EA1C0', code: '8467-4', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'medium' },
  { id: 'sofap-alc-jamaican-sea', brandId: 'sofap', name: 'Jamaican Sea', hex: '#18A99C', code: '8544-4', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'medium' },
  { id: 'sofap-alc-palm-garden', brandId: 'sofap', name: 'Palm Garden', hex: '#35684E', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-cream', brandId: 'sofap', name: 'Cream', hex: '#F7D7AA', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-alpinia', brandId: 'sofap', name: 'Alpinia', hex: '#EA8C7C', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-signal-red', brandId: 'sofap', name: 'Signal Red', hex: '#C43A3A', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-scarlet', brandId: 'sofap', name: 'Scarlet', hex: '#933D3C', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-pale-mauve', brandId: 'sofap', name: 'Pale Mauve', hex: '#DECECA', code: '8968-1', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-dusty-rose', brandId: 'sofap', name: 'Dusty Rose', hex: '#CD9594', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-chinese-red', brandId: 'sofap', name: 'Chinese Red', hex: '#8C413A', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-nutmeg', brandId: 'sofap', name: 'Nutmeg', hex: '#70433E', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-mustard-seed', brandId: 'sofap', name: 'Mustard Seed', hex: '#E0BD73', code: '8103-4', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-terracotta', brandId: 'sofap', name: 'Terracotta', hex: '#B07044', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-teak', brandId: 'sofap', name: 'Teak', hex: '#855A41', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'basic' },
  { id: 'sofap-alc-maroon', brandId: 'sofap', name: 'Maroon', hex: '#61483E', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL },
  { id: 'sofap-alc-soft-moss', brandId: 'sofap', name: 'Soft Moss', hex: '#D5D0B4', code: '8717-1', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'pastel' },
  { id: 'sofap-alc-green-pastures', brandId: 'sofap', name: 'Green Pastures', hex: '#B7AF77', code: '8726-4', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'medium' },
  { id: 'sofap-alc-deep-jungle', brandId: 'sofap', name: 'Deep Jungle', hex: '#6E6B46', code: '8728-5', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'basic' },
  { id: 'sofap-alc-bronze', brandId: 'sofap', name: 'Bronze', hex: '#4C493F', collection: 'Bright', hexOrigin: 'official', source_url: SOFAP_A_LA_CARTE_URL, baseId: 'basic' },
];

/** Compact row of the on-demand Colour Match chart. */
export interface SofapColourMatchRow {
  /** name */
  n: string;
  /** code, "" when Sofap's tile prints none or a duplicate */
  c: string;
  /** hex */
  h: string;
  /** family */
  f: string;
}

export function sofapColourMatchToPaintColours(rows: SofapColourMatchRow[]): PaintColour[] {
  return rows.map((r) => ({
    id: `sofap-cm-${r.c || r.n.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    brandId: 'sofap',
    name: r.n,
    hex: r.h,
    ...(r.c ? { code: r.c } : {}),
    collection: `Colour Match · ${r.f}`,
    hexOrigin: 'official' as const,
    source_url: SOFAP_COLOUR_MATCH_URL,
  }));
}
