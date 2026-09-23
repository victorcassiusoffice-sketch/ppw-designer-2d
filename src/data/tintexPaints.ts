/**
 * TintEX (Tintex Company Ltd, reg. C10093089, est. 14 Sep 2017 — Corner
 * Adam Street, Royal Road, Eau-Coulée, Curepipe 74322; +230 675 1825;
 * info@tintexpaint.com) — five wall paints for the Designer (Vic
 * 2026-09-19: "add 5 different paint products from tintex in mauritius,
 * make sure the texture etc is super accurate").
 *
 * GROUND TRUTH, read 2026-09-19 by a 3-sweep research workflow and re-opened
 * by an independent verifier the same day (vault handoff
 * DESIGNER-3D-SIMS-PAINT-2026-09-19.md):
 *   • Finish, use, coverage, coats, drying/recoat and tin sizes come from
 *     the manufacturer's own product pages on tintexpaint.com, its
 *     WooCommerce store API (attributes; no prices) and its 2022 catalogue
 *     (Calaméo, 18 pages) and 2023 company profile (Calaméo, 13 pages).
 *     No TDS / MSDS PDF is published for any line ("Contact us for MSDS").
 *   • PRICES: TintEX publishes no price today (its Shopify shop
 *     tintex-shop.com is a dead domain, the site shows £0). Every MUR
 *     figure here is TintEX's OWN shop price as captured by the Wayback
 *     Machine on 2021-09-19 / 2021-11-27 (Shopify variant JSON: currency
 *     MUR, `taxable:false`), sold by tint band: White · Pastel Shades ·
 *     Mid-basic · Dark, plus a 250 ml sample pot at Rs 90 (not a tin here).
 *     `priced_at` says so on every line and the panel prints the date; VAT
 *     status is not stated by the source. Confirm the 2026 list with
 *     TintEX (+230 675 1825) before a customer quote.
 *   • COLOURS: TintEX has no named colour card — every tin carries a
 *     "Tint Match" badge and the company matches from the RAL K7, NCS,
 *     Pantone and Colour Concert fan decks (150,000+ shades). The card and
 *     chart here are RAL Classic (the K7 deck), see `tintexColours.ts`.
 *   • FINISH → 3D: the stage renders each line's finish (FINISH_PBR):
 *     VIP Satin = satin (clear film, lower roughness), Mastertop = pearl /
 *     eggshell → silk, Cashmere = "silky rich look" → silk, True White and
 *     Trade Pro = matt (no film, roller stipple). TintEX publishes no gloss
 *     units; the words are theirs. Paint stays dielectric (metalness 0).
 */
import type { PaintBrand, PaintTintBase, WallPaint, WallPaintTin } from './wallPaints';

export const TINTEX_BRAND_ID = 'tintex';
const TINTEX_SITE = 'https://tintexpaint.com';
const CATALOGUE_2022 = 'https://www.calameo.com/books/00716345100e4135916a9';
const PRICED_NOV_2021 = '2021-11-27';
const PRICED_SEP_2021 = '2021-09-19';
const PRICE_NOTE = "TintEX online-shop price (Wayback Machine capture); the shop is closed — confirm today's list with TintEX";

export const TINTEX_BRAND: PaintBrand = {
  id: TINTEX_BRAND_ID,
  name: 'TintEX',
  website: TINTEX_SITE,
  country: 'MU',
  colourSystem: 'Tint Match — RAL K7 / NCS / Pantone fan decks, matched in store (150,000+ shades)',
  chartName: 'RAL Classic',
};

function tins(sizes: number[], prices: number[]): WallPaintTin[] {
  return sizes.map((sizeL, i) => ({ sizeL, priceMur: prices[i] }));
}

/** TintEX's own tint bands, pale to deep; a colour lands on the band its depth needs. */
function bands(sizes: number[], pastel: number[], mid: number[], dark: number[]): PaintTintBase[] {
  return [
    { id: 'pastel', name: 'Pastel Shades', minLightness: 72, tins: tins(sizes, pastel) },
    { id: 'medium', name: 'Mid-basic', minLightness: 45, tins: tins(sizes, mid) },
    { id: 'basic', name: 'Dark', minLightness: 0, tins: tins(sizes, dark) },
  ];
}

const SIZES = [1, 2.5, 5, 20];

export const TINTEX_PAINTS: WallPaint[] = [
  {
    id: 'tintex-vip-satin',
    name: 'TintEX VIP Satin',
    brand: 'TintEX',
    brandId: TINTEX_BRAND_ID,
    featured: true,
    finish: 'satin', // tin and catalogue: "VIP Satin — a rich satin finish"; site attribute: eggshell
    use: 'interior',
    coverage_m2_per_l: 11,
    coverage_low_m2_per_l: 10,
    coverage_high_m2_per_l: 12,
    coverage_source: `${TINTEX_SITE}/product/vip/: "Yield: 10-12 m² / liter"`,
    recommended_coats: 2,
    coats_source: 'tintexpaint.com: "a first coat of paint as a primer. A minimum of two additional layers should be sufficient depending on the degree of porosity" — drying 1 h, recoat 12 h',
    priced_at: PRICED_NOV_2021,
    price_note: PRICE_NOTE,
    tins: tins(SIZES, [242, 662, 1076, 4227]),
    tintBases: bands(SIZES, [258, 709, 1145, 4485], [351, 965, 1582, 6245], [437, 1202, 2019, 7993]),
    hex: '#F2F1EC',
    product_url: `${TINTEX_SITE}/product/vip/`,
    source_urls: [`${TINTEX_SITE}/product/vip/`, CATALOGUE_2022, 'https://web.archive.org/web/20211127025647/https://www.tintex-shop.com/products/vip-satin'],
  },
  {
    id: 'tintex-mastertop',
    name: 'TintEX Mastertop',
    brand: 'TintEX',
    brandId: TINTEX_BRAND_ID,
    featured: true,
    finish: 'silk', // "pearl finish" / site attribute Eggshell — 100 % acrylic, anti-fungal, for humid rooms (kitchen, bathroom)
    use: 'both',
    coverage_m2_per_l: 12,
    coverage_low_m2_per_l: 11,
    coverage_high_m2_per_l: 13,
    coverage_source: `${TINTEX_SITE}/product/mastertop/: "Yield: 11-13 m² / liter"`,
    recommended_coats: 2,
    coats_source: 'tintexpaint.com states drying 1 h and recoat 4–5 h but no coat count; 2 coats = standard practice for a pearl emulsion',
    priced_at: PRICED_SEP_2021,
    price_note: `${PRICE_NOTE}. The 1 L White (Rs 362.60) captured above Pastel (Rs 345) — kept as captured`,
    tins: tins(SIZES, [362.6, 897, 1449, 5687]),
    tintBases: bands(SIZES, [345, 949, 1541, 6038], [426, 1171, 1909, 7533], [512, 1407, 2277, 9022]),
    hex: '#F0EEE8',
    product_url: `${TINTEX_SITE}/product/mastertop/`,
    source_urls: [`${TINTEX_SITE}/product/mastertop/`, CATALOGUE_2022, 'https://web.archive.org/web/20210919144136/https://www.tintex-shop.com/products/mastertop'],
  },
  {
    id: 'tintex-cashmere',
    name: 'TintEX Cashmere Interior Latex',
    brand: 'TintEX',
    brandId: TINTEX_BRAND_ID,
    featured: true,
    // TintEX's own sheen words conflict — 2021 shop: "semi glossy … velvety
    // Matt finish which is not too shiny"; catalogue: "glides on buttery
    // smooth and levels out… an elegant, silky rich look". Silk sits between.
    finish: 'silk',
    // The catalogue names it "Interior Latex"; the 2021 shop page said "both
    // interior and exterior". The name wins. Absent from the live site's
    // store API on 2026-09-19 — confirm it is still made.
    use: 'interior',
    // TintEX publishes NO spread rate for Cashmere (not on the site, not in
    // the catalogue). A premium interior latex norm is assumed so the line
    // can be quoted at all — shown as an estimate everywhere it is used.
    coverage_m2_per_l: 10,
    coverage_estimated: true,
    coverage_source: 'ESTIMATED — TintEX publishes no yield for Cashmere; 10 m²/L is the premium-interior-latex norm. Confirm with TintEX.',
    recommended_coats: 2,
    coats_source: 'not stated by TintEX; 2 coats = standard practice',
    priced_at: PRICED_NOV_2021,
    price_note: PRICE_NOTE,
    tins: tins(SIZES, [253, 696, 1076, 4221]),
    tintBases: bands(SIZES, [259, 711, 1110, 4365], [317, 869, 1403, 5538], [374, 1024, 1702, 6716]),
    hex: '#EFEDE6',
    source_urls: [CATALOGUE_2022, 'https://web.archive.org/web/20211127025233/https://www.tintex-shop.com/products/cashmere', 'https://cdn.shopify.com/s/files/1/0431/9887/3765/products/Cashmere_1024x.png'],
  },
  {
    id: 'tintex-true-white-matt',
    name: 'TintEX True White Matt Emulsion',
    brand: 'TintEX',
    brandId: TINTEX_BRAND_ID,
    featured: true,
    finish: 'matt', // catalogue: "smooth matt finish hides surface imperfections"
    use: 'interior',
    coverage_m2_per_l: 8.5,
    coverage_low_m2_per_l: 8,
    coverage_high_m2_per_l: 9,
    coverage_source: `${TINTEX_SITE}/product/matt-emulsion/: "Yield: 8-9 m² / liter"`,
    recommended_coats: 2,
    coats_source: 'tintexpaint.com: "apply one to two coats… If the surface has already been primed, two layers should suffice" — drying 1 h, recoat 1–2 h',
    priced_at: PRICED_SEP_2021,
    price_note: PRICE_NOTE,
    tins: tins(SIZES, [161, 362.25, 660.1, 2553]),
    tintBases: bands(SIZES, [184, 506, 764.75, 2967], [258.75, 707.25, 1212.25, 4393], [333.5, 915.4, 1472, 5819]),
    hex: '#F5F5F1',
    product_url: `${TINTEX_SITE}/product/matt-emulsion/`,
    source_urls: [`${TINTEX_SITE}/product/matt-emulsion/`, CATALOGUE_2022, 'https://web.archive.org/web/20210919134712/https://www.tintex-shop.com/products/matt-emulsion-true-white'],
  },
  {
    id: 'tintex-trade-pro',
    name: 'TintEX Trade Pro',
    brand: 'TintEX',
    brandId: TINTEX_BRAND_ID,
    featured: true,
    finish: 'matt', // "Appearance: MATT" — economy interior emulsion, white only
    use: 'interior',
    tintable: false,
    coverage_m2_per_l: 7,
    coverage_low_m2_per_l: 6,
    coverage_high_m2_per_l: 8,
    // The only figure TintEX gives is for primer-coat use; per litre is implied, not written.
    coverage_estimated: true,
    coverage_source: `${TINTEX_SITE}/product/trade-pro/: "Trade-Pro can be use as a PRIMER COAT on New concrete surfaces 6-8 m2" (per litre implied)`,
    recommended_coats: 2,
    coats_source: 'tintexpaint.com: "Apply two or three coats to new surfaces so as to achieve obliteration"',
    priced_at: PRICED_SEP_2021,
    price_note: `${PRICE_NOTE}. The shop sold 5 L and 20 L only; the site also lists 1 L and 2.5 L, never priced`,
    tins: tins([5, 20], [374, 1380]),
    hex: '#F4F4F2',
    product_url: `${TINTEX_SITE}/product/trade-pro/`,
    source_urls: [`${TINTEX_SITE}/product/trade-pro/`, CATALOGUE_2022, 'https://web.archive.org/web/20210919131741/https://www.tintex-shop.com/products/trade-pro'],
  },
];
