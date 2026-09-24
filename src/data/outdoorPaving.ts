/**
 * Public Espace Maison product listings checked on 2026-09-23.
 * This is a dated reference range, not a merchant API or stock feed.
 * The supplier lists these cement products for pedestrian use and shop enquiry.
 */
export interface OutdoorPavingProduct {
  id: string;
  sku: string;
  name: string;
  brand: 'UBP';
  supplier: 'Espace Maison';
  tileWidthM: number;
  tileDepthM: number;
  thicknessM: number;
  /** Illustrative natural-cement preview; not a measured colour specification. */
  renderHex: string;
  unitPriceMur: number;
  sourceUrl: string;
  checkedAt: string;
}

export const OUTDOOR_PAVING_PRODUCTS: readonly OutdoorPavingProduct[] = [
  {
    id: 'em-ubp-vorslacol001', sku: 'VORSLACOL001', name: 'Slab Ordinary',
    brand: 'UBP', supplier: 'Espace Maison', tileWidthM: 0.33, tileDepthM: 0.33, thicknessM: 0.02,
    renderHex: '#b6b4ab', unitPriceMur: 120,
    sourceUrl: 'https://www.espacemaison.mu/products/slab-ordinary-1', checkedAt: '2026-09-23',
  },
  {
    id: 'em-ubp-rusclaord001', sku: 'RUSCLAORD001', name: 'Grey rustic pavement',
    brand: 'UBP', supplier: 'Espace Maison', tileWidthM: 0.5, tileDepthM: 0.25, thicknessM: 0.045,
    renderHex: '#9ca09c', unitPriceMur: 186,
    sourceUrl: 'https://www.espacemaison.mu/products/grey-rustic-pavement-50-25-cm-1', checkedAt: '2026-09-23',
  },
  {
    id: 'em-ubp-ruspavord006', sku: 'RUSPAVORD006', name: 'Rustic Pavement Ordinary',
    brand: 'UBP', supplier: 'Espace Maison', tileWidthM: 0.6, tileDepthM: 0.6, thicknessM: 0.045,
    renderHex: '#b9b5a9', unitPriceMur: 536,
    sourceUrl: 'https://www.espacemaison.mu/products/rustic-pavement-ordinary-10', checkedAt: '2026-09-23',
  },
];

export function findOutdoorPavingProduct(id: string | undefined): OutdoorPavingProduct | undefined {
  return OUTDOOR_PAVING_PRODUCTS.find((product) => product.id === id);
}

export function pavingSizeLabel(product: OutdoorPavingProduct): string {
  return `${product.tileWidthM * 100} × ${product.tileDepthM * 100} × ${product.thicknessM * 100} cm`;
}
