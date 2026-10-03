import type { Product } from '../data/products.schema';
import { hasFurniturePreview } from '../data/dimensionalPreview';
import { hasSolarPanelPreview } from '../data/solarPreview';
import type { ItemSolid } from './roomSolids';

/** A true supplier top-down asset remains authoritative. Otherwise the same
 * measured planning body used by 3D can be photographed from above in 2D. */
export function canRenderPlanModel(product: Product): boolean {
  return !product.topdown_image_url && (hasFurniturePreview(product.id) || hasSolarPanelPreview(product) || product.sku === 'DURACO-WATER-CYL-1000')
    && Object.values(product.dimensions_cm).every(value => Number.isFinite(value) && value > 0);
}

export function planModelKey(product: Product): string {
  return [product.id, product.dimensions_cm.length, product.dimensions_cm.width, product.dimensions_cm.height, product.front_edge ?? 'bottom'].join(':');
}

/** No current room coordinates, rotation, camera or price enter this model.
 * Konva applies the saved rotation once, after drawing this unrotated image. */
export function planModelSolid(product: Product): ItemSolid {
  const lengthM = product.dimensions_cm.length / 100;
  const widthM = product.dimensions_cm.width / 100;
  const heightM = product.dimensions_cm.height / 100;
  return { key: `plan-${product.id}`, instanceId: `plan-${product.id}`, productId: product.id,
    x0: 0, y0: 0, x1: lengthM, y1: widthM, z0: 0, z1: heightM,
    rotationDeg: 0, lengthM, widthM, heightM, frontEdge: product.front_edge, hex: '#c5bfb3' };
}

/** Resolution varies, the world-space projection and footprint never do. */
export function planModelRasterSize(lengthM: number, widthM: number): { width: number; height: number } {
  const largest = Math.max(lengthM, widthM);
  return { width: Math.max(8, Math.round(512 * lengthM / largest)), height: Math.max(8, Math.round(512 * widthM / largest)) };
}
