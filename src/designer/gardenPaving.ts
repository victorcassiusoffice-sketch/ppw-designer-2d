import { findOutdoorPavingProduct, type OutdoorPavingProduct } from '../data/outdoorPaving';
import type { GardenSurface } from './garden';

export interface GardenPavingEstimate {
  product: OutdoorPavingProduct;
  areaM2: number;
  columns: number;
  rows: number;
  pieces: number;
  purchasedAreaM2: number;
  totalMur: number;
}

/** Straight rows with each edge cut using a whole piece; offcuts are not reused.
 * No joint spacing, extra breakage allowance, installation or delivery is priced.
 */
export function estimateGardenPaving(surface: Pick<GardenSurface, 'kind' | 'pavingProductId' | 'widthM' | 'depthM'>): GardenPavingEstimate | null {
  if (surface.kind !== 'path' || !Number.isFinite(surface.widthM) || !Number.isFinite(surface.depthM)
    || surface.widthM <= 0 || surface.depthM <= 0) return null;
  const product = findOutdoorPavingProduct(surface.pavingProductId);
  if (!product) return null;
  const columns = Math.max(1, Math.ceil(surface.widthM / product.tileWidthM - 1e-8));
  const rows = Math.max(1, Math.ceil(surface.depthM / product.tileDepthM - 1e-8));
  const pieces = columns * rows;
  return {
    product, areaM2: surface.widthM * surface.depthM, columns, rows, pieces,
    purchasedAreaM2: pieces * product.tileWidthM * product.tileDepthM,
    totalMur: pieces * product.unitPriceMur,
  };
}
