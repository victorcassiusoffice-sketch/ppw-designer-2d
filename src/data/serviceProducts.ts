import type { Product, ProductPriceSnapshot } from './products.schema';

export type ServiceProductShape = 'tank-horizontal' | 'tank-round' | 'toilet-bowl' | 'surface-box' | 'earth-pit'
  | 'washbasin' | 'bidet' | 'garden-sofa' | 'pipe';
export interface ServiceProductDefinition {
  /** Same identity in the catalogue, services tools, plan and 3D renderer. */
  referenceProductId: string;
  name: string;
  sku: string;
  supplier: string;
  systems: readonly ('cold-water' | 'hot-water' | 'waste' | 'electrical')[];
  shape: ServiceProductShape;
  /** World axes: length = X, width = plan depth Z, height = vertical Y. */
  dimensionsMm: { length: number; width: number; height: number };
  dimensionsBasis: 'published-envelope';
  dimensionSourceUrl: string;
  /** Absent means quote required, never a free product or a pro-rata set price. */
  priceSnapshot?: ProductPriceSnapshot;
  sourceUrl?: string;
  sourceCheckedAt?: string;
  category?: Product['category'];
  mountHeightCm?: number;
  /** A source photo, when verified, is for product reference, not a scaled plan texture. */
  sourcePhotoUrl?: string;
  colour?: string;
  /** Published stock length/width only. Unknown bore/wall thickness must stay unknown. */
  pipe?: { stockLengthM: number; publishedWidthMm: number; boreVerified: false };
  weightKg?: number;
  capacityLitres?: number;
  placement: 'floor' | 'wall';
  outdoor: boolean;
  notes: string;
}

export const SERVICE_PRODUCT_CHECKED_AT = '2026-10-08';
const snapshot = (value: number, sourceUrl: string, observedAt = SERVICE_PRODUCT_CHECKED_AT): ProductPriceSnapshot => ({
  value, currency: 'MUR', unit: 'piece', tax: 'included', observedAt,
  sourceUrl, availability: 'listed-in-stock',
});

/** Public source snapshots. No merchant connection, stock reservation or partnership is implied.
 * Connection positions, pipe bore and installation clearance are not product envelope dimensions.
 * A future merchant SKU must supply all three measured envelope dimensions before publishing a pair.
 */
export const SERVICE_PRODUCT_DEFINITIONS: readonly ServiceProductDefinition[] = [
  {
    referenceProductId: 'resiglas-water-tank-1000-a', sku: 'RESIGLAS-1000L-A',
    name: 'Resiglas 1,000 L A water tank', supplier: 'Resiglas', systems: ['cold-water'],
    shape: 'tank-horizontal', dimensionsMm: { length: 1600, width: 1050, height: 1085 },
    dimensionsBasis: 'published-envelope', dimensionSourceUrl: 'https://resiglas.mu/product/water-tank-1000l-a/',
    priceSnapshot: snapshot(14500, 'https://resiglas.mu/product/water-tank-1000l-a/'),
    capacityLitres: 1000, placement: 'floor', outdoor: true,
    notes: 'Polyethylene tank. Published overall L × W × H: 1,600 × 1,050 × 1,085 mm. Working capacity is 1,000 L; do not calculate stored water from the external box volume. Pump, pipe fittings and support design are separate. Port positions are not verified.',
  },
  {
    referenceProductId: 'resiglas-water-tank-1000-c', sku: 'RESIGLAS-1000L-C',
    name: 'Resiglas 1,000 L C water tank', supplier: 'Resiglas', systems: ['cold-water'],
    shape: 'tank-round', dimensionsMm: { length: 1320, width: 1320, height: 1055 },
    dimensionsBasis: 'published-envelope', dimensionSourceUrl: 'https://resiglas.mu/product/water-tank-1000l-c/',
    priceSnapshot: snapshot(21850, 'https://resiglas.mu/product/water-tank-1000l-c/'),
    capacityLitres: 1000, weightKg: 36, placement: 'floor', outdoor: true,
    notes: 'Fibreglass tank. Published overall L × W × H: 1,320 × 1,320 × 1,055 mm. Working capacity is 1,000 L. Empty weight is 36 kg, not the full operating load. Pump, connections and support design are separate. Port positions are not verified.',
  },
  {
    referenceProductId: 'espace-emilia-toilet-bowl', sku: 'ESPACE-4067116351545',
    name: 'Emilia toilet bowl · 650 mm', supplier: 'Espace Maison', systems: ['cold-water', 'waste'],
    shape: 'toilet-bowl', dimensionsMm: { length: 650, width: 395, height: 400 },
    dimensionsBasis: 'published-envelope', dimensionSourceUrl: 'https://www.espacemaison.mu/products/toilet-1',
    priceSnapshot: snapshot(7156, 'https://www.espacemaison.mu/products/toilet-1'),
    weightKg: 25.9, placement: 'floor', outdoor: false,
    notes: 'White ceramic bowl, supplier SKU 4067116351545. Published L × W × H: 650 × 395 × 400 mm. This 400 mm-high planning body does not add an invented cistern. Supplier lists diameter 110 mm, but does not establish drain centre position, floor rough-in, or a complete connector specification. Cistern and installation details must be confirmed.',
  },
  {
    referenceProductId: 'electrical-legrand-surface-box-613351', sku: 'LEGRAND-613351',
    name: 'Legrand Belanko S double surface box', supplier: 'Electrical.mu', systems: ['electrical'],
    shape: 'surface-box', dimensionsMm: { length: 146, width: 35, height: 86 },
    dimensionsBasis: 'published-envelope',
    dimensionSourceUrl: 'https://www.legrand.com.vn/en/catalog/products/belanko-s-surface-mounting-box-bs-standard-1-gang-86x146x35mm-613351',
    priceSnapshot: snapshot(105, 'https://electrical.mu/products/legrand-belanko-s-surface-mounting-box-bs-standard-2-gang'),
    placement: 'wall', outdoor: false,
    notes: 'Reference 613351. Face width 146 mm × height 86 mm; wall projection 35 mm. Empty mounting box only: no socket, breaker, wiring, electrical load or distribution-board rating is included. A mounting-height default is a placement aid, not an installation rule.',
  },
  {
    referenceProductId: 'electrical-hex-polymer-earth-pit', sku: 'HEX-HEP',
    name: 'HEX polymer earth inspection pit', supplier: 'Electrical.mu', systems: ['electrical'],
    shape: 'earth-pit', dimensionsMm: { length: 308, width: 308, height: 214 },
    dimensionsBasis: 'published-envelope', dimensionSourceUrl: 'https://electrical.mu/products/polymer-earth-pits',
    priceSnapshot: snapshot(2735, 'https://electrical.mu/products/polymer-earth-pits'),
    weightKg: 2.5, placement: 'floor', outdoor: true,
    notes: 'HEP housing-pit-only variant. Published L × W × H: 308 × 308 × 214 mm. Inspection enclosure only; earth electrode, bar, conductor and excavation are separate. This does not calculate earth resistance or certify earthing. Below-ground location remains a coordination setting.',
  },
  {
    referenceProductId: 'espace-durastyle-washbasin-800', sku: 'ESPACE-4021534850721',
    name: 'DuraStyle cabinet washbasin · 800 mm', supplier: 'Espace Maison', systems: ['cold-water', 'hot-water', 'waste'],
    shape: 'washbasin', dimensionsMm: { length: 800, width: 480, height: 170 },
    dimensionsBasis: 'published-envelope', dimensionSourceUrl: 'https://www.espacemaison.mu/products/washbasin-for-cabinet',
    priceSnapshot: snapshot(10262, 'https://www.espacemaison.mu/products/washbasin-for-cabinet', '2026-10-09'),
    sourceCheckedAt: '2026-10-09', weightKg: 23.7, placement: 'wall', mountHeightCm: 68, outdoor: false,
    notes: 'White ceramic cabinet washbasin only, with one tap hole and overflow. Cabinet, tap and trap are not included in this planning item. Supplier publishes 800 × 480 × 170 mm. The 680 mm bottom elevation is an editable display default, not a mounting specification. Supports, cut-out, pipe centres and installation height require the manufacturer drawing.',
  },
  {
    referenceProductId: 'espace-duravit-dcode-bidet-224110', sku: 'DURAVIT-22411000002',
    name: 'Duravit D-Code floorstanding bidet · quote required', supplier: 'Espace Maison', systems: ['cold-water', 'hot-water', 'waste'],
    shape: 'bidet', dimensionsMm: { length: 560, width: 360, height: 385 },
    dimensionsBasis: 'published-envelope',
    dimensionSourceUrl: 'https://pro.duravit.in/pro/html/default/402880943a1b6e1b013a1bd282eb0051.in-en.html?ncat=bidets&nser=7120&product=245285',
    sourceUrl: 'https://fliphtml5.com/nzna/dieq/PROBOOK/', sourceCheckedAt: '2026-10-09',
    weightKg: 20.5, placement: 'floor', outdoor: false,
    notes: 'Exact model 22411000002 is listed in Espace Maison PROBOOK, page 279, an older supplier catalogue. Current supply and Mauritius price require a quote; this is not a current-stock claim. Duravit publishes 360 mm face width × 560 mm projection × 385 mm height and 20.5 kg. Bidet ceramic with one tap hole and overflow; tap and trap are separate. Port locations are not inferred from the external envelope.',
  },
  {
    referenceProductId: 'espace-seville-garden-sofa', sku: 'ESPACE-3700103115997-SOFA-COMPONENT',
    name: 'Seville acacia garden sofa · set component', supplier: 'Espace Maison', systems: [], category: 'furniture',
    shape: 'garden-sofa', dimensionsMm: { length: 1140, width: 670, height: 870 },
    dimensionsBasis: 'published-envelope', dimensionSourceUrl: 'https://www.espacemaison.mu/products/seville-acacia-wood-garden-sofa-set-4-pieces',
    sourceCheckedAt: '2026-10-09', placement: 'floor', outdoor: true,
    notes: 'Measured sofa component from Seville set SKU 3700103115997. The supplier description explicitly gives the sofa as 114 × 67 × 87 cm. Its published price and weight are for a four-piece set (sofa, two chairs, table), not this sofa alone. Individual purchase and price require a quote; no invented split price or set weight is applied. The conflicting set-level specification table is not used. Acacia frame and polyester cushions are illustrated, not manufacturer CAD.',
  },
  {
    referenceProductId: 'espace-era-pvc-pn16-110-6m', sku: 'ESPACE-6091242230786',
    name: 'ERA PVC PN16 pipe · 6 m × 110 mm', supplier: 'Espace Maison', systems: ['cold-water'],
    shape: 'pipe', dimensionsMm: { length: 6000, width: 110, height: 110 },
    dimensionsBasis: 'published-envelope', dimensionSourceUrl: 'https://www.espacemaison.mu/products/pvc-pipe-pn-16-6-m-x-110-mm',
    priceSnapshot: snapshot(3579, 'https://www.espacemaison.mu/products/pvc-pipe-pn-16-6-m-x-110-mm', '2026-10-09'),
    sourceCheckedAt: '2026-10-09', placement: 'floor', outdoor: false, colour: '#717876',
    pipe: { stockLengthM: 6, publishedWidthMm: 110, boreVerified: false },
    notes: 'One complete 6 m stock length, not a per-metre price. Supplier lists length 6,000 mm and width/diameter 110 mm; that published width defines the circular planning envelope. Internal bore, wall thickness, socket projection, pressure duty and local approval are not verified. The schematic does not calculate hydraulic capacity or assert nominal bore equals outside diameter. Connections and cutting waste remain separate from placing this stock item.',
  },
  {
    referenceProductId: 'espace-pvc-electrical-conduit-20-6m', sku: 'ESPACE-6091242230939',
    name: 'PVC electrical conduit · 6 m × 20 mm', supplier: 'Espace Maison', systems: ['electrical'],
    shape: 'pipe', dimensionsMm: { length: 6000, width: 20, height: 20 },
    dimensionsBasis: 'published-envelope', dimensionSourceUrl: 'https://www.espacemaison.mu/fr/produits/tuyau-lectrique',
    priceSnapshot: snapshot(161, 'https://www.espacemaison.mu/fr/produits/tuyau-lectrique', '2026-10-09'),
    sourceCheckedAt: '2026-10-09', placement: 'floor', outdoor: false, colour: '#e1e3db',
    pipe: { stockLengthM: 6, publishedWidthMm: 20, boreVerified: false },
    notes: 'One empty 6 m PVC conduit stock length, not cable and not a per-metre price. Supplier publishes length 6,000 mm and width/diameter 20 mm. Circular planning envelope follows the published width; actual bore, wall thickness, bend radius and cable fill are unknown. No electrical capacity or installation certification is inferred. Manufacturer is not identified on the listing.',
  },
];

export function serviceProductById(id: string | undefined): ServiceProductDefinition | undefined {
  return SERVICE_PRODUCT_DEFINITIONS.find(product => product.referenceProductId === id);
}

/** Validated canonical conversion. No rendering layer may invent a second dimensional envelope. */
export function serviceProductSizeM(definition: ServiceProductDefinition) {
  const { length, width, height } = definition.dimensionsMm;
  if (![length, width, height].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('A paired service product needs positive finite millimetre dimensions');
  }
  return { lengthM: length / 1000, widthM: width / 1000, heightM: height / 1000 };
}

/** Original plan art in the same physical aspect ratio as the 3D envelope.
 * Decorative strokes stay inside the envelope; no product photo is stretched into a floor plan.
 */
export function serviceProductPlanSvg(definition: ServiceProductDefinition): string {
  serviceProductSizeM(definition);
  const w = definition.dimensionsMm.length;
  const d = definition.dimensionsMm.width;
  const s = Math.min(w, d) * .025;
  const edge = '#607869';
  let body: string;
  if (definition.shape === 'tank-round') {
    body = `<ellipse cx="${w / 2}" cy="${d / 2}" rx="${w / 2 - s}" ry="${d / 2 - s}" fill="#c8d4c6"/><circle cx="${w / 2}" cy="${d / 2}" r="${Math.min(w, d) * .2}" fill="#688172"/>`;
  } else if (definition.shape === 'tank-horizontal') {
    body = `<rect x="${s}" y="${s}" width="${w - s * 2}" height="${d - s * 2}" rx="${d * .28}" fill="#c8d4c6"/><path d="M${w * .25},${s * 2}v${d - s * 4}M${w * .75},${s * 2}v${d - s * 4}" fill="none"/><ellipse cx="${w * .5}" cy="${d * .5}" rx="${d * .18}" ry="${d * .18}" fill="#688172"/>`;
  } else if (definition.shape === 'toilet-bowl' || definition.shape === 'bidet') {
    body = `<path d="M${w * .82},${s}H${w - s}V${d - s}H${w * .82}C${-w * .24},${d + d * .25} ${-w * .24},${-d * .25} ${w * .82},${s}Z" fill="#f0f1e9"/><ellipse cx="${w * .45}" cy="${d * .5}" rx="${w * .32}" ry="${d * .34}" fill="#b8cdc2"/>`;
    if (definition.shape === 'bidet') body += `<circle cx="${w * .88}" cy="${d * .5}" r="${d * .035}" fill="#667e73"/>`;
  } else if (definition.shape === 'washbasin') {
    body = `<rect x="${s}" y="${s}" width="${w - s * 2}" height="${d - s * 2}" rx="${d * .07}" fill="#f5f3ec"/><rect x="${w * .09}" y="${d * .25}" width="${w * .82}" height="${d * .64}" rx="${d * .13}" fill="#b8cdc2"/><circle cx="${w * .5}" cy="${d * .11}" r="${d * .035}" fill="#65796f"/><circle cx="${w * .5}" cy="${d * .55}" r="${d * .035}" fill="#65796f"/>`;
  } else if (definition.shape === 'garden-sofa') {
    body = `<rect x="${s}" y="${s}" width="${w - s * 2}" height="${d - s * 2}" rx="${s * 2}" fill="#987452"/><rect x="${w * .095}" y="${d * .19}" width="${w * .81}" height="${d * .73}" rx="${d * .07}" fill="#e4e0d2"/><path d="M${w * .5},${d * .21}v${d * .69}"/><rect x="${w * .09}" y="${d * .045}" width="${w * .82}" height="${d * .2}" rx="${s * 2}" fill="#d3d2c4"/>`;
  } else if (definition.shape === 'pipe') {
    body = `<rect x="${s}" y="${s}" width="${w - s * 2}" height="${d - s * 2}" rx="${s}" fill="${definition.colour ?? '#717876'}"/><path d="M${s * 2},${d * .3}H${w - s * 2}" stroke="#c7d0c9"/>`;
  } else {
    body = `<rect x="${s}" y="${s}" width="${w - s * 2}" height="${d - s * 2}" rx="${s * 2}" fill="${definition.shape === 'earth-pit' ? '#52755d' : '#e3e8df'}"/><rect x="${w * .09}" y="${d * .13}" width="${w * .82}" height="${d * .74}" rx="${s}" fill="${definition.shape === 'earth-pit' ? '#74947b' : '#bfcac0'}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${d}" viewBox="0 0 ${w} ${d}"><g stroke="${edge}" stroke-width="${s}" stroke-linejoin="round">${body}</g></svg>`;
}

const disclosure = 'No live stock guarantee, merchant partnership or order offer. Delivery, installation and ancillary materials are not added to this estimate. Original simplified 2D and 3D planning views share the published envelope; details and colour are illustrative, not manufacturer CAD. Verify installation and connectors with the supplier.';
export const SERVICE_PRODUCTS: Product[] = SERVICE_PRODUCT_DEFINITIONS.map(definition => ({
  id: definition.referenceProductId, sku: definition.sku, name: definition.name, supplier: definition.supplier,
  category: definition.category ?? 'other', dimensions_cm: {
    length: definition.dimensionsMm.length / 10, width: definition.dimensionsMm.width / 10,
    height: definition.dimensionsMm.height / 10,
  },
  weight_kg: definition.weightKg ?? 0,
  price: { value: definition.priceSnapshot?.value ?? 0, currency: definition.priceSnapshot?.currency ?? 'MUR' },
  price_snapshot: definition.priceSnapshot,
  price_on_request: !definition.priceSnapshot, commission_pct: 0, shopify_ready: false,
  image_url: `data:image/svg+xml;utf8,${encodeURIComponent(serviceProductPlanSvg(definition))}`,
  topdown_image_url: `data:image/svg+xml;utf8,${encodeURIComponent(serviceProductPlanSvg(definition))}`,
  designer_status: 'Done', delivery_regions: ['MU'], placement: definition.placement,
  front_edge: ['toilet-bowl', 'bidet'].includes(definition.shape) ? 'left' : 'bottom',
  ...(definition.placement === 'wall' ? { mount_height_cm: definition.mountHeightCm ?? 120 } : {}),
  outdoor: definition.outdoor, energy_role: 'none',
  source_url: definition.sourceUrl ?? definition.priceSnapshot?.sourceUrl ?? definition.dimensionSourceUrl,
  notes: `${definition.notes} Source checked ${definition.sourceCheckedAt ?? SERVICE_PRODUCT_CHECKED_AT}. ${definition.priceSnapshot ? 'Published reference price per piece, VAT included. ' : 'Request a supplier quote; this item is excluded from the cost total until priced. '}${definition.weightKg === undefined ? 'Confirm product weight with the supplier before planning structural loads. ' : ''}${disclosure}`,
}));
