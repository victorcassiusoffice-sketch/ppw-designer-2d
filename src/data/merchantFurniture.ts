import type { Product } from './products.schema';

/** Source-linked envelopes, independent of the illustrative detail mesh. No stock feed. */
export const MERCHANT_FURNITURE_REFERENCES = [
  {
    productId: 'courts-comfy-3-seater-dove',
    name: 'Comfy 3 Seater in Dove Fabric',
    supplier: 'Courts Mammouth',
    sourceUrl: 'https://www.courtsmammouth.mu/product/comfy-3-seater-in-dove-fabric.html',
    checkedAt: '2026-10-19',
    dimensionsCm: { length: 230, width: 94, height: 94 },
    materialSummary: 'Grey fabric upholstery; hardwood frame. Merchant reference 40072265.',
    representation: 'Measured parametric representation, not manufacturer CAD. Colour, seams and cushion construction are illustrative.',
    orderingNote: 'Supplier confirmation required for price, delivery, weight and availability. No live order is placed by this demonstration.',
  },
  {
    productId: 'espace-seville-garden-sofa',
    name: 'Seville acacia garden sofa · set component',
    supplier: 'Espace Maison',
    sourceUrl: 'https://www.espacemaison.mu/products/seville-acacia-wood-garden-sofa-set-4-pieces',
    checkedAt: '2026-10-19',
    dimensionsCm: { length: 114, width: 67, height: 87 },
    materialSummary: 'Acacia frame and polyester cushions. Supplier describes the set as FSC-certified acacia; certification evidence must be confirmed for procurement.',
    representation: 'Measured parametric representation, not manufacturer CAD. Uses the sofa dimensions in the product description, not the conflicting set-level table.',
    orderingNote: 'One sofa component from set SKU 3700103115997. The four-piece set price and weight are not assigned to this component; request a supplier quote.',
  },
] as const;

/** New individually placeable SKU. Existing Seville remains in serviceProducts. */
const comfyPlanFallback = `<svg xmlns="http://www.w3.org/2000/svg" width="2300" height="940" viewBox="0 0 2300 940"><rect x="8" y="8" width="2284" height="924" rx="58" fill="#918b83"/><rect x="30" y="25" width="2240" height="145" rx="36" fill="#a6a097"/><g fill="#b4ada2" stroke="#787169" stroke-width="9">${[0, 1, 2].map(index => `<rect x="${250 + index * 600}" y="195" width="580" height="680" rx="72"/><rect x="${250 + index * 600}" y="72" width="580" height="210" rx="64"/>`).join('')}</g><g fill="#a6a097"><rect x="18" y="40" width="212" height="865" rx="45"/><rect x="2070" y="40" width="212" height="865" rx="45"/></g></svg>`;
export const MERCHANT_FURNITURE_PRODUCTS: Product[] = [
  {
    id: MERCHANT_FURNITURE_REFERENCES[0].productId,
    sku: 'CM-40072265',
    name: MERCHANT_FURNITURE_REFERENCES[0].name,
    supplier: 'Courts Mammouth', category: 'furniture',
    dimensions_cm: { ...MERCHANT_FURNITURE_REFERENCES[0].dimensionsCm },
    weight_kg: 0, price: { value: 0, currency: 'MUR' }, price_on_request: true,
    commission_pct: 0, shopify_ready: false, designer_status: 'Done',
    delivery_regions: ['MU'], placement: 'floor', front_edge: 'bottom', energy_role: 'none',
    image_url: `data:image/svg+xml;utf8,${encodeURIComponent(comfyPlanFallback)}`,
    source_url: MERCHANT_FURNITURE_REFERENCES[0].sourceUrl,
    notes: `Source checked 2026-10-19: Courts Mammouth product reference 40072265 publishes W230 × D94 × H94 cm. ${MERCHANT_FURNITURE_REFERENCES[0].materialSummary} ${MERCHANT_FURNITURE_REFERENCES[0].representation} ${MERCHANT_FURNITURE_REFERENCES[0].orderingNote} Weight is unknown, not a zero structural load. No merchant partnership or endorsement is implied.`,
  },
];
