import type { Product } from './products.schema';

/** Supplier snapshots, not a live stock or ordering feed. See docs/MAURITIUS-OUTDOOR-SOURCES.md. */
export const OUTDOOR_SOURCE_REVIEW_DATE = '2026-09-30';
export type MauritiusOutdoorShape = 'garden-table' | 'garden-chair' | 'garden-swing' | 'hanging-chair';
export const MAURITIUS_OUTDOOR_SHAPES: Readonly<Record<string, MauritiusOutdoorShape>> = {
  'mrbricolage-mistral-70': 'garden-table',
  'mrbricolage-aurore-135': 'garden-table',
  'jkalachand-1798-e': 'garden-chair',
  'jkalachand-1799-w': 'garden-chair',
  'jkalachand-gs1004-swing': 'garden-swing',
};

const disclosure = `Supplier reference checked ${OUTDOOR_SOURCE_REVIEW_DATE}. Price is a published snapshot, not a stock or price guarantee. Confirm with the supplier before purchase. Original dimensional illustration and simplified 3D planning model; not a product photograph or manufacturer CAD. No supplier partnership is implied.`;
const common = {
  category: 'furniture', commission_pct: 0, shopify_ready: false,
  designer_status: 'Done', delivery_regions: ['MU'], outdoor: true,
  placement: 'floor', front_edge: 'bottom',
} as const;

/** Only individually dimensioned items. A multi-piece set must not be represented by one invented bounding box. */
export const MAURITIUS_OUTDOOR_PRODUCTS: Product[] = [
  {
    ...common, delivery_regions: ['MU'], id: 'mrbricolage-mistral-70', sku: 'MRB-5414882248224',
    name: 'Mistral Garden Table · 70 cm', supplier: 'Mr. Bricolage Mauritius',
    dimensions_cm: { length: 70, width: 70, height: 71 }, weight_kg: 7,
    price: { value: 5900, currency: 'MUR' }, is_surface: true,
    image_url: '/products/outdoor/mistral-table.svg', topdown_image_url: '/products/outdoor/table-plan.svg',
    source_url: 'https://www.mr-bricolage.mu/Grandbaie/table-pliable-mistral-metal-gris-anthracite-70-x-70-x-h71-cm.html',
    notes: `Anthracite metal folding table. Open dimensions: 70 × 70 × 71 cm. Manufacturer reference 224822. Grand Baie catalogue price snapshot: Rs 5,900. ${disclosure}`,
  },
  {
    ...common, delivery_regions: ['MU'], id: 'mrbricolage-aurore-135', sku: 'MRB-4713410646022',
    name: 'Aurore Garden Table · closed 135 cm', supplier: 'Mr. Bricolage Mauritius',
    dimensions_cm: { length: 135, width: 90, height: 75 }, weight_kg: 22,
    price: { value: 0, currency: 'MUR' }, price_on_request: true, is_surface: true,
    image_url: '/products/outdoor/aurore-table.svg', topdown_image_url: '/products/outdoor/table-plan.svg',
    source_url: 'https://www.mr-bricolage.mu/table-de-jardin-aurore-135-270-x-90-x-75-cm-alu-gris.html',
    notes: `Grey aluminium table, shown CLOSED at 135 × 90 × 75 cm. Supplier also lists extended length 270 cm; extending is not simulated. Chairs sold separately. No price published in the checked product page: request a quote. Manufacturer reference 348218. ${disclosure}`,
  },
  {
    ...common, delivery_regions: ['MU'], id: 'jkalachand-1798-e', sku: 'JK-1798-E',
    name: '1798-E Grey Outdoor Armchair', supplier: 'JKalachand',
    dimensions_cm: { length: 56, width: 50, height: 77 }, weight_kg: 0,
    price: { value: 2990, currency: 'MUR' },
    image_url: '/products/outdoor/grey-chair.svg', topdown_image_url: '/products/outdoor/chair-plan.svg',
    source_url: 'https://jkalachand.com/grey-plastic-chairs-jkalachand-1798-e.html',
    notes: `Stackable polypropylene armchair for indoor/outdoor use. Supplier L × W × H: 560 × 500 × 770 mm. Weight not published (zero is an unknown-data sentinel, not a load rating). ${disclosure}`,
  },
  {
    ...common, delivery_regions: ['MU'], id: 'jkalachand-1799-w', sku: 'JK-1799-W',
    name: '1799-W White Outdoor Chair', supplier: 'JKalachand',
    dimensions_cm: { length: 42, width: 52, height: 83 }, weight_kg: 0,
    price: { value: 2960, currency: 'MUR' },
    image_url: '/products/outdoor/white-chair.svg', topdown_image_url: '/products/outdoor/chair-plan.svg',
    source_url: 'https://jkalachand.com/white-plastic-chair-1799-w.html',
    notes: `Stackable polypropylene chair for indoor/outdoor use. Supplier L × W × H: 420 × 520 × 830 mm. Supplier asks customers to enquire about availability. Weight not published (zero is an unknown-data sentinel, not a load rating). ${disclosure}`,
  },
  {
    ...common, delivery_regions: ['MU'], id: 'jkalachand-gs1004-swing', sku: 'JK-GS-1004-SST-3S',
    name: 'GS-1004 Three-seat Garden Swing', supplier: 'JKalachand',
    dimensions_cm: { length: 215, width: 128, height: 165 }, weight_kg: 0,
    price: { value: 12900, currency: 'MUR' },
    image_url: '/products/outdoor/garden-swing.svg', topdown_image_url: '/products/outdoor/swing-plan.svg',
    source_url: 'https://jkalachand.com/furniture/outdoor/3-seater-outdoor-swing-gs-1004-sst-3s.html',
    notes: `Three-seat steel garden swing with canopy. Overall supplier dimensions: 2150 × 1280 × 1650 mm; allow additional operating clearance specified by the supplier. Static planning model, no swing-motion simulation. Weight not published (zero is an unknown-data sentinel, not a load rating). ${disclosure}`,
  },
];
