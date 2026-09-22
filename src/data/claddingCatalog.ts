/**
 * SAMPLE / DEMO cladding (bardage) — not Spa Concept, not a live merchant.
 *
 * Spa Concept has not sent real products. These rows exist so a designer
 * can clad a wall and see honest area → boards → packs → cost. Every price
 * is a fictitious placeholder (`sample: true`). Do not present them as
 * supplier SKUs or Connect/OMS prices.
 *
 * Quantity uses the exposed face of one board (width × length). Openings
 * are deducted the same way wall paint deducts them (`paintableEdgeAreaM2`).
 */
export const CLADDING_DEMO_DISCLAIMER =
  'Sample demo cladding — not Spa Concept and not a live merchant price. Sizes are realistic; pack prices are fictitious placeholders so the quote can be checked.';

export interface CladdingProduct {
  /** Stable id. Prefix `demo-clad-` so it can never be mistaken for a supplier SKU. */
  id: string;
  name: string;
  /** Always true. Guards against treating this row as a bought-in product. */
  sample: true;
  /** Exposed board face, metres — the area one board covers when laid. */
  boardWidthM: number;
  boardLengthM: number;
  boardsPerPack: number;
  /** Fictitious pack price in MUR. Not a merchant feed. */
  samplePackPriceMur: number;
  /** Offcut allowance on top of the net board count (0.1 = 10 %). */
  wasteFraction: number;
  /** Swatch the wall renders in. */
  hex: string;
  use: 'interior' | 'exterior' | 'both';
}

export const CLADDING_PRODUCTS: CladdingProduct[] = [
  {
    id: 'demo-clad-cedar-140',
    name: 'Sample cedar board 19×140 mm',
    sample: true,
    boardWidthM: 0.14,
    boardLengthM: 2.4,
    boardsPerPack: 6,
    samplePackPriceMur: 4200,
    wasteFraction: 0.1,
    hex: '#A56B3C',
    use: 'both',
  },
  {
    id: 'demo-clad-composite-180',
    name: 'Sample composite board 180 mm',
    sample: true,
    boardWidthM: 0.18,
    boardLengthM: 3.6,
    boardsPerPack: 4,
    samplePackPriceMur: 5600,
    wasteFraction: 0.1,
    hex: '#6E5A48',
    use: 'exterior',
  },
  {
    id: 'demo-clad-fibre-panel',
    name: 'Sample fibre-cement panel 200×600 mm',
    sample: true,
    boardWidthM: 0.2,
    boardLengthM: 0.6,
    boardsPerPack: 10,
    samplePackPriceMur: 3100,
    wasteFraction: 0.08,
    hex: '#C4BEB4',
    use: 'interior',
  },
];

export function findCladdingProduct(id: string | null | undefined): CladdingProduct | undefined {
  if (!id) return undefined;
  return CLADDING_PRODUCTS.find((p) => p.id === id);
}

/** Square metres one board covers (its exposed face). */
export function boardFaceM2(p: Pick<CladdingProduct, 'boardWidthM' | 'boardLengthM'>): number {
  return p.boardWidthM * p.boardLengthM;
}
